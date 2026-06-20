import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Cliente Supabase SÓLO de servidor, con la service_role key.
// Nunca se importa desde componentes cliente. Bypassa RLS de forma controlada.
let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // Next.js cachea las respuestas de fetch por defecto. Supabase usa fetch,
        // así que sin esto las lecturas devolverían datos viejos (p. ej. firmas
        // que no aparecen). Forzamos no-store en cada consulta.
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" })
      }
    });
  }
  return _client;
}
