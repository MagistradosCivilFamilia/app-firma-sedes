import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getProceso, actualizarProceso, listarFirmantesProc } from "@/lib/procesos";
import { trazaUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const no = exigirMaestro();
  if (no) return no;
  const proceso = await getProceso(params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });
  const firmantes = await listarFirmantesProc(params.id);
  return NextResponse.json({
    proceso,
    firmantes: firmantes.map((f) => ({
      cedula: f.cedula,
      nombre_completo: f.nombre_completo,
      opciones: f.opciones,
      elegida: f.elegida,
      ingreso_en: f.ingreso_en,
      firmado: f.firmado,
      folio: f.folio,
      correo_digitado: f.correo_digitado,
      otp_validado_en: f.otp_validado_en,
      traza_url: f.firmado ? trazaUrl(f.traza_id) : null
    })),
    total: firmantes.length,
    firmados: firmantes.filter((f) => f.firmado).length
  });
}

// Edita los campos del proceso (nombre, documento, opciones, destinatarios).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const no = exigirMaestro();
  if (no) return no;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const k of ["nombre", "doc_titulo", "doc_encabezado", "doc_cuerpo", "etiqueta_opcion"]) {
    if (typeof body[k] === "string") patch[k] = body[k];
  }
  if (typeof body.tiene_opciones === "boolean") patch.tiene_opciones = body.tiene_opciones;
  if (Array.isArray(body.destinatarios)) {
    patch.destinatarios = body.destinatarios.map((x: unknown) => String(x).trim()).filter(Boolean);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No hay cambios." }, { status: 400 });
  }
  const proceso = await actualizarProceso(params.id, patch);
  return NextResponse.json({ ok: true, proceso });
}
