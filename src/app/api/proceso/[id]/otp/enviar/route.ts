import { NextRequest, NextResponse } from "next/server";
import { getProceso, getFirmante, guardarOtpProc } from "@/lib/procesos";
import { normalizarCedula, esCorreoValido, getIp } from "@/lib/util";
import { generarOtp, hashOtp, expiraEn, OTP_VIGENCIA_MIN } from "@/lib/otp";
import { enviarCorreo, escapeHtml } from "@/lib/email";
import { limitar } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proceso = await getProceso(params.id);
    if (!proceso) return NextResponse.json({ error: "Proceso no encontrado." }, { status: 404 });
    if (proceso.cerrada) return NextResponse.json({ error: "El proceso ya fue cerrado." }, { status: 409 });

    const body = await req.json();
    const ced = normalizarCedula(String(body.cedula ?? ""));
    const correo = String(body.correo ?? "").trim();
    if (!esCorreoValido(correo)) {
      return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });
    }

    const ip = getIp(req);
    const lim = limitar(`potp:${params.id}:${ced}`, 3, 10 * 60_000);
    if (!lim.ok) {
      return NextResponse.json(
        { error: `Demasiados envíos. Espere ${lim.esperaSeg} segundos.` },
        { status: 429 }
      );
    }
    if (!limitar(`potp:ip:${ip}`, 12, 10 * 60_000).ok) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intente más tarde." }, { status: 429 });
    }

    const f = await getFirmante(params.id, ced);
    if (!f) return NextResponse.json({ error: "Cédula no encontrada." }, { status: 404 });
    if (f.firmado) return NextResponse.json({ error: "Usted ya firmó." }, { status: 409 });
    if (proceso.tiene_opciones && (f.opciones?.length ?? 0) > 0 && !f.elegida) {
      return NextResponse.json({ error: "Primero debe elegir una opción." }, { status: 400 });
    }

    const codigo = generarOtp();
    const hash = await hashOtp(codigo);
    const ahora = new Date();
    await guardarOtpProc(params.id, ced, {
      correo,
      hash,
      enviadoEn: ahora.toISOString(),
      expiraEn: expiraEn(ahora).toISOString()
    });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <p>Respetado(a) <strong>${escapeHtml(f.nombre_completo)}</strong>,</p>
        <p>Su código de verificación para firmar el documento
           <strong>${escapeHtml(proceso.nombre)}</strong>${f.elegida ? ` (opción: <strong>${escapeHtml(f.elegida)}</strong>)` : ""} es:</p>
        <p style="font-size:30px;letter-spacing:8px;font-weight:bold;text-align:center;background:#f1f5f9;padding:16px;border-radius:8px">${codigo}</p>
        <p>Este código vence en <strong>${OTP_VIGENCIA_MIN} minutos</strong>.</p>
        <p style="font-size:12px;color:#6b7280">Firma electrónica conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.</p>
      </div>`;
    await enviarCorreo({
      to: correo,
      subject: `Código de verificación - ${proceso.nombre}`,
      html,
      text: `Su código de verificación es: ${codigo} (vence en ${OTP_VIGENCIA_MIN} minutos).`
    });

    return NextResponse.json({ ok: true, vigencia_min: OTP_VIGENCIA_MIN, correo });
  } catch (e) {
    console.error("[/api/proceso/otp/enviar]", e);
    return NextResponse.json({ error: "No se pudo enviar el código. Intente más tarde." }, { status: 500 });
  }
}
