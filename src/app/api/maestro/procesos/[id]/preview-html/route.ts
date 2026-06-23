import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getProceso, listarFirmadosProc } from "@/lib/procesos";
import { construirDocHtml } from "@/lib/docproceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const no = exigirMaestro();
  if (no) return no;
  const proceso = await getProceso(params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });
  const firmados = await listarFirmadosProc(params.id);
  const html = await construirDocHtml({ proceso, firmados });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
