import { folioMostrado } from "./mode";
import { fechaHora, fechaLarga } from "./format";
import { qrDataUrl, trazaUrl } from "./qr";
import { PRESIDENTE, PARRAFO_2, NOTA_LEGAL, parrafo1Texto, type CartaParams } from "./letter";

/* eslint-disable @typescript-eslint/no-explicit-any */
// pdfmake (servidor) genera el PDF sin navegador headless: confiable y liviano.
// Cargamos las fuentes Roboto embebidas (vienen como base64 en vfs_fonts).
import PdfPrinterImport from "pdfmake";
import vfsImport from "pdfmake/build/vfs_fonts";

const PdfPrinter: any = PdfPrinterImport as any;
const vfs: Record<string, string> = vfsImport as any;

function printer() {
  return new PdfPrinter({
    Roboto: {
      normal: Buffer.from(vfs["Roboto-Regular.ttf"], "base64"),
      bold: Buffer.from(vfs["Roboto-Medium.ttf"], "base64"),
      italics: Buffer.from(vfs["Roboto-Italic.ttf"], "base64"),
      bolditalics: Buffer.from(vfs["Roboto-MediumItalic.ttf"], "base64")
    }
  });
}

const COLOR_TXT = "#111827";
const COLOR_HEAD = "#eef2f7";
const COLOR_BORDE = "#6b7280";
const VERDE_BG = "#ecfdf5";
const VERDE_TX = "#047857";

// Inserta oportunidades de salto (zero-width space) en textos largos sin
// espacios (correos, URLs) para que se partan y no ensanchen la columna.
const ZWSP = String.fromCharCode(0x200b);
function quebrable(s: string): string {
  return s.replace(/([@._-])/g, (m) => m + ZWSP);
}

const layoutTabla = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => COLOR_BORDE,
  vLineColor: () => COLOR_BORDE,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4
};

// Construye el PDF de la carta colectiva. Sólo aparecen los firmantes.
export async function construirCartaPdf(params: CartaParams): Promise<Buffer> {
  const { modo, estado, firmantes } = params;
  const fecha = estado.fecha_carta ? fechaLarga(estado.fecha_carta) : fechaLarga(new Date());

  // Tabla 1 — Sede de preferencia: en el ORDEN DE LA LISTA (puesto), no de firma.
  const firmantesPorPuesto = [...firmantes].sort((a, b) => a.puesto_lista - b.puesto_lista);
  const cabecera = (t: string) => ({ text: t, bold: true, fillColor: COLOR_HEAD, fontSize: 9 });
  const tabla1Body: any[] = [
    [cabecera("Nombre"), cabecera("Cédula"), cabecera("Sede de preferencia")]
  ];
  for (const f of firmantesPorPuesto) {
    tabla1Body.push([
      { text: f.nombre_completo, fontSize: 9 },
      { text: f.cedula, fontSize: 9 },
      { text: f.sede_elegida ?? "—", fontSize: 9 }
    ]);
  }
  if (firmantes.length === 0) {
    tabla1Body.push([{ text: "Sin firmantes.", colSpan: 3, italics: true, fontSize: 9 }, {}, {}]);
  }

  // Tabla 2 — FIRMAS (con recuadro verde de firma y QR)
  const tabla2Body: any[] = [
    [
      cabecera("Aspirante"),
      cabecera("Cédula"),
      cabecera("Correo Electrónico"),
      cabecera("Firma electrónica"),
      cabecera("Código QR")
    ]
  ];
  for (const f of firmantes) {
    const qr = await qrDataUrl(trazaUrl(f.traza_id));
    tabla2Body.push([
      { text: f.nombre_completo, fontSize: 8 },
      { text: f.cedula, fontSize: 8 },
      { text: quebrable(f.correo_digitado ?? "—"), fontSize: 7.5 },
      {
        // Recuadro verde de firma electrónica.
        fillColor: VERDE_BG,
        stack: [
          { text: "Firmado electrónicamente correo verificado", color: VERDE_TX, bold: true, fontSize: 8 },
          { text: [{ text: "Folio: ", bold: true }, folioMostrado(f.folio, modo)], fontSize: 8, margin: [0, 2, 0, 0] },
          { text: [{ text: "Fecha y hora: ", bold: true }, fechaHora(f.otp_validado_en)], fontSize: 8 },
          { text: NOTA_LEGAL, color: "#374151", fontSize: 7, margin: [0, 2, 0, 0] }
        ]
      },
      { image: qr, width: 62, alignment: "center" }
    ]);
  }
  if (firmantes.length === 0) {
    tabla2Body.push([{ text: "Sin firmantes.", colSpan: 5, italics: true, fontSize: 9 }, {}, {}, {}, {}]);
  }

  const contenido: any[] = [];

  if (modo === "prueba") {
    contenido.push({
      table: {
        widths: ["*"],
        body: [[{ text: "DOCUMENTO DE PRUEBA — no es un documento oficial.", color: "white", bold: true, alignment: "center" }]]
      },
      layout: "noBorders",
      fillColor: "#b45309",
      margin: [0, 0, 0, 14]
    });
  }

  contenido.push(
    { text: `Bogotá D.C., ${fecha}`, margin: [0, 0, 0, 12] },
    { text: "Honorable Magistrado" },
    { text: PRESIDENTE, bold: true },
    { text: "Presidente y demás integrantes de la Sala Plena" },
    { text: "CORTE SUPREMA DE JUSTICIA", bold: true },
    { text: "Ciudad", margin: [0, 0, 0, 12] },
    { text: "Asunto: Manifestación sedes de preferencia", bold: true, margin: [0, 0, 0, 12] },
    { text: "Respetados Magistrados:", margin: [0, 0, 0, 8] },
    { text: parrafo1Texto(estado.frase_opciones), alignment: "justify", margin: [0, 0, 0, 8] },
    { text: PARRAFO_2, alignment: "justify", margin: [0, 0, 0, 14] },
    { text: "Sede de preferencia", bold: true, margin: [0, 0, 0, 6] },
    { table: { headerRows: 1, widths: ["*", "auto", "*"], body: tabla1Body }, layout: layoutTabla },
    {
      text: [{ text: "Nota: ", bold: true }, NOTA_LEGAL],
      fontSize: 9,
      color: "#374151",
      margin: [0, 12, 0, 12]
    },
    { text: "Atentamente;", margin: [0, 0, 0, 14] },
    { text: "FIRMAS", bold: true, fontSize: 12, margin: [0, 4, 0, 6] },
    {
      // Anchos fijos que SUMAN dentro del ancho útil de A4 (≈495 pt) para que
      // ninguna columna (en especial el QR) se salga de la hoja.
      table: { headerRows: 1, widths: [78, 48, 92, "*", 74], body: tabla2Body },
      layout: layoutTabla
    }
  );

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [50, 50, 50, 50],
    defaultStyle: { font: "Roboto", fontSize: 10, color: COLOR_TXT, lineHeight: 1.2 },
    content: contenido
  };

  const pdfDoc = printer().createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on("data", (c: Buffer) => chunks.push(c));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
