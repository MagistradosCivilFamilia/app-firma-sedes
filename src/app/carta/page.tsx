"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Fila1 {
  puesto_lista: number;
  nombre_completo: string;
  cedula: string;
  sede_elegida: string | null;
  firmado: boolean;
}

interface Fila2 {
  nombre_completo: string;
  cedula: string;
  correo: string | null;
  folio_mostrado: string;
  fecha_firma: string;
  nota_firma: string;
  traza_url: string;
  qr: string;
}

interface Carta {
  fecha: string;
  presidente: string;
  asunto: string;
  parrafo1: string;
  parrafo2: string;
  nota_legal: string;
}

interface Datos {
  es_prueba: boolean;
  carta_cerrada: boolean;
  enviada_en: string | null;
  resumen: { total: number; firmados: number; eligieron: number; pendientes: number };
  carta: Carta;
  tabla1: Fila1[];
  tabla2: Fila2[];
}

export const dynamic = "force-dynamic";

export default function VistaCarta() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/carta", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "No se pudo cargar la carta.");
        return;
      }
      setDatos(data);
      setActualizado(new Date());
      setError(null);
    } catch {
      setError("Error de conexión.");
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 7000); // refresco en vivo
    return () => clearInterval(id);
  }, [cargar]);

  if (error && !datos) return <div className="card alert-error">{error}</div>;
  if (!datos) return <div className="card">Cargando…</div>;

  const { carta, resumen, tabla1, tabla2 } = datos;
  const pct = resumen.total > 0 ? Math.round((resumen.firmados / resumen.total) * 100) : 0;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-corte">La carta y el estado de las firmas</h1>
        <Link href="/" className="btn-primary">Firmar</Link>
      </div>

      {/* Resumen en vivo */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-slate-600">
            <span className="font-bold text-emerald-700">{resumen.firmados}</span> de {resumen.total} firmaron ·{" "}
            <span className="text-sky-700">{resumen.eligieron}</span> eligieron ·{" "}
            <span className="text-slate-500">{resumen.pendientes}</span> pendientes
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            En vivo{actualizado ? ` · ${actualizado.toLocaleTimeString("es-CO")}` : ""}
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {datos.carta_cerrada && (
          <p className="mt-3 text-sm text-amber-700 font-medium">
            La carta fue cerrada por el responsable del proceso.
            {datos.enviada_en ? " El documento final ya fue enviado." : ""}
          </p>
        )}
      </div>

      {/* Documento de la carta */}
      <div className="card">
        <div className="text-slate-700 leading-relaxed space-y-3 text-[15px]">
          <p>Bogotá D.C., {carta.fecha}</p>
          <div>
            <p>Honorable Magistrado</p>
            <p className="font-bold">{carta.presidente}</p>
            <p>Presidente y demás integrantes de la Sala Plena</p>
            <p className="font-bold">CORTE SUPREMA DE JUSTICIA</p>
            <p>Ciudad</p>
          </div>
          <p className="font-semibold">Asunto: {carta.asunto}</p>
          <p>Respetados Magistrados:</p>
          <p className="text-justify">{carta.parrafo1}</p>
          <p className="text-justify">{carta.parrafo2}</p>
        </div>

        {/* TABLA 1 — Sede de preferencia */}
        <h2 className="mt-6 mb-2 font-bold text-slate-800">Sede de preferencia</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-3 py-2">Nombre</th>
                <th className="border border-slate-300 px-3 py-2">Cédula</th>
                <th className="border border-slate-300 px-3 py-2">Sede de preferencia</th>
              </tr>
            </thead>
            <tbody>
              {tabla1.map((f) => (
                <tr key={f.puesto_lista} className={f.firmado ? "bg-emerald-50/40" : ""}>
                  <td className="border border-slate-300 px-3 py-2">{f.nombre_completo}</td>
                  <td className="border border-slate-300 px-3 py-2 font-mono text-xs">{f.cedula}</td>
                  <td className="border border-slate-300 px-3 py-2">
                    {f.sede_elegida ?? <span className="text-slate-400">Pendiente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nota legal */}
        <p className="mt-4 text-sm text-slate-600 border-l-4 border-slate-300 pl-3">
          <strong>Nota:</strong> {carta.nota_legal}
        </p>

        <p className="mt-4">Atentamente;</p>

        {/* TABLA 2 — FIRMAS */}
        <h2 className="mt-6 mb-2 font-bold text-slate-800">FIRMAS</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-3 py-2">Aspirante</th>
                <th className="border border-slate-300 px-3 py-2">Cédula</th>
                <th className="border border-slate-300 px-3 py-2">Correo Electrónico</th>
                <th className="border border-slate-300 px-3 py-2">Firma electrónica</th>
                <th className="border border-slate-300 px-3 py-2 text-center">Código QR</th>
              </tr>
            </thead>
            <tbody>
              {tabla2.length === 0 ? (
                <tr>
                  <td className="border border-slate-300 px-3 py-3 text-slate-400 italic" colSpan={5}>
                    Aún no hay firmas registradas.
                  </td>
                </tr>
              ) : (
                tabla2.map((f) => (
                  <tr key={f.cedula} className="align-top">
                    <td className="border border-slate-300 px-3 py-2">{f.nombre_completo}</td>
                    <td className="border border-slate-300 px-3 py-2 font-mono text-xs">{f.cedula}</td>
                    <td className="border border-slate-300 px-3 py-2 text-xs break-all">{f.correo ?? "—"}</td>
                    <td className="border border-slate-300 px-3 py-2 text-xs leading-relaxed">
                      <div><strong>Folio:</strong> {f.folio_mostrado}</div>
                      <div><strong>Fecha y hora:</strong> {f.fecha_firma}</div>
                      <div className="italic mt-1">{f.nota_firma}</div>
                      <div className="text-slate-500 mt-1">
                        Conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.
                      </div>
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      <a href={f.traza_url} target="_blank" rel="noreferrer" title="Ver trazabilidad">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.qr} alt="Código QR de trazabilidad" width={96} height={96} className="mx-auto" />
                      </a>
                      <div className="text-[10px] text-slate-400 mt-1">Escanee para verificar</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Vista pública de solo lectura · se actualiza automáticamente.
      </p>
    </main>
  );
}
