import { NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { verificarSmtp } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico: verifica que las credenciales de Gmail funcionan.
export async function GET() {
  const no = exigirMaestro();
  if (no) return no;
  const r = await verificarSmtp();
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
