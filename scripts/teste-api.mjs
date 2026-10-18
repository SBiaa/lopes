// Teste de ponta a ponta da API (servidor rodando em http://localhost:3000).
// Uso: TEST_USER="teste-api" TEST_PIN=123456 npm run teste-api
// Usa a cor "ZZ Teste" e o tamanho "ZZ"; depois do teste, apague esses itens e o usuário de teste.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const USER = process.env.TEST_USER, PIN = process.env.TEST_PIN;
if (!USER || !PIN) { console.error("Defina TEST_USER e TEST_PIN."); process.exit(1); }

let cookie = "";
async function api(path, { method = "GET", body, semCookie } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie && !semCookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.get("set-cookie");
  if (sc && !semCookie) cookie = sc.split(";")[0];
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
let falhas = 0;
const ok = (cond, nome, extra = "") => { console.log((cond ? "  ok  " : " FALHA") + " " + nome + (cond ? "" : " -> " + extra)); if (!cond) falhas++; };

const run = Date.now();
const k1 = `teste-${run}-a`, k2 = `teste-${run}-b`, k3 = `teste-${run}-c`;
const item = (qtd) => [{ cor: "ZZ Teste", tamanho: "zz", qtd }];

console.log("Autenticação");
ok((await api("/api/estoque", { semCookie: true })).status === 401, "sem login -> 401");
ok((await api("/api/auth/login", { method: "POST", body: { nome: USER, pin: "000000" }, semCookie: true })).status === 401, "PIN errado -> 401");
const lg = await api("/api/auth/login", { method: "POST", body: { nome: USER, pin: PIN } });
ok(lg.status === 200 && lg.json?.papel === "admin", "login correto", JSON.stringify(lg));
ok((await api("/api/me")).status === 200, "/api/me com sessão");

console.log("Catálogo");
const cat = await api("/api/catalogo");
ok(cat.json?.cores?.length >= 10 && cat.json?.tamanhos?.length >= 4, "lista cores e tamanhos", JSON.stringify(cat.json).slice(0, 120));

console.log("Baixa");
const b1 = await api("/api/baixas", { method: "POST", body: { pedidos: [
  { chave: k1, itens: item(2) }, { chave: k2, itens: item(1) }, { chave: k1, itens: item(2) } ] } });
ok(b1.status === 200 && b1.json.aplicados.length === 2 && b1.json.loteId, "aplica 2 pedidos (chave repetida no envio é ignorada)", JSON.stringify(b1.json));
const lote = b1.json?.loteId;
const b2 = await api("/api/baixas", { method: "POST", body: { pedidos: [{ chave: k1, itens: item(2) }, { chave: k2, itens: item(1) }] } });
ok(b2.json?.aplicados.length === 0 && b2.json.ignorados.length === 2 && b2.json.loteId === null, "mesmos pedidos de novo: nada aplicado", JSON.stringify(b2.json));
const v = await api("/api/baixas/verificar", { method: "POST", body: { chaves: [k1, k2, k3] } });
ok(v.json?.jaBaixadas.length === 2 && !v.json.jaBaixadas.includes(k3), "verificar mostra só os já baixados", JSON.stringify(v.json));

const cel = (est) => {
  const c = est.cores.find((x) => x.nome === "ZZ Teste"), t = est.tamanhos.find((x) => x.nome === "ZZ");
  return { c, t, q: est.itens.find((i) => i.cor_id === c?.id && i.tamanho_id === t?.id)?.quantidade };
};
let est = (await api("/api/estoque")).json;
let z = cel(est);
ok(z.q === -3, "estoque ZZ = -3 depois da baixa", String(z.q));

console.log("Ajuste");
const aj = await api("/api/estoque/ajuste", { method: "POST", body: { cor_id: z.c.id, tamanho_id: z.t.id, quantidade: 10 } });
ok(aj.status === 200 && aj.json.quantidade === 10 && aj.json.delta === 13, "ajuste para 10 (delta +13)", JSON.stringify(aj.json));
const aj2 = await api("/api/estoque/ajuste", { method: "POST", body: { cor_id: z.c.id, tamanho_id: z.t.id, quantidade: 10 } });
ok(aj2.json?.delta === null, "ajuste igual não gera movimento", JSON.stringify(aj2.json));

console.log("Desfazer");
const d1 = await api(`/api/baixas/${lote}/desfazer`, { method: "POST" });
ok(d1.status === 200 && d1.json.pecas === 3, "desfaz a baixa", JSON.stringify(d1));
z = cel((await api("/api/estoque")).json);
ok(z.q === 13, "estoque volta (+3 sobre os 10 ajustados)", String(z.q));
ok((await api(`/api/baixas/${lote}/desfazer`, { method: "POST" })).status === 404, "desfazer de novo -> 404");
const b3 = await api("/api/baixas", { method: "POST", body: { pedidos: [{ chave: k1, itens: item(2) }] } });
ok(b3.json?.aplicados.length === 1, "pedido liberado pode ser baixado de novo", JSON.stringify(b3.json));

console.log("Concorrência");
const rs = await Promise.all([1, 2, 3].map(() => api("/api/baixas", { method: "POST", body: { pedidos: [{ chave: k3, itens: item(1) }] } })));
const aplic = rs.filter((r) => r.json?.aplicados?.length === 1).length;
ok(aplic === 1, "3 baixas simultâneas da mesma chave: só 1 aplica", JSON.stringify(rs.map((r) => r.json?.aplicados?.length)));

console.log("Histórico e usuários");
const mv = await api("/api/movimentos?limite=10");
ok(mv.status === 200 && mv.json.movimentos.length > 0, "histórico lista movimentos");
const us = await api("/api/usuarios");
ok(us.status === 200 && us.json.usuarios.some((u) => u.nome.toLowerCase() === USER.toLowerCase()), "admin lista usuários");
ok((await api("/api/usuarios", { method: "POST", body: { nome: "x", pin: "12" } })).status === 400, "PIN curto é recusado");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
