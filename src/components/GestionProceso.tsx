"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FirmanteRow {
  cedula: string;
  nombre_completo: string;
  opciones: string[];
  elegida: string | null;
  ingreso_en: string | null;
  firmado: boolean;
  folio: number | null;
  correo_digitado: string | null;
  otp_validado_en: string | null;
  traza_url: string | null;
}
interface Proceso {
  id: string;
  nombre: string;
  tiene_opciones: boolean;
  etiqueta_opcion: string;
  destinatarios: string[];
  cerrada: boolean;
  cerrada_en: string | null;
  enviada_en: string | null;
  enviado_a: { para?: string[]; cc?: string[] } | null;
  creado_en: string;
}
interface Detalle { proceso: Proceso; firmantes: FirmanteRow[]; total: number; firmados: number; }

function fhora(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

export default function GestionProceso({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<Detalle | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "error"; x: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [correoPrueba, setCorreoPrueba] = useState("");
  const [destinos, setDestinos] = useState("");
  const [link, setLink] = useState("");

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/maestro/procesos/${id}`, { cache: "no-store" });
    if (r.status === 401) { router.replace("/maestro/login"); return; }
    const data = await r.json();
    if (r.ok) { setD(data); setDestinos((data.proceso.destinatarios ?? []).join("\n")); }
    else setMsg({ t: "error", x: data.error ?? "No se pudo cargar." });
  }, [id, router]);

  useEffect(() => {
    cargar();
    if (typeof window !== "undefined") setLink(`${window.location.origin}/p/${id}`);
  }, [cargar, id]);

  async function accion(body: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setTrabajando(true); setMsg(null);
    const r = await fetch(`/api/maestro/procesos/${id}/accion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    setTrabajando(false);
    if (r.ok) { setMsg({ t: "ok", x: "Operación realizada." }); await cargar(); }
    else setMsg({ t: "error", x: data.error ?? "No se pudo." });
  }

  async function guardarDestinos() {
    setTrabajando(true); setMsg(null);
    const lista = destinos.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const r = await fetch(`/api/maestro/procesos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinatarios: lista }) });
    setTrabajando(false);
    if (r.ok) { setMsg({ t: "ok", x: "Destinatarios guardados." }); await cargar(); }
    else setMsg({ t: "error", x: "No se pudo guardar." });
  }

  if (!d) return <div className="card">Cargando…</div>;
  const p = d.proceso;
  const primeraFirma = d.firmantes.filter((f) => f.firmado).map((f) => f.otp_validado_en).filter(Boolean).sort()[0] ?? null;

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-corte">{p.nombre}</h1>
        <Link href="/maestro/procesos" className="btn-outline">← Anteriores</Link>
      </div>

      {msg && <div className={msg.t === "ok" ? "alert-ok" : "alert-error"}>{msg.x}</div>}

      {/* Enlace para firmantes */}
      <div className="card">
        <label className="label">Enlace para los firmantes</label>
        <div className="flex gap-2">
          <input className="input font-mono text-sm" readOnly value={link} />
          <button className="btn-outline" onClick={() => { navigator.clipboard?.writeText(link); setMsg({ t: "ok", x: "Enlace copiado." }); }}>Copiar</button>
        </div>
      </div>

      {/* Estado + acciones */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat e="Firmados" v={`${d.firmados} / ${d.total}`} />
          <Stat e="Estado" v={p.cerrada ? "Cerrado" : "Abierto"} alerta={p.cerrada} />
          <Stat e="Documento" v={p.enviada_en ? "Enviado" : "Pendiente"} />
          <Stat e="Opciones" v={p.tiene_opciones ? "Sí" : "No"} />
        </div>

        <div className="flex flex-wrap gap-2 items-end border-t pt-4">
          <a className="btn-primary" href={`/api/maestro/procesos/${id}/preview-pdf`} target="_blank" rel="noreferrer">Vista previa PDF</a>
          <a className="btn-outline" href={`/api/maestro/procesos/${id}/preview-html`} target="_blank" rel="noreferrer">Vista previa HTML</a>
          {!p.cerrada
            ? <button className="btn-outline" disabled={trabajando} onClick={() => accion({ accion: "cerrar" }, "¿Cerrar el proceso? Ya nadie podrá firmar.")}>Cerrar proceso</button>
            : !p.enviada_en && <button className="btn-outline" disabled={trabajando} onClick={() => accion({ accion: "reabrir" }, "¿Reabrir?")}>Reabrir</button>}
          <button className="btn-primary" disabled={trabajando || !p.cerrada} onClick={() => accion({ accion: "enviar" }, "¿Enviar el documento final a los destinatarios (con copia a los firmantes)?")}>Enviar documento final</button>
        </div>

        {/* Envío de prueba */}
        <div className="flex flex-wrap gap-2 items-end border-t pt-4">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Enviar PRUEBA a (vista previa, sin afectar nada)</label>
            <input className="input" value={correoPrueba} onChange={(e) => setCorreoPrueba(e.target.value)} placeholder="tu-correo@dominio.com" />
          </div>
          <button className="btn-outline" disabled={trabajando || !correoPrueba} onClick={() => accion({ accion: "prueba", correo: correoPrueba })}>Enviar prueba</button>
        </div>
      </div>

      {/* Destinatarios */}
      <div className="card space-y-3">
        <h2 className="font-bold text-slate-800">Destinatarios del documento final</h2>
        <textarea className="input min-h-[70px] font-mono text-sm" value={destinos} onChange={(e) => setDestinos(e.target.value)} placeholder="uno por línea" />
        <button className="btn-primary" disabled={trabajando} onClick={guardarDestinos}>Guardar destinatarios</button>
      </div>

      {/* Datos de trazabilidad del proceso */}
      <div className="card space-y-1 text-sm">
        <h2 className="font-bold text-slate-800 mb-2">Trazabilidad del proceso</h2>
        <Linea k="Creado" v={fhora(p.creado_en)} />
        <Linea k="Primera firma (inicio)" v={fhora(primeraFirma)} />
        <Linea k="Cerrado" v={fhora(p.cerrada_en)} />
        <Linea k="Documento enviado" v={fhora(p.enviada_en)} />
        {p.enviado_a?.para && <Linea k="Enviado a (Para)" v={p.enviado_a.para.join(", ")} />}
        {p.enviado_a?.cc && <Linea k="Con copia a" v={`${p.enviado_a.cc.length} firmante(s)`} />}
      </div>

      {/* Firmantes */}
      <div className="card overflow-x-auto">
        <h2 className="font-bold text-slate-800 mb-3">Firmantes ({d.firmados}/{d.total})</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 border-b">
            <th className="py-2 pr-2">Nombre</th><th className="py-2 pr-2">Cédula</th>
            {p.tiene_opciones && <th className="py-2 pr-2">{p.etiqueta_opcion}</th>}
            <th className="py-2 pr-2">Folio</th><th className="py-2 pr-2">Fecha firma</th><th className="py-2 pr-2">Estado</th><th className="py-2 pr-2">Traza</th>
          </tr></thead>
          <tbody>
            {d.firmantes.map((f) => (
              <tr key={f.cedula} className="border-b last:border-0">
                <td className="py-2 pr-2">{f.nombre_completo}</td>
                <td className="py-2 pr-2 font-mono text-xs">{f.cedula}</td>
                {p.tiene_opciones && <td className="py-2 pr-2">{f.elegida ?? "—"}</td>}
                <td className="py-2 pr-2 font-mono">{f.folio != null ? String(f.folio).padStart(2, "0") : "—"}</td>
                <td className="py-2 pr-2 text-xs">{fhora(f.otp_validado_en)}</td>
                <td className="py-2 pr-2">{f.firmado ? <span className="text-emerald-700 font-semibold text-xs">Firmó</span> : <span className="text-slate-400 text-xs">Pendiente</span>}</td>
                <td className="py-2 pr-2">{f.traza_url ? <a className="text-corte underline text-xs" href={f.traza_url} target="_blank" rel="noreferrer">ver</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ e, v, alerta = false }: { e: string; v: string; alerta?: boolean }) {
  return <div><div className="text-xs uppercase tracking-wide text-slate-400">{e}</div><div className={`text-lg font-bold ${alerta ? "text-amber-600" : "text-slate-800"}`}>{v}</div></div>;
}
function Linea({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="text-slate-500">{k}:</span><span className="font-medium text-slate-800">{v}</span></div>;
}
