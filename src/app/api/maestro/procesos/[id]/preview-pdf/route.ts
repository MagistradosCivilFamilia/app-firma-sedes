import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getProceso, listarFirmadosProc } from "@/lib/procesos";
import { construirDocPdf } from "@/lib/docproceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const no = exigirMaestro();
  if (no) return no;
  const proceso = await getProceso(params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });
  const firmados = await listarFirmadosProc(params.id);
  const pdf = await construirDocPdf({ proceso, firmados });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=documento.pdf" }
  });
}
