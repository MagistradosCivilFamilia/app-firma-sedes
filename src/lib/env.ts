// Lectura central de variables de entorno. Lanza error claro si falta algo
// crítico, en vez de fallar con un error genérico más adelante.

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return v.trim();
}

function opt(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export type Modo = "real" | "prueba";

export function getModo(): Modo {
  const m = opt("MODO", "prueba").toLowerCase();
  return m === "real" ? "real" : "prueba";
}

export const env = {
  get modo(): Modo {
    return getModo();
  },
  get supabaseUrl(): string {
    return req("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceKey(): string {
    return req("SUPABASE_SERVICE_ROLE_KEY");
  },
  get gmailUser(): string {
    return req("GMAIL_USER");
  },
  get gmailAppPassword(): string {
    // Las contraseñas de aplicación de Google suelen mostrarse con espacios; los quitamos.
    return req("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  },
  get mailFromName(): string {
    return opt("MAIL_FROM_NAME", "Proceso opción de sede");
  },
  get maestroPassword(): string {
    return req("MAESTRO_PASSWORD");
  },
  get sessionSecret(): string {
    return req("SESSION_SECRET");
  },
  get baseUrl(): string {
    return opt("NEXT_PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  }
};
