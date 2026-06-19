import { NextRequest, NextResponse } from "next/server";
import { getModo } from "@/lib/env";
import {
  getPorCedula,
  incrementarIntentos,
  firmar,
  marcarCorreoConfirmacion
} from "@/lib/repo";
import { normalizarCedula, getIp } from "@/lib/util";
import { verificarOtp, OTP_MAX_INTENTOS } from "@/lib/otp";
import { enviarCorreo, correoConfirmacionHtml } from "@/lib/email";
import { audit } from "@/lib/audit";
import { modoConfig, folioMostrado } from "@/lib/mode";
import { trazaUrl } from "@/lib/qr";
import { fechaHora } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ced = normalizarCedula(String(body.cedula ?? ""));
    const codigo = String(body.codigo ?? "").trim();

    const modo = getModo();
    const ip = getIp(req);

    const p = await getPorCedula(modo, ced);
    if (!p) return NextResponse.json({ error: "Cédula no encontrada." }, { status: 404 });

    // Idempotencia: si ya firmó, devolvemos su resultado sin reprocesar.
    if (p.firmado) {
      return NextResponse.json({
        ok: true,
        ya_firmado: true,
        folio_mostrado: folioMostrado(p.folio, modo),
        fecha_firma: fechaHora(p.otp_validado_en),
        traza_url: trazaUrl(p.traza_id)
      });
    }

    if (!p.codigo_otp_hash || !p.otp_expira_en) {
      return NextResponse.json(
        { error: "No hay un código vigente. Solicite un nuevo código." },
        { status: 400 }
      );
    }

    // Expiración.
    if (new Date(p.otp_expira_en).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "El código expiró. Solicite uno nuevo.", expirado: true },
        { status: 400 }
      );
    }

    // Bloqueo por intentos.
    if (p.otp_intentos >= OTP_MAX_INTENTOS) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Solicite un nuevo código.", bloqueado: true },
        { status: 429 }
      );
    }

    const correcto = await verificarOtp(codigo, p.codigo_otp_hash);
    if (!correcto) {
      await incrementarIntentos(modo, ced, p.otp_intentos);
      await audit({ modo, accion: "otp_fallido", cedula: ced, traza_id: p.traza_id, ip });
      const restantes = OTP_MAX_INTENTOS - (p.otp_intentos + 1);
      return NextResponse.json(
        {
          error:
            restantes > 0
              ? `Código incorrecto. Le quedan ${restantes} intento(s).`
              : "Código incorrecto. Se agotaron los intentos; solicite un nuevo código.",
          intentos_restantes: Math.max(0, restantes)
        },
        { status: 400 }
      );
    }

    // Código correcto -> firma atómica (asigna folio por secuencia).
    let folio: number;
    let validadoEn: string;
    try {
      const r = await firmar(modo, ced);
      folio = r.folio;
      validadoEn = r.validadoEn;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("CARTA_CERRADA")) {
        return NextResponse.json({ error: "La carta ya fue cerrada. No es posible firmar." }, { status: 409 });
      }
      throw e;
    }

    const folioStr = folioMostrado(folio, modo);
    const url = trazaUrl(p.traza_id);

    await audit({
      modo,
      accion: "firma",
      cedula: ced,
      traza_id: p.traza_id,
      detalle: { folio, sede: p.sede_elegida },
      ip
    });

    // Correo de confirmación de firma (no el documento final).
    try {
      const tpl = correoConfirmacionHtml({
        nombre: p.nombre_completo,
        sede: p.sede_elegida ?? "—",
        folioMostrado: folioStr,
        fechaFirma: fechaHora(validadoEn),
        trazaUrl: url,
        esPrueba: modoConfig(modo).esPrueba
      });
      await enviarCorreo({
        to: p.correo_digitado!,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text
      });
      await marcarCorreoConfirmacion(modo, ced);
      await audit({ modo, accion: "correo_confirmacion", cedula: ced, traza_id: p.traza_id, ip });
    } catch (e) {
      // La firma ya quedó registrada; el correo de confirmación es secundario.
      console.error("[/api/otp/validar] no se pudo enviar confirmación:", e);
    }

    return NextResponse.json({
      ok: true,
      folio_mostrado: folioStr,
      fecha_firma: fechaHora(validadoEn),
      traza_url: url
    });
  } catch (e) {
    console.error("[/api/otp/validar]", e);
    return NextResponse.json({ error: "Ocurrió un error al validar el código." }, { status: 500 });
  }
}
