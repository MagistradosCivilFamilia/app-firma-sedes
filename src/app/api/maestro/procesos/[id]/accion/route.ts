import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import {
  getProceso,
  actualizarProceso,
  agregarFirmantes,
  listarFirmadosProc,
  marcarFinalEnviadoProc
} from "@/lib/procesos";
import { construirDocHtml, construirDocPdf } from "@/lib/docproceso";
import { enviarCorreo } from "@/lib/email";
import { esCorreoValido, normalizarCedula } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const no = exigirMaestro();
  if (no) return no;

  const proceso = await getProceso(params.id);
  if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const accion = String(body.accion ?? "");

  try {
    // --- Agregar firmantes -----------------------------------------------
    if (accion === "add_firmantes") {
      const filas = (Array.isArray(body.firmantes) ? body.firmantes : [])
        .map((f: any) => ({
          cedula: normalizarCedula(String(f.cedula ?? "")),
          nombre_completo: String(f.nombre_completo ?? "").trim(),
          opciones: Array.isArray(f.opciones)
            ? f.opciones.map((o: unknown) => String(o).trim()).filter(Boolean)
            : []
        }))
        .filter((f: any) => f.cedula && f.nombre_completo);
      if (filas.length === 0) return NextResponse.json({ error: "No hay firmantes válidos." }, { status: 400 });
      const n = await agregarFirmantes(params.id, filas);
      return NextResponse.json({ ok: true, agregados: n });
    }

    // --- Cerrar / reabrir -------------------------------------------------
    if (accion === "cerrar") {
      const p = await actualizarProceso(params.id, { cerrada: true, cerrada_en: new Date().toISOString() });
      return NextResponse.json({ ok: true, proceso: p });
    }
    if (accion === "reabrir") {
      if (proceso.enviada_en) {
        return NextResponse.json({ error: "No se puede reabrir: ya se envió el documento." }, { status: 409 });
      }
      const p = await actualizarProceso(params.id, { cerrada: false, cerrada_en: null });
      return NextResponse.json({ ok: true, proceso: p });
    }

    // --- Envío de PRUEBA (vista previa, sin afectar registros) ------------
    if (accion === "prueba") {
      const correo = String(body.correo ?? "").trim();
      if (!esCorreoValido(correo)) return NextResponse.json({ error: "Correo de prueba inválido." }, { status: 400 });
      const firmados = await listarFirmadosProc(params.id);
      const html = await construirDocHtml({ proceso, firmados, esPrueba: true });
      const pdf = await construirDocPdf({ proceso, firmados, esPrueba: true });
      await enviarCorreo({
        to: correo,
        subject: `[PRUEBA] ${proceso.nombre}`,
        html,
        attachments: [{ filename: "documento-PRUEBA.pdf", content: pdf, contentType: "application/pdf" }]
      });
      return NextResponse.json({ ok: true, enviado_a: correo });
    }

    // --- Envío FINAL (radicación) ----------------------------------------
    if (accion === "enviar") {
      if (!proceso.cerrada) {
        return NextResponse.json({ error: "Primero debe cerrar el proceso." }, { status: 409 });
      }
      const destinatarios = (proceso.destinatarios ?? []).filter((c) => esCorreoValido(c));
      if (destinatarios.length === 0) {
        return NextResponse.json({ error: "No hay destinatarios válidos." }, { status: 400 });
      }
      const firmados = await listarFirmadosProc(params.id);
      if (firmados.length === 0) {
        return NextResponse.json({ error: "No hay firmas; no hay documento que enviar." }, { status: 400 });
      }
      const cc = Array.from(
        new Set(firmados.map((f) => f.correo_digitado).filter((c): c is string => !!c && esCorreoValido(c)))
      );
      const html = await construirDocHtml({ proceso, firmados });
      const pdf = await construirDocPdf({ proceso, firmados });
      try {
        await enviarCorreo({
          to: destinatarios,
          cc,
          subject: proceso.nombre,
          html,
          attachments: [{ filename: "documento.pdf", content: pdf, contentType: "application/pdf" }]
        });
      } catch (e) {
        console.error("[procesos enviar]", e);
        return NextResponse.json({ error: "No se pudo enviar el correo. Intente de nuevo." }, { status: 502 });
      }
      const ahora = new Date().toISOString();
      await marcarFinalEnviadoProc(params.id, firmados.map((f) => f.cedula), ahora);
      const p = await actualizarProceso(params.id, { enviada_en: ahora, enviado_a: { para: destinatarios, cc } });
      return NextResponse.json({ ok: true, enviados_a: destinatarios, con_copia_a: cc, proceso: p });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (e) {
    console.error("[/api/maestro/procesos/[id]/accion]", e);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
