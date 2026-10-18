import { NextResponse } from "next/server";
import { sessaoAtual, type Sessao } from "./auth";

export const erro = (mensagem: string, status = 400) => NextResponse.json({ erro: mensagem }, { status });

type Handler<C> = (req: Request, sessao: Sessao, ctx: C) => Promise<Response>;

// Exige login (e, opcionalmente, papel admin). Converte exceções em 500 sem vazar detalhes.
export function protegido<C = unknown>(handler: Handler<C>, opts: { admin?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    const s = await sessaoAtual();
    if (!s) return erro("Entre com seu nome e PIN.", 401);
    if (opts.admin && s.papel !== "admin") return erro("Só o administrador pode fazer isso.", 403);
    try {
      return await handler(req, s, ctx);
    } catch (e) {
      console.error(e);
      return erro("Algo deu errado no servidor.", 500);
    }
  };
}

export async function corpo<T = any>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
