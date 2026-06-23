import { NextRequest, NextResponse } from "next/server";
import { getProceso, getFirmante, incrementarIntentosProc, firmarProc, marcarConfirmacionProc } from "@/lib/procesos";
import { normalizarCedula, getIp } from "@/lib/util";
import { verificarOtp, OTP_MAX_INTENTOS } from "@/lib/otp";
import { enviarCorreo, escapeHtml } from "@/lib/email";
import { trazaUrl } from "@/lib/qr";
import { fechaHora } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proceso = await getProceso(params.id);
    if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });

    const body = await req.json();
    const ced = normalizarCedula(String(body.cedula ?? ""));
    const codigo = String(body.codigo ?? "").trim();

    const f = await getFirmante(params.id, ced);
    if (!f) return NextResponse.json({ error: "Cédula no encontrada." }, { status: 404 });

    if (f.firmado) {
      return NextResponse.json({
        ok: true,
        ya_firmado: true,
        folio_mostrado: f.folio != null ? String(f.folio).padStart(2, "0") : "—",
        fecha_firma: fechaHora(f.otp_validado_en),
        traza_url: trazaUrl(f.traza_id)
      });
    }

    if (!f.codigo_otp_hash || !f.otp_expira_en) {
      return NextResponse.json({ error: "No hay un código vigente. Solicite uno nuevo." }, { status: 400 });
    }
    if (new Date(f.otp_expira_en).getTime() < Date.now()) {
      return NextResponse.json({ error: "El código expiró. Solicite uno nuevo.", expirado: true }, { status: 400 });
    }
    if (f.otp_intentos >= OTP_MAX_INTENTOS) {
      return NextResponse.json({ error: "Demasiados intentos. Solicite un nuevo código.", bloqueado: true }, { status: 429 });
    }

    const ok = await verificarOtp(codigo, f.codigo_otp_hash);
    if (!ok) {
      await incrementarIntentosProc(params.id, ced, f.otp_intentos);
      const restantes = OTP_MAX_INTENTOS - (f.otp_intentos + 1);
      return NextResponse.json(
        {
          error:
            restantes > 0
              ? `Código incorrecto. Le quedan ${restantes} intento(s).`
              : "Código incorrecto. Se agotaron los intentos; solicite uno nuevo.",
          intentos_restantes: Math.max(0, restantes)
        },
        { status: 400 }
      );
    }

    let folio: number;
    let validadoEn: string;
    try {
      const r = await firmarProc(params.id, ced);
      folio = r.folio;
      validadoEn = r.validadoEn;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("CARTA_CERRADA")) {
        return NextResponse.json({ error: "El proceso ya fue cerrado. No es posible firmar." }, { status: 409 });
      }
      throw e;
    }

    const folioStr = String(folio).padStart(2, "0");
    const url = trazaUrl(f.traza_id);

    try {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
          <p>Respetado(a) <strong>${escapeHtml(f.nombre_completo)}</strong>,</p>
          <p>Su firma electrónica en <strong>${escapeHtml(proceso.nombre)}</strong> quedó registrada.</p>
          <table style="border-collapse:collapse;margin:12px 0">
            ${f.elegida ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Opción elegida</td><td><strong>${escapeHtml(f.elegida)}</strong></td></tr>` : ""}
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Folio</td><td><strong>${folioStr}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Fecha y hora</td><td>${escapeHtml(fechaHora(validadoEn))}</td></tr>
          </table>
          <p>Trazabilidad pública: <a href="${url}">${url}</a></p>
          <p style="font-size:12px;color:#6b7280">Firma electrónica conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.</p>
        </div>`;
      await enviarCorreo({ to: f.correo_digitado!, subject: `Confirmación de firma - ${proceso.nombre}`, html });
      await marcarConfirmacionProc(params.id, ced);
    } catch (e) {
      console.error("[/api/proceso/otp/validar] confirmación:", e);
    }

    return NextResponse.json({ ok: true, folio_mostrado: folioStr, fecha_firma: fechaHora(validadoEn), traza_url: url });
  } catch (e) {
    console.error("[/api/proceso/otp/validar]", e);
    return NextResponse.json({ error: "Ocurrió un error al validar el código." }, { status: 500 });
  }
}
