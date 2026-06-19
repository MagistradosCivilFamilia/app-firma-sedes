import nodemailer from "nodemailer";
import { env } from "./env";

let _transport: nodemailer.Transporter | null = null;

function transport(): nodemailer.Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.gmailUser, pass: env.gmailAppPassword }
    });
  }
  return _transport;
}

function remitente(): string {
  return `"${env.mailFromName}" <${env.gmailUser}>`;
}

export interface AdjuntoCorreo {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export async function enviarCorreo(opts: {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: AdjuntoCorreo[];
}): Promise<void> {
  await transport().sendMail({
    from: remitente(),
    to: opts.to,
    cc: opts.cc && opts.cc.length > 0 ? opts.cc : undefined,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments
  });
}

// Verifica la conexión SMTP (para diagnóstico desde la consola del maestro).
export async function verificarSmtp(): Promise<{ ok: boolean; mensaje: string }> {
  try {
    await transport().verify();
    return { ok: true, mensaje: "Conexión con Gmail correcta." };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : String(e) };
  }
}

// --- Plantillas de correo ----------------------------------------------------

export function correoOtpHtml(params: {
  nombre: string;
  codigo: string;
  sede: string;
  esPrueba: boolean;
  vigenciaMin: number;
}): { subject: string; html: string; text: string } {
  const banner = params.esPrueba
    ? `<div style="background:#b45309;color:#fff;padding:8px 12px;border-radius:6px;font-weight:bold;margin-bottom:16px">MODO PRUEBA — este es un ensayo, no un trámite real</div>`
    : "";
  const subject = params.esPrueba
    ? "[PRUEBA] Código de verificación - firma opción de sede"
    : "Código de verificación - firma opción de sede";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1f2937">
    ${banner}
    <p>Respetado(a) <strong>${escapeHtml(params.nombre)}</strong>,</p>
    <p>Usted está a punto de firmar electrónicamente la carta de manifestación de sede de preferencia,
       con la sede elegida: <strong>${escapeHtml(params.sede)}</strong>.</p>
    <p>Su código de verificación de un solo uso es:</p>
    <p style="font-size:30px;letter-spacing:8px;font-weight:bold;text-align:center;
              background:#f1f5f9;padding:16px;border-radius:8px">${params.codigo}</p>
    <p>Este código vence en <strong>${params.vigenciaMin} minutos</strong>. Si usted no solicitó esta
       firma, ignore este mensaje.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:12px;color:#6b7280">Firma electrónica conforme a la Ley 527 de 1999 y el
       Decreto 2364 de 2012.</p>
  </div>`;
  const text = `${params.esPrueba ? "[MODO PRUEBA] " : ""}Código de verificación: ${params.codigo} (vence en ${params.vigenciaMin} minutos). Sede elegida: ${params.sede}.`;
  return { subject, html, text };
}

export function correoConfirmacionHtml(params: {
  nombre: string;
  sede: string;
  folioMostrado: string;
  fechaFirma: string;
  trazaUrl: string;
  esPrueba: boolean;
}): { subject: string; html: string; text: string } {
  const banner = params.esPrueba
    ? `<div style="background:#b45309;color:#fff;padding:8px 12px;border-radius:6px;font-weight:bold;margin-bottom:16px">MODO PRUEBA — este es un ensayo, no un trámite real</div>`
    : "";
  const subject = params.esPrueba
    ? "[PRUEBA] Confirmación de firma electrónica - opción de sede"
    : "Confirmación de firma electrónica - opción de sede";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1f2937">
    ${banner}
    <p>Respetado(a) <strong>${escapeHtml(params.nombre)}</strong>,</p>
    <p>Su firma electrónica quedó registrada correctamente.</p>
    <table style="border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Sede elegida</td><td><strong>${escapeHtml(params.sede)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Folio de firma</td><td><strong>${escapeHtml(params.folioMostrado)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Fecha y hora</td><td>${escapeHtml(params.fechaFirma)}</td></tr>
    </table>
    <p>Puede consultar la trazabilidad pública de su firma en el siguiente enlace:</p>
    <p><a href="${params.trazaUrl}">${params.trazaUrl}</a></p>
    <p>El documento colectivo final será radicado por el responsable del proceso; al radicarse, el
       oficio se enviará con copia a los correos de todos los firmantes.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:12px;color:#6b7280">Firma electrónica conforme a la Ley 527 de 1999 y el
       Decreto 2364 de 2012, validada con código de un solo uso enviado a su correo electrónico.</p>
  </div>`;
  const text = `${params.esPrueba ? "[MODO PRUEBA] " : ""}Su firma quedó registrada. Sede: ${params.sede}. Folio: ${params.folioMostrado}. Fecha: ${params.fechaFirma}. Trazabilidad: ${params.trazaUrl}`;
  return { subject, html, text };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
