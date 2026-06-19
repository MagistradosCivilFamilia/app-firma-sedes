import { db } from "./supabase";
import { modoConfig } from "./mode";
import type { Modo } from "./env";
import type { Participante, ProcesoEstado } from "./types";

// Capa de acceso a datos. Cada función recibe el modo y opera sobre la tabla
// física correcta (real o prueba). Nunca mezcla los dos conjuntos.

export async function getEstado(modo: Modo): Promise<ProcesoEstado> {
  const { data, error } = await db()
    .from("proceso_estado")
    .select("*")
    .eq("modo", modo)
    .single();
  if (error) throw error;
  return data as ProcesoEstado;
}

export async function actualizarEstado(
  modo: Modo,
  patch: Partial<Pick<ProcesoEstado, "carta_cerrada" | "cerrada_en" | "enviada_en" | "fecha_carta" | "destinatarios" | "frase_opciones">>
): Promise<ProcesoEstado> {
  const { data, error } = await db()
    .from("proceso_estado")
    .update({ ...patch, actualizado_en: new Date().toISOString() })
    .eq("modo", modo)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProcesoEstado;
}

export async function getPorCedula(modo: Modo, cedula: string): Promise<Participante | null> {
  const { tabla } = modoConfig(modo);
  const { data, error } = await db()
    .from(tabla)
    .select("*")
    .eq("cedula", cedula.trim())
    .maybeSingle();
  if (error) throw error;
  return (data as Participante) ?? null;
}

export async function getPorTraza(modo: Modo, trazaId: string): Promise<Participante | null> {
  const { tabla } = modoConfig(modo);
  const { data, error } = await db()
    .from(tabla)
    .select("*")
    .eq("traza_id", trazaId)
    .maybeSingle();
  if (error) throw error;
  return (data as Participante) ?? null;
}

// Busca por traza_id en AMBAS tablas (la página pública no sabe el modo).
export async function getPorTrazaCualquiera(
  trazaId: string
): Promise<{ participante: Participante; modo: Modo } | null> {
  for (const modo of ["real", "prueba"] as Modo[]) {
    const p = await getPorTraza(modo, trazaId);
    if (p) return { participante: p, modo };
  }
  return null;
}

export async function listarTodos(modo: Modo): Promise<Participante[]> {
  const { tabla } = modoConfig(modo);
  const { data, error } = await db()
    .from(tabla)
    .select("*")
    .order("puesto_lista", { ascending: true });
  if (error) throw error;
  return (data as Participante[]) ?? [];
}

// Sólo firmantes, ordenados por folio (orden de firma) para construir la carta.
export async function listarFirmantes(modo: Modo): Promise<Participante[]> {
  const { tabla } = modoConfig(modo);
  const { data, error } = await db()
    .from(tabla)
    .select("*")
    .eq("firmado", true)
    .order("folio", { ascending: true });
  if (error) throw error;
  return (data as Participante[]) ?? [];
}

export async function marcarIngreso(modo: Modo, cedula: string): Promise<void> {
  const { tabla } = modoConfig(modo);
  // Sólo fija ingreso_en la primera vez (si está nulo).
  await db()
    .from(tabla)
    .update({ ingreso_en: new Date().toISOString(), actualizado_en: new Date().toISOString() })
    .eq("cedula", cedula)
    .is("ingreso_en", null);
}

export async function guardarEleccion(modo: Modo, cedula: string, sede: string): Promise<void> {
  const { tabla } = modoConfig(modo);
  const { error } = await db()
    .from(tabla)
    .update({ sede_elegida: sede, actualizado_en: new Date().toISOString() })
    .eq("cedula", cedula);
  if (error) throw error;
}

export async function guardarOtp(
  modo: Modo,
  cedula: string,
  fields: { correo: string; hash: string; enviadoEn: string; expiraEn: string }
): Promise<void> {
  const { tabla } = modoConfig(modo);
  const { error } = await db()
    .from(tabla)
    .update({
      correo_digitado: fields.correo,
      codigo_otp_hash: fields.hash,
      otp_enviado_en: fields.enviadoEn,
      otp_expira_en: fields.expiraEn,
      otp_intentos: 0,
      actualizado_en: new Date().toISOString()
    })
    .eq("cedula", cedula);
  if (error) throw error;
}

export async function incrementarIntentos(modo: Modo, cedula: string, actuales: number): Promise<void> {
  const { tabla } = modoConfig(modo);
  await db()
    .from(tabla)
    .update({ otp_intentos: actuales + 1, actualizado_en: new Date().toISOString() })
    .eq("cedula", cedula);
}

// Firma atómica vía función SQL. Devuelve folio asignado y fecha de validación.
export async function firmar(
  modo: Modo,
  cedula: string
): Promise<{ folio: number; validadoEn: string }> {
  const { rpcFirmar } = modoConfig(modo);
  const { data, error } = await db().rpc(rpcFirmar, { p_cedula: cedula });
  if (error) {
    // Propagamos el código de error de la función SQL (CARTA_CERRADA, NO_EXISTE).
    throw new Error(error.message);
  }
  const fila = Array.isArray(data) ? data[0] : data;
  return { folio: fila.out_folio as number, validadoEn: fila.out_validado as string };
}

export async function marcarCorreoConfirmacion(modo: Modo, cedula: string): Promise<void> {
  const { tabla } = modoConfig(modo);
  await db()
    .from(tabla)
    .update({
      correo_confirmacion_enviado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString()
    })
    .eq("cedula", cedula);
}

export async function marcarCorreoFinalEnviado(modo: Modo, cedulas: string[], cuando: string): Promise<void> {
  const { tabla } = modoConfig(modo);
  if (cedulas.length === 0) return;
  await db()
    .from(tabla)
    .update({ correo_final_enviado_en: cuando, actualizado_en: new Date().toISOString() })
    .in("cedula", cedulas);
}

// ---- CRUD de participantes de PRUEBA (sólo modo prueba) --------------------

export async function upsertParticipantePrueba(p: {
  cedula: string;
  puesto_lista: number;
  nombre_completo: string;
  sede_opcion_a: string;
  sede_opcion_b: string | null;
  correo_destino_prueba: string | null;
}): Promise<void> {
  const { error } = await db()
    .from("participantes_prueba")
    .upsert(
      {
        cedula: p.cedula.trim(),
        puesto_lista: p.puesto_lista,
        nombre_completo: p.nombre_completo,
        sede_opcion_a: p.sede_opcion_a,
        sede_opcion_b: p.sede_opcion_b,
        correo_destino_prueba: p.correo_destino_prueba,
        actualizado_en: new Date().toISOString()
      },
      { onConflict: "cedula" }
    );
  if (error) throw error;
}

export async function eliminarParticipantePrueba(cedula: string): Promise<void> {
  const { error } = await db().from("participantes_prueba").delete().eq("cedula", cedula);
  if (error) throw error;
}

// Reinicia TODOS los datos de prueba (registros + secuencia de folio + estado).
export async function reiniciarPrueba(): Promise<void> {
  await db().from("participantes_prueba").delete().neq("cedula", "");
  await db().from("auditoria").delete().eq("modo", "prueba");
  await db()
    .from("proceso_estado")
    .update({ carta_cerrada: false, cerrada_en: null, enviada_en: null })
    .eq("modo", "prueba");
  // Reiniciar la secuencia de folio de prueba (función opcional; si no existe
  // o falla, no es crítico para el reinicio de datos).
  try {
    await db().rpc("reiniciar_folio_prueba");
  } catch {
    /* no crítico */
  }
}
