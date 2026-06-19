"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LoginMaestro() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch("/api/maestro/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.replace("/maestro");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm">
      <div className="card">
        <h1 className="text-xl font-bold text-corte mb-1">Consola del maestro</h1>
        <p className="text-sm text-slate-500 mb-4">Acceso restringido al responsable del proceso.</p>
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="label" htmlFor="pw">Contraseña</label>
            <input
              id="pw"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={cargando}>
            {cargando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
