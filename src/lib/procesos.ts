import { db } from "./supabase";

// Capa de datos del sistema MULTIPROCESO (tablas procesos / firmantes).
// Independiente del proceso original (participantes), que no se toca.

export interface Proceso {
  id: string;
  nombre: string;
  doc_titulo: string | null;
  doc_encabezado: string | null;
  doc_cuerpo: string | null;
  tiene_opciones: boolean;
  etiqueta_opcion: string;
  destinatarios: string[];
  cerrada: boolean;
  cerrada_en: string | null;
  enviada_en: string | null;
  enviado_a: { para?: string[]; cc?: string[] } | null;
  creado_en: string;
  actualizado_en: string;
}

export interface Firmante {
  id: string;
  proceso_id: string;
  cedula: string;
  nombre_completo: string;
  opciones: string[];
  elegida: string | null;
  firmado: boolean;
  folio: number | null;
  correo_digitado: string | null;
  codigo_otp_hash: string | null;
  otp_enviado_en: string | null;
  otp_expira_en: string | null;
  otp_intentos: number;
  otp_validado_en: string | null;
  correo_confirmacion_enviado_en: string | null;
  correo_final_enviado_en: string | null;
  ingreso_en: string | null;
  traza_id: string;
  creado_en: string;
  actualizado_en: string;
}

const ahora = () => new Date().toISOString();

// ---- Procesos ---------------------------------------------------------------

export async function crearProceso(p: {
  nombre: string;
  doc_titulo: string | null;
  doc_encabezado: string | null;
  doc_cuerpo: string | null;
  tiene_opciones: boolean;
  etiqueta_opcion: string;
  destinatarios: string[];
}): Promise<Proceso> {
  const { data, error } = await db().from("procesos").insert(p).select("*").single();
  if (error) throw error;
  return data as Proceso;
}

export async function listarProcesos(): Promise<Proceso[]> {
  const { data, error } = await db()
    .from("procesos")
    .select("*")
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return (data as Proceso[]) ?? [];
}

export async function getProceso(id: string): Promise<Proceso | null> {
  const { data, error } = await db().from("procesos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Proceso) ?? null;
}

export async function actualizarProceso(
  id: string,
  patch: Partial<
    Pick<
      Proceso,
      "nombre" | "doc_titulo" | "doc_encabezado" | "doc_cuerpo" | "tiene_opciones" |
      "etiqueta_opcion" | "destinatarios" | "cerrada" | "cerrada_en" | "enviada_en" | "enviado_a"
    >
  >
): Promise<Proceso> {
  const { data, error } = await db()
    .from("procesos")
    .update({ ...patch, actualizado_en: ahora() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Proceso;
}

// ---- Firmantes --------------------------------------------------------------

export async function agregarFirmantes(
  procesoId: string,
  filas: { cedula: string; nombre_completo: string; opciones: string[] }[]
): Promise<number> {
  if (filas.length === 0) return 0;
  const rows = filas.map((f) => ({
    proceso_id: procesoId,
    cedula: f.cedula.trim(),
    nombre_completo: f.nombre_completo.trim(),
    opciones: f.opciones ?? []
  }));
  const { error, count } = await db()
    .from("firmantes")
    .upsert(rows, { onConflict: "proceso_id,cedula", count: "exact" });
  if (error) throw error;
  return count ?? rows.length;
}

export async function listarFirmantesProc(procesoId: string): Promise<Firmante[]> {
  const { data, error } = await db()
    .from("firmantes")
    .select("*")
    .eq("proceso_id", procesoId)
    .order("nombre_completo", { ascending: true });
  if (error) throw error;
  return (data as Firmante[]) ?? [];
}

export async function listarFirmadosProc(procesoId: string): Promise<Firmante[]> {
  const { data, error } = await db()
    .from("firmantes")
    .select("*")
    .eq("proceso_id", procesoId)
    .eq("firmado", true)
    .order("folio", { ascending: true });
  if (error) throw error;
  return (data as Firmante[]) ?? [];
}

export async function getFirmante(procesoId: string, cedula: string): Promise<Firmante | null> {
  const { data, error } = await db()
    .from("firmantes")
    .select("*")
    .eq("proceso_id", procesoId)
    .eq("cedula", cedula.trim())
    .maybeSingle();
  if (error) throw error;
  return (data as Firmante) ?? null;
}

export async function getFirmantePorTraza(trazaId: string): Promise<Firmante | null> {
  const { data, error } = await db()
    .from("firmantes")
    .select("*")
    .eq("traza_id", trazaId)
    .maybeSingle();
  if (error) throw error;
  return (data as Firmante) ?? null;
}

export async function marcarIngresoProc(procesoId: string, cedula: string): Promise<void> {
  await db()
    .from("firmantes")
    .update({ ingreso_en: ahora(), actualizado_en: ahora() })
    .eq("proceso_id", procesoId)
    .eq("cedula", cedula)
    .is("ingreso_en", null);
}

export async function guardarEleccionProc(procesoId: string, cedula: string, elegida: string): Promise<void> {
  const { error } = await db()
    .from("firmantes")
    .update({ elegida, actualizado_en: ahora() })
    .eq("proceso_id", procesoId)
    .eq("cedula", cedula);
  if (error) throw error;
}

export async function guardarOtpProc(
  procesoId: string,
  cedula: string,
  fields: { correo: string; hash: string; enviadoEn: string; expiraEn: string }
): Promise<void> {
  const { error } = await db()
    .from("firmantes")
    .update({
      correo_digitado: fields.correo,
      codigo_otp_hash: fields.hash,
      otp_enviado_en: fields.enviadoEn,
      otp_expira_en: fields.expiraEn,
      otp_intentos: 0,
      actualizado_en: ahora()
    })
    .eq("proceso_id", procesoId)
    .eq("cedula", cedula);
  if (error) throw error;
}

export async function incrementarIntentosProc(
  procesoId: string,
  cedula: string,
  actuales: number
): Promise<void> {
  await db()
    .from("firmantes")
    .update({ otp_intentos: actuales + 1, actualizado_en: ahora() })
    .eq("proceso_id", procesoId)
    .eq("cedula", cedula);
}

export async function firmarProc(
  procesoId: string,
  cedula: string
): Promise<{ folio: number; validadoEn: string }> {
  const { data, error } = await db().rpc("firmar_proceso", { p_proceso: procesoId, p_cedula: cedula });
  if (error) throw new Error(error.message);
  const fila = Array.isArray(data) ? data[0] : data;
  return { folio: fila.out_folio as number, validadoEn: fila.out_validado as string };
}

export async function marcarConfirmacionProc(procesoId: string, cedula: string): Promise<void> {
  await db()
    .from("firmantes")
    .update({ correo_confirmacion_enviado_en: ahora(), actualizado_en: ahora() })
    .eq("proceso_id", procesoId)
    .eq("cedula", cedula);
}

export async function marcarFinalEnviadoProc(
  procesoId: string,
  cedulas: string[],
  cuando: string
): Promise<void> {
  if (cedulas.length === 0) return;
  await db()
    .from("firmantes")
    .update({ correo_final_enviado_en: cuando, actualizado_en: ahora() })
    .eq("proceso_id", procesoId)
    .in("cedula", cedulas);
}
