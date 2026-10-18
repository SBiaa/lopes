import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido, erro } from "@/lib/http";

// Desfaz uma baixa: devolve as peças ao estoque e libera os pedidos para serem baixados de novo.
export const POST = protegido<{ params: Promise<{ id: string }> }>(async (_req, s, { params }) => {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return erro("Baixa inválida.");
  const [r] = await query(
    `WITH l AS (
        UPDATE lotes_baixa SET desfeito_em = now(), desfeito_por = $2::uuid
        WHERE id = $1::uuid AND desfeito_em IS NULL RETURNING id, pecas, pedidos
      ), it AS (
        SELECT m.cor_id, m.tamanho_id, -sum(m.delta)::int AS qtd
        FROM movimentos m JOIN l ON l.id = m.lote_id WHERE m.tipo = 'baixa' GROUP BY 1, 2
      ), est AS (
        UPDATE estoque e SET quantidade = e.quantidade + it.qtd, atualizado_em = now()
        FROM it WHERE e.cor_id = it.cor_id AND e.tamanho_id = it.tamanho_id RETURNING 1
      ), mov AS (
        INSERT INTO movimentos (usuario_id, tipo, cor_id, tamanho_id, delta, lote_id)
        SELECT $2::uuid, 'estorno', cor_id, tamanho_id, qtd, $1::uuid FROM it RETURNING 1
      ), lib AS (
        DELETE FROM pedidos_baixados WHERE lote_id = $1::uuid AND EXISTS (SELECT 1 FROM l) RETURNING 1
      )
      SELECT (SELECT count(*) FROM l) AS desfeitas, (SELECT pecas FROM l) AS pecas, (SELECT pedidos FROM l) AS pedidos`,
    [id, s.id]
  );
  if (!Number(r.desfeitas)) return erro("Essa baixa não existe ou já foi desfeita.", 404);
  return NextResponse.json({ ok: true, pecas: r.pecas, pedidos: r.pedidos });
});
