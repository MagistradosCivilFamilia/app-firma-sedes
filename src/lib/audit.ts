import { db } from "./supabase";
import type { Modo } from "./env";

// Inserta un registro de auditoría. Nunca debe tumbar el flujo principal:
// si falla, se loguea en consola pero no se propaga.
export async function audit(params: {
  modo: Modo;
  accion: string;
  cedula?: string | null;
  traza_id?: string | null;
  detalle?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await db().from("auditoria").insert({
      modo: params.modo,
      accion: params.accion,
      cedula: params.cedula ?? null,
      traza_id: params.traza_id ?? null,
      detalle: params.detalle ?? null,
      ip: params.ip ?? null
    });
  } catch (e) {
    console.error("[audit] no se pudo registrar auditoría:", e);
  }
}
