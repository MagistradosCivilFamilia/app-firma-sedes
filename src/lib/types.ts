export interface Participante {
  cedula: string;
  puesto_lista: number;
  nombre_completo: string;
  sede_opcion_a: string;
  sede_opcion_b: string | null;
  sede_elegida: string | null;
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
  correo_destino_prueba?: string | null; // sólo en participantes_prueba
  creado_en: string;
  actualizado_en: string;
}

export interface ProcesoEstado {
  modo: "real" | "prueba";
  carta_cerrada: boolean;
  cerrada_en: string | null;
  enviada_en: string | null;
  fecha_carta: string | null;
  destinatarios: string[];
  frase_opciones: string;
  actualizado_en: string;
}
