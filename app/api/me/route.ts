import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/auth";

export async function GET() {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ erro: "Entre com seu nome e PIN." }, { status: 401 });
  return NextResponse.json(s);
}
