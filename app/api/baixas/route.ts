import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { protegido, corpo, erro } from "@/lib/http";

type Pedido = { chave: string; itens: { cor: string; tamanho: string; qtd: number }[] };

// POST: dá baixa em um conjunto de pedidos, de uma vez (tudo ou nada).
// Cada chave de pedido só entra uma vez: PK em pedidos_baixados garante isso mesmo com dois usuários ao mesmo tempo.
export const POST = protegido(async (req, s) => {
  const b = await corpo<{ pedidos?: Pedido[] }>(req);
  const pedidos = b?.pedidos;
  if (!Array.isArray(pedidos) || !pedidos.length || pedidos.length > 3000) return erro("Envie de 1 a 3000 pedidos.");

  // valida e deduplica chaves dentro do próprio envio
  const vistos = new Set<string>();
  const lista: Pedido[] = [];
  for (const p of pedidos) {
    const chave = String(p?.chave ?? "").trim();
    if (!chave || chave.length > 200) return erro("Há pedido sem chave de identificação.");
    if (!Array.isArray(p.itens) || !p.itens.length) return erro("Há pedido sem itens.");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const itens = p.itens.map((i) => ({
      cor: String(i?.cor ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
      tamanho: String(i?.tamanho ?? "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 60),
      qtd: Number(i?.qtd),
    }));
    if (itens.some((i) => !i.cor || !i.tamanho || !Number.isInteger(i.qtd) || i.qtd < 1 || i.qtd > 1000))
      return erro("Confira cor, tamanho e quantidade dos itens.");
    lista.push({ chave, itens });
  }

  // garante que cor/tamanho existam (cores novas entram no fim da lista)
  const nomesCor = [...new Set(lista.flatMap((p) => p.itens.map((i) => i.cor)))];
  const nomesTam = [...new Set(lista.flatMap((p) => p.itens.map((i) => i.tamanho)))];
  const [cores, tams] = await Promise.all([
    query(
      `INSERT INTO cores (nome, ordem)
       SELECT n, (SELECT coalesce(max(ordem), 0) FROM cores) + o::int FROM unnest($1::text[]) WITH ORDINALITY AS t(n, o)
       ON CONFLICT (lower(nome)) DO UPDATE SET nome = cores.nome RETURNING id, nome`,
      [nomesCor]
    ),
    query(
      `INSERT INTO tamanhos (nome, ordem)
       SELECT n, (SELECT coalesce(max(ordem), 0) FROM tamanhos) + o::int FROM unnest($1::text[]) WITH ORDINALITY AS t(n, o)
       ON CONFLICT (upper(nome)) DO UPDATE SET nome = tamanhos.nome RETURNING id, nome`,
      [nomesTam]
    ),
  ]);
  const corId = new Map(cores.map((r) => [r.nome.toLowerCase(), r.id as number]));
  const tamId = new Map(tams.map((r) => [r.nome.toUpperCase(), r.id as number]));

  const itens = lista.flatMap((p) =>
    p.itens.map((i) => ({
      chave: p.chave,
      cor_id: corId.get(i.cor.toLowerCase()),
      tamanho_id: tamId.get(i.tamanho),
      qtd: i.qtd,
    }))
  );
  if (itens.some((i) => !i.cor_id || !i.tamanho_id)) return erro("Não consegui identificar cor ou tamanho.", 422);

  const lote = randomUUID();
  const [r] = await query(
    `WITH novos AS (
        INSERT INTO pedidos_baixados (chave, lote_id)
        SELECT c, $1::uuid FROM unnest($2::text[]) AS c
        ON CONFLICT (chave) DO NOTHING RETURNING chave
      ), it AS (
        SELECT i.cor_id, i.tamanho_id, sum(i.qtd)::int AS qtd
        FROM jsonb_to_recordset($3::jsonb) AS i(chave text, cor_id int, tamanho_id int, qtd int)
        JOIN novos n ON n.chave = i.chave
        GROUP BY 1, 2
      ), l AS (
        INSERT INTO lotes_baixa (id, usuario_id, pedidos, pecas)
        SELECT $1::uuid, $4::uuid, (SELECT count(*) FROM novos), coalesce((SELECT sum(qtd) FROM it), 0)
        WHERE EXISTS (SELECT 1 FROM novos)
        RETURNING id
      ), est AS (
        INSERT INTO estoque (cor_id, tamanho_id, quantidade)
        SELECT cor_id, tamanho_id, -qtd FROM it WHERE EXISTS (SELECT 1 FROM l)
        ON CONFLICT (cor_id, tamanho_id)
        DO UPDATE SET quantidade = estoque.quantidade + EXCLUDED.quantidade, atualizado_em = now()
        RETURNING 1
      ), mov AS (
        INSERT INTO movimentos (usuario_id, tipo, cor_id, tamanho_id, delta, lote_id)
        SELECT $4::uuid, 'baixa', cor_id, tamanho_id, -qtd, $1::uuid FROM it WHERE EXISTS (SELECT 1 FROM l)
        RETURNING 1
      )
      SELECT (SELECT count(*) FROM l) AS criado,
             coalesce((SELECT array_agg(chave) FROM novos), '{}') AS aplicados,
             (SELECT pecas FROM lotes_baixa WHERE id = $1::uuid) AS pecas`,
    [lote, lista.map((p) => p.chave), JSON.stringify(itens), s.id]
  );
  const aplicados: string[] = r.aplicados ?? [];
  const aplicadosSet = new Set(aplicados);
  return NextResponse.json({
    loteId: Number(r.criado) ? lote : null,
    aplicados,
    ignorados: lista.map((p) => p.chave).filter((c) => !aplicadosSet.has(c)),
  });
});
