import bcrypt from "bcryptjs";
import crypto from "crypto";

export const OTP_VIGENCIA_MIN = 10; // minutos de validez del código
export const OTP_MAX_INTENTOS = 5; // intentos fallidos antes de bloquear

// Código de 6 dígitos generado con CSPRNG (no Math.random).
export function generarOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export async function hashOtp(codigo: string): Promise<string> {
  return bcrypt.hash(codigo, 10);
}

export async function verificarOtp(codigo: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(codigo, hash);
  } catch {
    return false;
  }
}

export function expiraEn(desde: Date = new Date()): Date {
  return new Date(desde.getTime() + OTP_VIGENCIA_MIN * 60_000);
}
