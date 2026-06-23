import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { crearProceso, listarProcesos, agregarFirmantes, listarFirmantesProc } from "@/lib/procesos";
import { normalizarCedula } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista de procesos con un resumen (total firmantes / firmados).
export async function GET() {
  const no = exigirMaestro();
  if (no) return no;
  const procesos = await listarProcesos();
  const resumen = await Promise.all(
    procesos.map(async (p) => {
      const fs = await listarFirmantesProc(p.id);
      return {
        ...p,
        total: fs.length,
        firmados: fs.filter((f) => f.firmado).length
      };
    })
  );
  return NextResponse.json({ procesos: resumen });
}

// Crea un proceso nuevo (con su documento y, opcionalmente, sus firmantes).
export async function POST(req: NextRequest) {
  const no = exigirMaestro();
  if (no) return no;
  const body = await req.json().catch(() => ({}));

  if (!body.nombre || String(body.nombre).trim() === "") {
    return NextResponse.json({ error: "El proceso necesita un nombre." }, { status: 400 });
  }

  const proceso = await crearProceso({
    nombre: String(body.nombre).trim(),
    doc_titulo: body.doc_titulo ? String(body.doc_titulo).trim() : null,
    doc_encabezado: body.doc_encabezado ? String(body.doc_encabezado) : null,
    doc_cuerpo: body.doc_cuerpo ? String(body.doc_cuerpo) : null,
    tiene_opciones: !!body.tiene_opciones,
    etiqueta_opcion: body.etiqueta_opcion ? String(body.etiqueta_opcion).trim() : "Opción de preferencia",
    destinatarios: Array.isArray(body.destinatarios)
      ? body.destinatarios.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []
  });

  // Firmantes opcionales en la creación.
  if (Array.isArray(body.firmantes) && body.firmantes.length > 0) {
    const filas = body.firmantes
      .map((f: any) => ({
        cedula: normalizarCedula(String(f.cedula ?? "")),
        nombre_completo: String(f.nombre_completo ?? "").trim(),
        opciones: Array.isArray(f.opciones) ? f.opciones.map((o: unknown) => String(o).trim()).filter(Boolean) : []
      }))
      .filter((f: any) => f.cedula && f.nombre_completo);
    if (filas.length > 0) await agregarFirmantes(proceso.id, filas);
  }

  return NextResponse.json({ ok: true, proceso });
}
