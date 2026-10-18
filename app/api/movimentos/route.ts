import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido } from "@/lib/http";

// Histórico: baixas (agrupadas por lote) e ajustes, do mais recente para o mais antigo.
export const GET = protegido(async (req) => {
  const limite = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limite")) || 50));
  const rows = await query(
    `SELECT * FROM (
       SELECT 'baixa' AS tipo, l.criado_em, u.nome AS usuario, l.id::text AS lote_id,
              l.pedidos, l.pecas, (l.desfeito_em IS NOT NULL) AS desfeita,
              NULL::text AS cor, NULL::text AS tamanho, NULL::int AS delta
       FROM lotes_baixa l LEFT JOIN usuarios u ON u.id = l.usuario_id
       UNION ALL
       SELECT 'ajuste', m.criado_em, u.nome, NULL, NULL, NULL, false, c.nome, t.nome, m.delta
       FROM movimentos m
       JOIN cores c ON c.id = m.cor_id JOIN tamanhos t ON t.id = m.tamanho_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.tipo IN ('ajuste', 'entrada')
     ) x ORDER BY criado_em DESC LIMIT $1`,
    [limite]
  );
  return NextResponse.json({ movimentos: rows });
});
