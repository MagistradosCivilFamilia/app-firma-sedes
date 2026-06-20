import { NextResponse } from "next/server";
import { getModo } from "@/lib/env";
import { listarTodos, listarFirmantes, getEstado } from "@/lib/repo";
import { folioMostrado } from "@/lib/mode";
import { PRESIDENTE, PARRAFO_2, NOTA_LEGAL, parrafo1Texto } from "@/lib/letter";
import { fechaLarga, fechaHora } from "@/lib/format";
import { qrDataUrl, trazaUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Nota literal del bloque de firma (no reformular).
const NOTA_FIRMA = "Firmado electrónicamente correo verificado";

export async function GET() {
  const modo = getModo();
  const [estado, todos, firmantes] = await Promise.all([
    getEstado(modo),
    listarTodos(modo),
    listarFirmantes(modo)
  ]);

  // Tabla 1 (Sede de preferencia): todos los participantes, con su sede marcada
  // (o null si aún no han elegido) -> muestra el avance de marcación en vivo.
  const tabla1 = todos.map((p) => ({
    puesto_lista: p.puesto_lista,
    nombre_completo: p.nombre_completo,
    cedula: p.cedula,
    sede_elegida: p.sede_elegida,
    firmado: p.firmado
  }));

  // Tabla 2 (FIRMAS): sólo firmantes, en orden de folio, con bloque de firma y QR.
  const tabla2 = await Promise.all(
    firmantes.map(async (f) => {
      const url = trazaUrl(f.traza_id);
      return {
        nombre_completo: f.nombre_completo,
        cedula: f.cedula,
        correo: f.correo_digitado,
        folio_mostrado: folioMostrado(f.folio, modo),
        fecha_firma: fechaHora(f.otp_validado_en),
        nota_firma: NOTA_FIRMA,
        traza_url: url,
        qr: await qrDataUrl(url)
      };
    })
  );

  const carta = {
    fecha: estado.fecha_carta ? fechaLarga(estado.fecha_carta) : fechaLarga(new Date()),
    presidente: PRESIDENTE,
    asunto: "Manifestación sedes de preferencia",
    parrafo1: parrafo1Texto(estado.frase_opciones),
    parrafo2: PARRAFO_2,
    nota_legal: NOTA_LEGAL
  };

  return NextResponse.json({
    modo,
    es_prueba: modo === "prueba",
    carta_cerrada: estado.carta_cerrada,
    enviada_en: estado.enviada_en,
    resumen: {
      total: tabla1.length,
      firmados: firmantes.length,
      eligieron: todos.filter((t) => t.sede_elegida && !t.firmado).length,
      pendientes: todos.filter((t) => !t.sede_elegida && !t.firmado).length
    },
    carta,
    tabla1,
    tabla2
  });
}
