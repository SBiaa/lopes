import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "lopes_sessao";
const DIAS = 30;

export type Sessao = { id: string; nome: string; papel: "admin" | "operador" };

function chave() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(s);
}

export async function criarSessao(u: Sessao) {
  const token = await new SignJWT({ nome: u.nome, papel: u.papel })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS * 86400,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    if (!payload.sub) return null;
    return { id: payload.sub, nome: String(payload.nome), papel: payload.papel === "admin" ? "admin" : "operador" };
  } catch {
    return null;
  }
}
