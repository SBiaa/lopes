import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido } from "@/lib/http";

// Saldo por cor x tamanho + estoque mínimo + última baixa que ainda pode ser desfeita.
export const GET = protegido(async () => {
  const [cores, tamanhos, itens, cfg, ultimo] = await Promise.all([
    query(`SELECT c.id, c.nome, c.ativo FROM cores c
           WHERE c.ativo OR EXISTS (SELECT 1 FROM estoque e WHERE e.cor_id = c.id AND e.quantidade <> 0)
           ORDER BY c.ativo DESC, c.ordem, c.id`),
    query(`SELECT t.id, t.nome, t.ativo FROM tamanhos t
           WHERE t.ativo OR EXISTS (SELECT 1 FROM estoque e WHERE e.tamanho_id = t.id AND e.quantidade <> 0)
           ORDER BY t.ativo DESC, t.ordem, t.id`),
    query("SELECT cor_id, tamanho_id, quantidade FROM estoque"),
    query("SELECT valor FROM config WHERE chave = 'estoque_minimo'"),
    query(`SELECT id, criado_em, pedidos, pecas FROM lotes_baixa
           WHERE desfeito_em IS NULL ORDER BY criado_em DESC LIMIT 1`),
  ]);
  return NextResponse.json({
    cores,
    tamanhos,
    itens,
    minimo: Number(cfg[0]?.valor ?? 5),
    ultimoLote: ultimo[0] ?? null,
  });
});
