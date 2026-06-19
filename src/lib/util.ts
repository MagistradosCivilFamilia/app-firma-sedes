import type { NextRequest } from "next/server";

export function esCorreoValido(correo: string): boolean {
  const c = correo.trim();
  // Validación pragmática (no exhaustiva) suficiente para este flujo.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 254;
}

export function normalizarCedula(cedula: string): string {
  // Sólo dígitos; el Excel guarda cédulas numéricas sin puntos ni espacios.
  return (cedula ?? "").replace(/[^\d]/g, "");
}

export function getIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "desconocida";
}
