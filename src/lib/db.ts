import { neon } from "@neondatabase/serverless";

// Uma conexão HTTP por requisição (serverless). DATABASE_URL vem do .env.local / Vercel.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não configurada");

const sql = neon(url);

export type Row = Record<string, any>;

export async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await sql.query(text, params)) as Row[];
}
