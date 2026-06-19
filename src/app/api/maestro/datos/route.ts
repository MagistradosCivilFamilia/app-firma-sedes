import { NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import { listarTodos, getEstado } from "@/lib/repo";
import { folioMostrado } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const no = exigirMaestro();
  if (no) return no;

  const modo = getModo();
  const [estado, todos] = await Promise.all([getEstado(modo), listarTodos(modo)]);

  const participantes = todos.map((p) => ({
    puesto_lista: p.puesto_lista,
    cedula: p.cedula,
    nombre_completo: p.nombre_completo,
    sede_opcion_a: p.sede_opcion_a,
    sede_opcion_b: p.sede_opcion_b,
    tiene_dos_opciones: !!p.sede_opcion_b,
    sede_elegida: p.sede_elegida,
    ingreso_en: p.ingreso_en,
    firmado: p.firmado,
    folio_mostrado: p.firmado ? folioMostrado(p.folio, modo) : null,
    correo_digitado: p.correo_digitado,
    otp_validado_en: p.otp_validado_en,
    correo_final_enviado_en: p.correo_final_enviado_en,
    correo_destino_prueba: p.correo_destino_prueba ?? null
  }));

  return NextResponse.json({
    modo,
    es_prueba: modo === "prueba",
    estado,
    participantes,
    total: participantes.length,
    firmados: participantes.filter((p) => p.firmado).length
  });
}
