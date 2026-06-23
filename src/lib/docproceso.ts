import type { Proceso, Firmante } from "./procesos";
import { NOTA_LEGAL } from "./letter";
import { fechaHora } from "./format";
import { qrDataUrl, trazaUrl } from "./qr";
import { escapeHtml } from "./email";

/* eslint-disable @typescript-eslint/no-explicit-any */
import PdfPrinterImport from "pdfmake";
import vfsImport from "pdfmake/build/vfs_fonts";
const PdfPrinter: any = PdfPrinterImport as any;
const vfs: Record<string, string> = vfsImport as any;

// Documento genérico de un proceso: encabezado + cuerpo libres, tabla de
// opciones (si el proceso las usa) y tabla de FIRMAS con recuadro verde + QR.

function folioPad(folio: number | null): string {
  return folio == null ? "—" : String(folio).padStart(2, "0");
}

// Divide un texto en párrafos por líneas en blanco / saltos de línea.
function parrafos(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
function lineas(texto: string | null): string[] {
  if (!texto) return [];
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

const NOTA_FIRMA = "Firmado electrónicamente correo verificado";

export interface DocParams {
  proceso: Proceso;
  firmados: Firmante[]; // ya ordenados por folio
  esPrueba?: boolean; // marca de VISTA PREVIA para envíos de prueba
}

// --------------------------- HTML -------------------------------------------
function bloqueFirmaHtml(f: Firmante): string {
  return `
    <div style="font-size:11px;line-height:1.45;border:1px solid #6ee7b7;background:#ecfdf5;border-radius:8px;padding:8px">
      <div style="color:#047857;font-weight:bold;margin-bottom:4px">&#10003; ${NOTA_FIRMA}</div>
      <div><strong>Folio:</strong> ${escapeHtml(folioPad(f.folio))}</div>
      <div><strong>Fecha y hora:</strong> ${escapeHtml(fechaHora(f.otp_validado_en))}</div>
      <div style="margin-top:4px;color:#374151">${escapeHtml(NOTA_LEGAL)}</div>
    </div>`;
}

export async function construirDocHtml(params: DocParams): Promise<string> {
  const { proceso, firmados, esPrueba } = params;

  const qrPorCedula = new Map<string, string>();
  for (const f of firmados) qrPorCedula.set(f.cedula, await qrDataUrl(trazaUrl(f.traza_id)));

  const encabezado = lineas(proceso.doc_encabezado)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join("");
  const cuerpo = parrafos(proceso.doc_cuerpo)
    .map((p) => `<p class="cuerpo">${escapeHtml(p)}</p>`)
    .join("");

  // Tabla de opciones (sólo si el proceso las usa): firmados por nombre.
  let tablaOpciones = "";
  if (proceso.tiene_opciones) {
    const filas = [...firmados]
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
      .map(
        (f) => `<tr><td>${escapeHtml(f.nombre_completo)}</td><td>${escapeHtml(f.cedula)}</td><td>${escapeHtml(
          f.elegida ?? "—"
        )}</td></tr>`
      )
      .join("");
    tablaOpciones = `
      <table>
        <caption>${escapeHtml(proceso.etiqueta_opcion)}</caption>
        <thead><tr><th>Nombre</th><th>Cédula</th><th>${escapeHtml(proceso.etiqueta_opcion)}</th></tr></thead>
        <tbody>${filas || `<tr><td colspan="3"><em>Sin firmantes.</em></td></tr>`}</tbody>
      </table>`;
  }

  const filasFirmas = firmados
    .map((f) => {
      const url = trazaUrl(f.traza_id);
      return `
      <tr>
        <td>${escapeHtml(f.nombre_completo)}</td>
        <td>${escapeHtml(f.cedula)}</td>
        <td>${escapeHtml(f.correo_digitado ?? "—")}</td>
        <td>${bloqueFirmaHtml(f)}</td>
        <td style="text-align:center">
          <img src="${qrPorCedula.get(f.cedula)}" alt="QR" width="110" height="110" /><br/>
          <span style="font-size:9px;word-break:break-all">${escapeHtml(url)}</span>
        </td>
      </tr>`;
    })
    .join("");

  const banner = esPrueba
    ? `<div class="banner-prueba">ENVÍO DE PRUEBA — VISTA PREVIA. No es el documento radicado.</div>`
    : "";
  const titulo = proceso.doc_titulo ? `<p class="asunto">${escapeHtml(proceso.doc_titulo)}</p>` : "";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><title>${escapeHtml(proceso.nombre)}</title>
<style>
  @page { size: A4; margin: 2.2cm; }
  body { font-family: "Times New Roman", Georgia, serif; color:#111827; font-size:12.5px; line-height:1.5; }
  .banner-prueba { background:#b45309; color:#fff; padding:8px 12px; font-weight:bold; text-align:center; margin-bottom:16px; border-radius:4px; }
  .membrete p { margin:0; }
  .asunto { font-weight:bold; margin:14px 0; }
  p.cuerpo { text-align:justify; margin:10px 0; }
  .nota { font-size:11px; color:#374151; border-left:3px solid #9ca3af; padding-left:10px; margin:14px 0; }
  h3.firmas { margin:22px 0 8px; }
  table { width:100%; border-collapse:collapse; margin:8px 0 20px; }
  th, td { border:1px solid #6b7280; padding:6px 8px; text-align:left; vertical-align:top; font-size:11.5px; }
  th { background:#eef2f7; }
  caption { caption-side:top; text-align:left; font-weight:bold; margin-bottom:6px; }
</style></head>
<body>
  ${banner}
  <div class="membrete">${encabezado}</div>
  ${titulo}
  ${cuerpo}
  ${tablaOpciones}
  <p class="nota">Nota: ${escapeHtml(NOTA_LEGAL)}</p>
  <h3 class="firmas">FIRMAS</h3>
  <table>
    <thead><tr><th>Aspirante</th><th>Cédula</th><th>Correo Electrónico</th><th>Firma electrónica</th><th>Código QR</th></tr></thead>
    <tbody>${filasFirmas || `<tr><td colspan="5"><em>Aún no hay firmas registradas.</em></td></tr>`}</tbody>
  </table>
</body></html>`;
}

// --------------------------- PDF --------------------------------------------
const COLOR_HEAD = "#eef2f7";
const ZWSP = String.fromCharCode(0x200b);
const quebrable = (s: string) => s.replace(/([@._-])/g, (m) => m + ZWSP);
const layoutTabla = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => "#6b7280",
  vLineColor: () => "#6b7280",
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4
};

export async function construirDocPdf(params: DocParams): Promise<Buffer> {
  const { proceso, firmados, esPrueba } = params;

  const printer = new PdfPrinter({
    Roboto: {
      normal: Buffer.from(vfs["Roboto-Regular.ttf"], "base64"),
      bold: Buffer.from(vfs["Roboto-Medium.ttf"], "base64"),
      italics: Buffer.from(vfs["Roboto-Italic.ttf"], "base64"),
      bolditalics: Buffer.from(vfs["Roboto-MediumItalic.ttf"], "base64")
    }
  });
  const cab = (t: string) => ({ text: t, bold: true, fillColor: COLOR_HEAD, fontSize: 9 });
  const contenido: any[] = [];

  if (esPrueba) {
    contenido.push({
      table: { widths: ["*"], body: [[{ text: "ENVÍO DE PRUEBA — VISTA PREVIA. No es el documento radicado.", color: "white", bold: true, alignment: "center" }]] },
      layout: "noBorders",
      fillColor: "#b45309",
      margin: [0, 0, 0, 14]
    });
  }

  for (const l of lineas(proceso.doc_encabezado)) contenido.push({ text: l });
  if (proceso.doc_titulo) contenido.push({ text: proceso.doc_titulo, bold: true, margin: [0, 12, 0, 12] });
  for (const p of parrafos(proceso.doc_cuerpo)) contenido.push({ text: p, alignment: "justify", margin: [0, 0, 0, 8] });

  if (proceso.tiene_opciones) {
    const body: any[] = [[cab("Nombre"), cab("Cédula"), cab(proceso.etiqueta_opcion)]];
    for (const f of [...firmados].sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))) {
      body.push([
        { text: f.nombre_completo, fontSize: 9 },
        { text: f.cedula, fontSize: 9 },
        { text: f.elegida ?? "—", fontSize: 9 }
      ]);
    }
    contenido.push({ text: proceso.etiqueta_opcion, bold: true, margin: [0, 8, 0, 6] });
    contenido.push({ table: { headerRows: 1, widths: ["*", "auto", "*"], body }, layout: layoutTabla });
  }

  contenido.push({
    text: [{ text: "Nota: ", bold: true }, NOTA_LEGAL],
    fontSize: 9,
    color: "#374151",
    margin: [0, 12, 0, 12]
  });
  contenido.push({ text: "FIRMAS", bold: true, fontSize: 12, margin: [0, 4, 0, 6] });

  const t2: any[] = [
    [cab("Aspirante"), cab("Cédula"), cab("Correo Electrónico"), cab("Firma electrónica"), cab("Código QR")]
  ];
  for (const f of firmados) {
    const qr = await qrDataUrl(trazaUrl(f.traza_id));
    t2.push([
      { text: f.nombre_completo, fontSize: 8 },
      { text: f.cedula, fontSize: 8 },
      { text: quebrable(f.correo_digitado ?? "—"), fontSize: 7.5 },
      {
        fillColor: "#ecfdf5",
        stack: [
          { text: NOTA_FIRMA, color: "#047857", bold: true, fontSize: 8 },
          { text: [{ text: "Folio: ", bold: true }, folioPad(f.folio)], fontSize: 8, margin: [0, 2, 0, 0] },
          { text: [{ text: "Fecha y hora: ", bold: true }, fechaHora(f.otp_validado_en)], fontSize: 8 },
          { text: NOTA_LEGAL, color: "#374151", fontSize: 7, margin: [0, 2, 0, 0] }
        ]
      },
      { image: qr, width: 62, alignment: "center" }
    ]);
  }
  if (firmados.length === 0) {
    t2.push([{ text: "Aún no hay firmas registradas.", colSpan: 5, italics: true, fontSize: 9 }, {}, {}, {}, {}]);
  }
  contenido.push({ table: { headerRows: 1, widths: [78, 48, 92, "*", 74], body: t2 }, layout: layoutTabla });

  const dd: any = {
    pageSize: "A4",
    pageMargins: [50, 50, 50, 50],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#111827", lineHeight: 1.2 },
    content: contenido
  };
  const pdfDoc = printer.createPdfKitDocument(dd);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on("data", (c: Buffer) => chunks.push(c));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
