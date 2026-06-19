import type { Modo } from "./env";

// Mapeo de modo -> nombres físicos de tabla, función de firma y prefijo de folio.
// El aislamiento total se logra usando tablas DISTINTAS, no un filtro sobre la
// misma tabla real (un error de filtro podría mezclar o exponer datos reales).

export interface ModoConfig {
  modo: Modo;
  tabla: "participantes" | "participantes_prueba";
  rpcFirmar: "firmar_real" | "firmar_prueba";
  esPrueba: boolean;
}

export function modoConfig(modo: Modo): ModoConfig {
  if (modo === "prueba") {
    return {
      modo,
      tabla: "participantes_prueba",
      rpcFirmar: "firmar_prueba",
      esPrueba: true
    };
  }
  return {
    modo,
    tabla: "participantes",
    rpcFirmar: "firmar_real",
    esPrueba: false
  };
}

// Folio mostrado: real -> "01", "02"...  prueba -> "PRUEBA-01", "PRUEBA-02"...
export function folioMostrado(folio: number | null | undefined, modo: Modo): string {
  if (folio == null) return "—";
  const dosDigitos = String(folio).padStart(2, "0");
  return modo === "prueba" ? `PRUEBA-${dosDigitos}` : dosDigitos;
}
