import QRCode from "qrcode";
import { env } from "./env";

// URL pública de trazabilidad para un traza_id.
export function trazaUrl(trazaId: string): string {
  return `${env.baseUrl}/t/${trazaId}`;
}

// QR como data URL (PNG base64) para incrustar en HTML/correo.
export async function qrDataUrl(contenido: string): Promise<string> {
  return QRCode.toDataURL(contenido, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220
  });
}
