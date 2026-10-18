import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido, corpo, erro } from "@/lib/http";

export const PUT = protegido(async (req) => {
  const b = await corpo<{ minimo?: number }>(req);
  const n = Number(b?.minimo);
  if (!Number.isInteger(n) || n < 0 || n > 100000) return erro("Informe um número inteiro, 0 ou mais.");
  await query(
    `INSERT INTO config (chave, valor) VALUES ('estoque_minimo', to_jsonb($1::int))
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [n]
  );
  return NextResponse.json({ minimo: n });
});
