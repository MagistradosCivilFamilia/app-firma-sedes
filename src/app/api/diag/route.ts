import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico SIN secretos: indica qué variables llegaron (solo true/false) y
// si Supabase responde. Útil para verificar el despliegue. No expone valores.
export async function GET() {
  const present = (n: string) => !!process.env[n] && process.env[n]!.trim() !== "";
  const envPresence = {
    MODO: process.env.MODO ?? null,
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
    GMAIL_USER: present("GMAIL_USER"),
    GMAIL_APP_PASSWORD: present("GMAIL_APP_PASSWORD"),
    MAESTRO_PASSWORD: present("MAESTRO_PASSWORD"),
    SESSION_SECRET: present("SESSION_SECRET"),
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? null
  };

  let supabase: string;
  try {
    const { error } = await db().from("proceso_estado").select("modo").limit(1);
    supabase = error ? `ERROR: ${error.message}` : "ok";
  } catch (e) {
    supabase = `EXCEPTION: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ envPresence, supabase, ts: new Date().toISOString() });
}
