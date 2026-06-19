import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "./env";

// Sesión simple del maestro: cookie httpOnly firmada (HMAC) con vencimiento.
// No usamos NextAuth: una sola cuenta administrada por MAESTRO_PASSWORD.

const COOKIE = "maestro_sesion";
const DURACION_MS = 8 * 60 * 60 * 1000; // 8 horas

function firmar(payload: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
}

function tokenValido(token: string): boolean {
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const esperado = firmar(expStr);
  // Comparación en tiempo constante.
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && Date.now() < exp;
}

export function passwordCorrecta(intento: string): boolean {
  const a = Buffer.from(intento);
  const b = Buffer.from(env.maestroPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function crearCookieSesion(): { name: string; value: string; options: object } {
  const exp = Date.now() + DURACION_MS;
  const token = `${exp}.${firmar(String(exp))}`;
  return {
    name: COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(DURACION_MS / 1000)
    }
  };
}

export function cookieCierre(): { name: string; value: string; options: object } {
  return {
    name: COOKIE,
    value: "",
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 }
  };
}

// Para usar en Server Components / route handlers: ¿hay sesión válida?
export function maestroAutenticado(): boolean {
  const token = cookies().get(COOKIE)?.value;
  return !!token && tokenValido(token);
}
