import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido, corpo, erro } from "@/lib/http";

// POST {chaves:[...]} -> quais dessas já tiveram baixa (para a prévia "X já baixados serão ignorados").
export const POST = protegido(async (req) => {
  const b = await corpo<{ chaves?: unknown[] }>(req);
  if (!Array.isArray(b?.chaves) || b.chaves.length > 5000) return erro("Envie até 5000 chaves.");
  const chaves = b.chaves.map((c) => String(c)).filter(Boolean);
  const rows = await query("SELECT chave FROM pedidos_baixados WHERE chave = ANY($1::text[])", [chaves]);
  return NextResponse.json({ jaBaixadas: rows.map((r) => r.chave) });
});
