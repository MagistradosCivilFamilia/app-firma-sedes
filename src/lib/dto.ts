import type { Participante } from "./types";
import type { Modo } from "./env";
import { folioMostrado } from "./mode";
import { trazaUrl } from "./qr";

// Vista del participante segura para enviar al cliente: nunca incluye el hash
// del OTP ni campos que permitan reconstruirlo.
export interface ParticipanteDTO {
  cedula: string;
  nombre_completo: string;
  sede_opcion_a: string;
  sede_opcion_b: string | null;
  sede_elegida: string | null;
  tiene_dos_opciones: boolean;
  firmado: boolean;
  folio_mostrado: string | null;
  correo_digitado: string | null;
  traza_url: string | null;
}

export function aDTO(p: Participante, modo: Modo): ParticipanteDTO {
  return {
    cedula: p.cedula,
    nombre_completo: p.nombre_completo,
    sede_opcion_a: p.sede_opcion_a,
    sede_opcion_b: p.sede_opcion_b,
    sede_elegida: p.sede_elegida,
    tiene_dos_opciones: !!p.sede_opcion_b,
    firmado: p.firmado,
    folio_mostrado: p.firmado ? folioMostrado(p.folio, modo) : null,
    correo_digitado: p.correo_digitado,
    traza_url: p.firmado ? trazaUrl(p.traza_id) : null
  };
}
