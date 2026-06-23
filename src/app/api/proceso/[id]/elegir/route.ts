import { NextRequest, NextResponse } from "next/server";
import { getProceso, getFirmante, guardarEleccionProc } from "@/lib/procesos";
import { normalizarCedula } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proceso = await getProceso(params.id);
    if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });
    if (proceso.cerrada) {
      return NextResponse.json({ error: "El proceso ya fue cerrado." }, { status: 409 });
    }

    const body = await req.json();
    const ced = normalizarCedula(String(body.cedula ?? ""));
    const elegida = String(body.elegida ?? "").trim();

    const f = await getFirmante(params.id, ced);
    if (!f) return NextResponse.json({ error: "Cédula no encontrada." }, { status: 404 });
    if (f.firmado) return NextResponse.json({ error: "Usted ya firmó." }, { status: 409 });

    if (!f.opciones.includes(elegida)) {
      return NextResponse.json({ error: "La opción seleccionada no es válida." }, { status: 400 });
    }
    await guardarEleccionProc(params.id, ced, elegida);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[/api/proceso/elegir]", e);
    return NextResponse.json({ error: "Ocurrió un error. Intente de nuevo." }, { status: 500 });
  }
}
