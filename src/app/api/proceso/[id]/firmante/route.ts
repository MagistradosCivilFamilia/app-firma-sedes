import { NextRequest, NextResponse } from "next/server";
import { getProceso, getFirmante, marcarIngresoProc } from "@/lib/procesos";
import { normalizarCedula } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function docPublico(p: NonNullable<Awaited<ReturnType<typeof getProceso>>>) {
  return {
    nombre: p.nombre,
    doc_titulo: p.doc_titulo,
    doc_encabezado: p.doc_encabezado,
    doc_cuerpo: p.doc_cuerpo,
    tiene_opciones: p.tiene_opciones,
    etiqueta_opcion: p.etiqueta_opcion,
    cerrada: p.cerrada
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proceso = await getProceso(params.id);
    if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });

    const { cedula } = await req.json();
    const ced = normalizarCedula(String(cedula ?? ""));
    if (!ced) return NextResponse.json({ error: "Digite un número de cédula válido." }, { status: 400 });

    const f = await getFirmante(params.id, ced);
    if (!f) {
      return NextResponse.json(
        { error: "Cédula no encontrada en este proceso. Contacte al administrador." },
        { status: 404 }
      );
    }
    await marcarIngresoProc(params.id, ced);

    return NextResponse.json({
      documento: docPublico(proceso),
      firmante: {
        cedula: f.cedula,
        nombre_completo: f.nombre_completo,
        opciones: f.opciones,
        elegida: f.elegida,
        tiene_opciones: proceso.tiene_opciones && (f.opciones?.length ?? 0) > 0,
        firmado: f.firmado,
        folio_mostrado: f.firmado && f.folio != null ? String(f.folio).padStart(2, "0") : null,
        correo_digitado: f.correo_digitado
      }
    });
  } catch (e) {
    console.error("[/api/proceso/firmante]", e);
    return NextResponse.json({ error: "Ocurrió un error. Intente de nuevo." }, { status: 500 });
  }
}
