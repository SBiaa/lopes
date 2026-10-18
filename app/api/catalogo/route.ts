import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protegido, corpo, erro, norm } from "@/lib/http";

// GET: cores e tamanhos ativos, na ordem de separação.
export const GET = protegido(async () => {
  const [cores, tamanhos] = await Promise.all([
    query("SELECT id, nome, ordem FROM cores WHERE ativo ORDER BY ordem, id"),
    query("SELECT id, nome, ordem FROM tamanhos WHERE ativo ORDER BY ordem, id"),
  ]);
  return NextResponse.json({ cores, tamanhos });
});

function limpar(v: unknown, maiusculo: boolean): string[] | null {
  if (!Array.isArray(v) || v.length > 200) return null;
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const n = String(x ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!n) continue;
    const k = norm(n);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(maiusculo ? n.toUpperCase() : n);
  }
  return out;
}

// PUT: substitui as listas (a ordem do array vira a ordem de separação).
// Quem sai da lista é só desativado: o histórico e o estoque ficam preservados.
export const PUT = protegido(async (req) => {
  const b = await corpo<{ cores?: unknown; tamanhos?: unknown }>(req);
  const cores = limpar(b?.cores, false);
  const tamanhos = limpar(b?.tamanhos, true);
  if (!cores || !tamanhos) return erro("Envie as listas de cores e tamanhos.");

  await query(
    `WITH inp AS (SELECT n AS nome, o::int AS ordem FROM unnest($1::text[]) WITH ORDINALITY AS t(n, o)),
          up AS (INSERT INTO cores (nome, ordem, ativo) SELECT nome, ordem, true FROM inp
                 ON CONFLICT (lower(nome)) DO UPDATE SET ordem = EXCLUDED.ordem, ativo = true RETURNING id)
     UPDATE cores SET ativo = false WHERE ativo AND id NOT IN (SELECT id FROM up)`,
    [cores]
  );
  await query(
    `WITH inp AS (SELECT n AS nome, o::int AS ordem FROM unnest($1::text[]) WITH ORDINALITY AS t(n, o)),
          up AS (INSERT INTO tamanhos (nome, ordem, ativo) SELECT nome, ordem, true FROM inp
                 ON CONFLICT (upper(nome)) DO UPDATE SET ordem = EXCLUDED.ordem, ativo = true RETURNING id)
     UPDATE tamanhos SET ativo = false WHERE ativo AND id NOT IN (SELECT id FROM up)`,
    [tamanhos]
  );
  return NextResponse.json({ ok: true });
});
