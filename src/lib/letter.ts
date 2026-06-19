import type { Participante, ProcesoEstado } from "./types";
import type { Modo } from "./env";
import { folioMostrado } from "./mode";
import { fechaHora, fechaLarga } from "./format";
import { qrDataUrl } from "./qr";
import { trazaUrl } from "./qr";
import { escapeHtml } from "./email";

// Texto fijo de la carta (membrete y redacción tomados del Word original).
// La nota legal es LITERAL y no debe reformularse.
export const NOTA_LEGAL =
  "Firma electrónica conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012, validada con código de un solo uso enviado al correo electrónico del firmante. Al radicarse, el oficio se enviará con copia a los correos de todos los firmantes";

export const PRESIDENTE = "IVÁN MAURICIO LENIS GÓMEZ";

export const PARRAFO_2 =
  "Con el fin de facilitar la labor del nominador, cada firmante relaciona a continuación la sede y la sala de su preferencia, y ruega de manera atenta a la Honorable Sala Plena que esta manifestación sea tenida en cuenta al momento de efectuar las designaciones, en aras de los principios de mérito, eficiencia y buen servicio de la administración de justicia.";

// Párrafo 1 en texto plano (sin HTML). El HTML lo escapa donde se usa.
export function parrafo1Texto(frase: string): string {
  return (
    "Los abajo firmantes, en calidad de integrantes de las listas formuladas ante esa Corporación por la " +
    "Presidencia del Consejo Superior de la Judicatura para proveer los cargos de Magistrado de Tribunal " +
    "Superior de Distrito Judicial – Sala Civil – Familia (Acuerdos No. PCSJA26 – 12490, 12489, 12488, " +
    "12487, 12486, 12485, 12484, 12483, 12482 de 17 de junio de 2026), acudimos de forma respetuosa a " +
    frase +
    ", rogando que esta elección sea tenida en cuenta al momento de realizar los correspondientes " +
    "nombramientos en propiedad."
  );
}

// Bloque de "Firma electrónica" (columna de la tabla 2) para un firmante.
function bloqueFirma(p: Participante, modo: Modo): string {
  return `
    <div style="font-size:11px;line-height:1.4">
      <div><strong>Folio:</strong> ${escapeHtml(folioMostrado(p.folio, modo))}</div>
      <div><strong>Fecha y hora:</strong> ${escapeHtml(fechaHora(p.otp_validado_en))}</div>
      <div style="margin-top:4px;font-style:italic">Firmado electrónicamente correo verificado</div>
      <div style="margin-top:4px;color:#374151">${escapeHtml(NOTA_LEGAL)}</div>
    </div>`;
}

export interface CartaParams {
  modo: Modo;
  estado: ProcesoEstado;
  firmantes: Participante[]; // ya ordenados por folio
}

// Genera el HTML completo de la carta colectiva. Sólo aparecen los firmantes.
export async function construirCartaHtml(params: CartaParams): Promise<string> {
  const { modo, estado, firmantes } = params;
  const fecha = estado.fecha_carta ? fechaLarga(estado.fecha_carta) : fechaLarga(new Date());

  // Pre-generamos los QR (async) por firmante.
  const qrPorCedula = new Map<string, string>();
  for (const f of firmantes) {
    qrPorCedula.set(f.cedula, await qrDataUrl(trazaUrl(f.traza_id)));
  }

  const filasTabla1 = firmantes
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(f.nombre_completo)}</td>
        <td>${escapeHtml(f.cedula)}</td>
        <td>${escapeHtml(f.sede_elegida ?? "—")}</td>
      </tr>`
    )
    .join("");

  const filasTabla2 = firmantes
    .map((f) => {
      const url = trazaUrl(f.traza_id);
      return `
      <tr>
        <td>${escapeHtml(f.nombre_completo)}</td>
        <td>${escapeHtml(f.cedula)}</td>
        <td>${escapeHtml(f.correo_digitado ?? "—")}</td>
        <td>${bloqueFirma(f, modo)}</td>
        <td style="text-align:center">
          <img src="${qrPorCedula.get(f.cedula)}" alt="QR" width="110" height="110" /><br/>
          <span style="font-size:9px;word-break:break-all">${escapeHtml(url)}</span>
        </td>
      </tr>`;
    })
    .join("");

  const bannerPrueba =
    modo === "prueba"
      ? `<div class="banner-prueba">DOCUMENTO DE PRUEBA — generado en MODO PRUEBA. No es un documento oficial.</div>`
      : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Manifestación sedes de preferencia${modo === "prueba" ? " (PRUEBA)" : ""}</title>
<style>
  @page { size: A4; margin: 2.2cm; }
  body { font-family: "Times New Roman", Georgia, serif; color: #111827; font-size: 12.5px; line-height: 1.5; }
  .banner-prueba { background:#b45309; color:#fff; padding:8px 12px; font-weight:bold; text-align:center; margin-bottom:16px; border-radius:4px; }
  .membrete p { margin: 0; }
  .espacio { height: 14px; }
  .asunto { font-weight: bold; margin: 14px 0; }
  p.cuerpo { text-align: justify; margin: 10px 0; }
  .nota { font-size: 11px; color:#374151; border-left:3px solid #9ca3af; padding-left:10px; margin:14px 0; }
  h3.firmas { margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 20px; }
  th, td { border: 1px solid #6b7280; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 11.5px; }
  th { background: #eef2f7; }
  caption { caption-side: top; text-align: left; font-weight: bold; margin-bottom: 6px; }
</style>
</head>
<body>
  ${bannerPrueba}
  <div class="membrete">
    <p>Bogotá D.C., ${escapeHtml(fecha)}</p>
    <div class="espacio"></div>
    <p>Honorable Magistrado</p>
    <p><strong>${escapeHtml(PRESIDENTE)}</strong></p>
    <p>Presidente y demás integrantes de la Sala Plena</p>
    <p><strong>CORTE SUPREMA DE JUSTICIA</strong></p>
    <p>Ciudad</p>
  </div>

  <p class="asunto">Asunto: Manifestación sedes de preferencia</p>

  <p>Respetados Magistrados:</p>

  <p class="cuerpo">${escapeHtml(parrafo1Texto(estado.frase_opciones))}</p>
  <p class="cuerpo">${escapeHtml(PARRAFO_2)}</p>

  <table>
    <caption>Sede de preferencia</caption>
    <thead>
      <tr><th>Nombre</th><th>Cédula</th><th>Sede de preferencia</th></tr>
    </thead>
    <tbody>${filasTabla1 || `<tr><td colspan="3"><em>Sin firmantes.</em></td></tr>`}</tbody>
  </table>

  <p class="nota">Nota: ${escapeHtml(NOTA_LEGAL)}</p>

  <p>Atentamente;</p>

  <h3 class="firmas">FIRMAS</h3>
  <table>
    <thead>
      <tr>
        <th>Aspirante</th><th>Cédula</th><th>Correo Electrónico</th>
        <th>Firma electrónica</th><th>Código QR</th>
      </tr>
    </thead>
    <tbody>${filasTabla2 || `<tr><td colspan="5"><em>Sin firmantes.</em></td></tr>`}</tbody>
  </table>
</body>
</html>`;
}
