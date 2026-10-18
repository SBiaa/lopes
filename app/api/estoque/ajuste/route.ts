import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido, corpo, erro } from "@/lib/http";

// Define a contagem de uma variação (entrada ou correção). Registra a diferença no histórico.
export const POST = protegido(async (req, s) => {
  const b = await corpo<{ cor_id?: number; tamanho_id?: number; quantidade?: number }>(req);
  const cor = Number(b?.cor_id), tam = Number(b?.tamanho_id), qtd = Number(b?.quantidade);
  if (!Number.isInteger(cor) || !Number.isInteger(tam) || !Number.isInteger(qtd) || Math.abs(qtd) > 1_000_000)
    return erro("Confira cor, tamanho e quantidade.");
  const rows = await query(
    `WITH cur AS (SELECT quantidade FROM estoque WHERE cor_id = $1 AND tamanho_id = $2),
          up AS (INSERT INTO estoque (cor_id, tamanho_id, quantidade) VALUES ($1, $2, $3)
                 ON CONFLICT (cor_id, tamanho_id) DO UPDATE SET quantidade = EXCLUDED.quantidade, atualizado_em = now()
                 RETURNING quantidade),
          mov AS (INSERT INTO movimentos (usuario_id, tipo, cor_id, tamanho_id, delta)
                  SELECT $4, 'ajuste', $1, $2, $3 - coalesce((SELECT quantidade FROM cur), 0)
                  WHERE $3 <> coalesce((SELECT quantidade FROM cur), 0)
                  RETURNING delta)
     SELECT (SELECT quantidade FROM up) AS quantidade, (SELECT delta FROM mov) AS delta`,
    [cor, tam, qtd, s.id]
  ).catch(() => null);
  if (!rows) return erro("Cor ou tamanho não encontrado.", 404);
  return NextResponse.json(rows[0]);
});
