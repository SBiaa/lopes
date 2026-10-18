import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { protegido, corpo, erro } from "@/lib/http";

export const GET = protegido(
  async () => {
    const rows = await query("SELECT id, nome, papel, ativo, criado_em FROM usuarios ORDER BY nome");
    return NextResponse.json({ usuarios: rows });
  },
  { admin: true }
);

// Cria uma pessoa com nome + PIN (4 a 8 dígitos). Só o administrador.
export const POST = protegido(
  async (req) => {
    const b = await corpo<{ nome?: string; pin?: string; papel?: string }>(req);
    const nome = String(b?.nome ?? "").replace(/\s+/g, " ").trim();
    const pin = String(b?.pin ?? "");
    const papel = b?.papel === "admin" ? "admin" : "operador";
    if (nome.length < 2 || nome.length > 40) return erro("Informe um nome de 2 a 40 letras.");
    if (!/^\d{4,8}$/.test(pin)) return erro("O PIN deve ter de 4 a 8 números.");
    const hash = await bcrypt.hash(pin, 10);
    const rows = await query(
      `INSERT INTO usuarios (nome, pin_hash, papel) VALUES ($1, $2, $3)
       ON CONFLICT (lower(nome)) DO NOTHING RETURNING id, nome, papel`,
      [nome, hash, papel]
    );
    if (!rows.length) return erro("Já existe uma pessoa com esse nome.", 409);
    return NextResponse.json(rows[0], { status: 201 });
  },
  { admin: true }
);
