import { NextRequest, NextResponse } from "next/server";
import { getModo } from "@/lib/env";
import { getPorCedula, guardarOtp, getEstado } from "@/lib/repo";
import { normalizarCedula, esCorreoValido, getIp } from "@/lib/util";
import { generarOtp, hashOtp, expiraEn, OTP_VIGENCIA_MIN } from "@/lib/otp";
import { enviarCorreo, correoOtpHtml } from "@/lib/email";
import { limitar } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { modoConfig } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ced = normalizarCedula(String(body.cedula ?? ""));
    const correo = String(body.correo ?? "").trim();

    if (!esCorreoValido(correo)) {
      return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });
    }

    const modo = getModo();
    const ip = getIp(req);

    // Rate limiting: por cédula (3 / 10 min) y por IP (10 / 10 min).
    const porCedula = limitar(`otp:ced:${ced}`, 3, 10 * 60_000);
    if (!porCedula.ok) {
      return NextResponse.json(
        { error: `Demasiados envíos. Espere ${porCedula.esperaSeg} segundos antes de pedir otro código.` },
        { status: 429 }
      );
    }
    const porIp = limitar(`otp:ip:${ip}`, 10, 10 * 60_000);
    if (!porIp.ok) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intente más tarde." }, { status: 429 });
    }

    const estado = await getEstado(modo);
    if (estado.carta_cerrada) {
      return NextResponse.json({ error: "La carta ya fue cerrada. No es posible firmar." }, { status: 409 });
    }

    const p = await getPorCedula(modo, ced);
    if (!p) return NextResponse.json({ error: "Cédula no encontrada." }, { status: 404 });
    if (p.firmado) {
      return NextResponse.json({ error: "Usted ya firmó este documento." }, { status: 409 });
    }
    if (!p.sede_elegida) {
      return NextResponse.json({ error: "Primero debe elegir/confirmar su sede." }, { status: 400 });
    }

    const codigo = generarOtp();
    const hash = await hashOtp(codigo);
    const ahora = new Date();
    await guardarOtp(modo, ced, {
      correo,
      hash,
      enviadoEn: ahora.toISOString(),
      expiraEn: expiraEn(ahora).toISOString()
    });

    const tpl = correoOtpHtml({
      nombre: p.nombre_completo,
      codigo,
      sede: p.sede_elegida,
      esPrueba: modoConfig(modo).esPrueba,
      vigenciaMin: OTP_VIGENCIA_MIN
    });
    await enviarCorreo({ to: correo, subject: tpl.subject, html: tpl.html, text: tpl.text });

    await audit({
      modo,
      accion: "otp_enviado",
      cedula: ced,
      traza_id: p.traza_id,
      detalle: { correo },
      ip
    });

    return NextResponse.json({ ok: true, vigencia_min: OTP_VIGENCIA_MIN, correo });
  } catch (e) {
    console.error("[/api/otp/enviar]", e);
    return NextResponse.json(
      { error: "No se pudo enviar el código. Verifique el correo o intente más tarde." },
      { status: 500 }
    );
  }
}
