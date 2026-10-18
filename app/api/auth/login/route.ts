import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { criarSessao } from "@/lib/auth";
import { corpo, erro } from "@/lib/http";

export async function POST(req: Request) {
  const b = await corpo<{ nome?: string; pin?: string }>(req);
  const nome = String(b?.nome ?? "").trim();
  const pin = String(b?.pin ?? "");
  if (!nome || !pin) return erro("Informe nome e PIN.");
  const [u] = await query("SELECT id, nome, papel, pin_hash FROM usuarios WHERE lower(nome) = lower($1) AND ativo", [nome]);
  // compara sempre, para não revelar se o nome existe pelo tempo de resposta
  const ok = await bcrypt.compare(pin, u?.pin_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
  if (!u || !ok) return erro("Nome ou PIN incorretos.", 401);
  await criarSessao({ id: u.id, nome: u.nome, papel: u.papel });
  return NextResponse.json({ id: u.id, nome: u.nome, papel: u.papel });
}
