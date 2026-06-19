import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import {
  upsertParticipantePrueba,
  eliminarParticipantePrueba,
  reiniciarPrueba
} from "@/lib/repo";
import { normalizarCedula } from "@/lib/util";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gestión de participantes FICTICIOS (sólo tabla participantes_prueba).
// Disponible únicamente cuando MODO=prueba para evitar confusiones.
export async function POST(req: NextRequest) {
  const no = exigirMaestro();
  if (no) return no;

  if (getModo() !== "prueba") {
    return NextResponse.json(
      { error: "La gestión de datos de prueba sólo está disponible en MODO=prueba." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const accion = String(body.accion ?? "");

  try {
    if (accion === "upsert") {
      const cedula = normalizarCedula(String(body.cedula ?? ""));
      if (!cedula) return NextResponse.json({ error: "Cédula requerida." }, { status: 400 });
      if (!body.nombre_completo || !body.sede_opcion_a) {
        return NextResponse.json({ error: "Nombre y sede A son obligatorios." }, { status: 400 });
      }
      await upsertParticipantePrueba({
        cedula,
        puesto_lista: Number(body.puesto_lista) || 1,
        nombre_completo: String(body.nombre_completo).trim(),
        sede_opcion_a: String(body.sede_opcion_a).trim(),
        sede_opcion_b: body.sede_opcion_b ? String(body.sede_opcion_b).trim() : null,
        correo_destino_prueba: body.correo_destino_prueba
          ? String(body.correo_destino_prueba).trim()
          : null
      });
      await audit({ modo: "prueba", accion: "prueba_upsert", cedula, detalle: { nombre: body.nombre_completo } });
      return NextResponse.json({ ok: true });
    }

    if (accion === "eliminar") {
      const cedula = normalizarCedula(String(body.cedula ?? ""));
      await eliminarParticipantePrueba(cedula);
      await audit({ modo: "prueba", accion: "prueba_eliminar", cedula });
      return NextResponse.json({ ok: true });
    }

    if (accion === "reiniciar") {
      await reiniciarPrueba();
      await audit({ modo: "prueba", accion: "prueba_reiniciar" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (e) {
    console.error("[/api/maestro/prueba]", e);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}
