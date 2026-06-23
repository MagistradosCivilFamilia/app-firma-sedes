"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProcRow {
  id: string;
  nombre: string;
  creado_en: string;
  total: number;
  firmados: number;
  cerrada: boolean;
  enviada_en: string | null;
}

function fhora(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export default function HistorialProcesos() {
  const router = useRouter();
  const [procesos, setProcesos] = useState<ProcRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/maestro/procesos", { cache: "no-store" });
      if (r.status === 401) { router.replace("/maestro/login"); return; }
      const data = await r.json();
      if (r.ok) setProcesos(data.procesos);
      else setError(data.error ?? "No se pudo cargar.");
    })();
  }, [router]);

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-corte">Documentos anteriores</h1>
        <Link href="/maestro/procesos/nuevo" className="btn-primary">+ Firmar nuevo documento</Link>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Proceso original (los 22) */}
      <Link href="/maestro" className="block card hover:bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-800">Manifestación de sede · Sala Civil-Familia (proceso original)</div>
            <div className="text-xs text-slate-500">Los 22 · gestionado en la consola principal</div>
          </div>
          <span className="text-corte text-sm">Abrir →</span>
        </div>
      </Link>

      <div className="card overflow-x-auto">
        <h2 className="font-bold text-slate-800 mb-3">Procesos creados</h2>
        {!procesos ? (
          <p className="text-slate-500">Cargando…</p>
        ) : procesos.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no hay procesos nuevos. Usa “Firmar nuevo documento”.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-2">Proceso</th><th className="py-2 pr-2">Creado</th><th className="py-2 pr-2">Firmados</th><th className="py-2 pr-2">Estado</th><th className="py-2 pr-2"></th>
            </tr></thead>
            <tbody>
              {procesos.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{p.nombre}</td>
                  <td className="py-2 pr-2 text-xs">{fhora(p.creado_en)}</td>
                  <td className="py-2 pr-2">{p.firmados}/{p.total}</td>
                  <td className="py-2 pr-2 text-xs">
                    {p.enviada_en ? "Enviado" : p.cerrada ? "Cerrado" : "Abierto"}
                  </td>
                  <td className="py-2 pr-2"><Link className="text-corte underline" href={`/maestro/procesos/${p.id}`}>Ver / gestionar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
