// Uso: npm run criar-usuario -- "Nome" 1234 [admin|operador]
// Cria (ou troca o PIN de) uma pessoa direto no banco. Serve para criar o primeiro administrador.
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const [nome, pin, papelArg] = process.argv.slice(2);
const papel = papelArg === "admin" ? "admin" : "operador";
if (!nome || !/^\d{4,8}$/.test(pin ?? "")) {
  console.error('Uso: npm run criar-usuario -- "Nome" PIN(4 a 8 números) [admin|operador]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não configurada (use o .env.local).");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const hash = await bcrypt.hash(pin, 10);
const rows = await sql.query(
  `INSERT INTO usuarios (nome, pin_hash, papel) VALUES ($1, $2, $3)
   ON CONFLICT (lower(nome)) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, papel = EXCLUDED.papel, ativo = true
   RETURNING id, nome, papel`,
  [nome.trim(), hash, papel]
);
console.log("Pronto:", rows[0].nome, `(${rows[0].papel})`);
