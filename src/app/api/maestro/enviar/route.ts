import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import { getEstado, listarFirmantes, actualizarEstado, marcarCorreoFinalEnviado } from "@/lib/repo";
import { construirCartaHtml } from "@/lib/letter";
import { enviarCorreo } from "@/lib/email";
import { esCorreoValido, getIp } from "@/lib/util";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const no = exigirMaestro();
  if (no) return no;

  const modo = getModo();
  const estado = await getEstado(modo);

  // Reglas: la carta debe estar cerrada antes de enviar el documento final.
  if (!estado.carta_cerrada) {
    return NextResponse.json(
      { error: "Primero debe cerrar la carta antes de enviar el documento final." },
      { status: 409 }
    );
  }

  const destinatarios = (estado.destinatarios ?? []).filter((c) => esCorreoValido(c));
  if (destinatarios.length === 0) {
    return NextResponse.json(
      { error: "No hay destinatarios válidos configurados. Edítelos antes de enviar." },
      { status: 400 }
    );
  }

  const firmantes = await listarFirmantes(modo);
  if (firmantes.length === 0) {
    return NextResponse.json({ error: "No hay firmantes; no hay documento que enviar." }, { status: 400 });
  }

  // CC a los correos de quienes firmaron (únicos y válidos).
  const cc = Array.from(
    new Set(firmantes.map((f) => f.correo_digitado).filter((c): c is string => !!c && esCorreoValido(c)))
  );

  const html = await construirCartaHtml({ modo, estado, firmantes });

  const asunto =
    (modo === "prueba" ? "[PRUEBA] " : "") +
    "Manifestación de sedes de preferencia - Sala Civil-Familia";

  try {
    await enviarCorreo({
      to: destinatarios,
      cc,
      subject: asunto,
      html,
      attachments: [
        {
          filename: modo === "prueba" ? "carta-sedes-PRUEBA.html" : "carta-sedes.html",
          content: html,
          contentType: "text/html"
        }
      ]
    });
  } catch (e) {
    console.error("[/api/maestro/enviar] fallo SMTP:", e);
    return NextResponse.json(
      { error: "No se pudo enviar el correo. Verifique la conexión con Gmail e intente de nuevo." },
      { status: 502 }
    );
  }

  const ahora = new Date().toISOString();
  await marcarCorreoFinalEnviado(
    modo,
    firmantes.map((f) => f.cedula),
    ahora
  );
  const nuevoEstado = await actualizarEstado(modo, { enviada_en: ahora });
  await audit({
    modo,
    accion: "documento_enviado",
    detalle: { destinatarios, cc, firmantes: firmantes.length },
    ip: getIp(req)
  });

  return NextResponse.json({
    ok: true,
    enviados_a: destinatarios,
    con_copia_a: cc,
    firmantes: firmantes.length,
    estado: nuevoEstado
  });
}
