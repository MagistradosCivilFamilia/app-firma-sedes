import { NextResponse } from "next/server";
import { maestroAutenticado } from "./auth";

// Devuelve una respuesta 401 si no hay sesión de maestro; null si está OK.
export function exigirMaestro(): NextResponse | null {
  if (!maestroAutenticado()) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}
