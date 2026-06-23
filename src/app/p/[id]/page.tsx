"use client";

import { useState } from "react";

interface DocPublico {
  nombre: string;
  doc_titulo: string | null;
  doc_encabezado: string | null;
  doc_cuerpo: string | null;
  tiene_opciones: boolean;
  etiqueta_opcion: string;
  cerrada: boolean;
}
interface FirmanteDTO {
  cedula: string;
  nombre_completo: string;
  opciones: string[];
  elegida: string | null;
  tiene_opciones: boolean;
  firmado: boolean;
  folio_mostrado: string | null;
  correo_digitado: string | null;
}
type Paso = "cedula" | "documento" | "correo" | "otp" | "firmado" | "cerrada";

async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function Parrafos({ texto, justify = false }: { texto: string | null; justify?: boolean }) {
  if (!texto) return null;
  const ps = texto.split(/\r?\n/).map((l) => l.trim());
  return (
    <>
      {ps.map((l, i) =>
        l === "" ? <div key={i} className="h-2" /> : <p key={i} className={justify ? "text-justify" : ""}>{l}</p>
      )}
    </>
  );
}

export default function FirmaProceso({ params }: { params: { id: string } }) {
  const pid = params.id;
  const [paso, setPaso] = useState<Paso>("cedula");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [cedula, setCedula] = useState("");
  const [doc, setDoc] = useState<DocPublico | null>(null);
  const [firmante, setFirmante] = useState<FirmanteDTO | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<{ folio_mostrado: string; fecha_firma: string; traza_url: string } | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { ok, data } = await postJSON(`/api/proceso/${pid}/firmante`, { cedula });
      if (!ok) { setError(data.error ?? "No se pudo consultar."); return; }
      setDoc(data.documento);
      const f: FirmanteDTO = data.firmante;
      setFirmante(f);
      setSel(f.elegida ?? (f.tiene_opciones ? null : null));
      if (f.firmado) {
        setResultado({ folio_mostrado: f.folio_mostrado ?? "—", fecha_firma: "", traza_url: "" });
        setPaso("firmado");
      } else if (data.documento.cerrada) {
        setPaso("cerrada");
      } else {
        setPaso("documento");
      }
    } catch { setError("Error de conexión."); }
    finally { setCargando(false); }
  }

  async function continuarAFirmar() {
    if (!firmante) return;
    setError(null);
    setCargando(true);
    try {
      if (firmante.tiene_opciones) {
        if (!sel) { setError("Seleccione una opción."); setCargando(false); return; }
        const { ok, data } = await postJSON(`/api/proceso/${pid}/elegir`, { cedula, elegida: sel });
        if (!ok) { setError(data.error ?? "No se pudo guardar la elección."); return; }
      }
      setPaso("correo");
    } catch { setError("Error de conexión."); }
    finally { setCargando(false); }
  }

  async function enviarCodigo(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null); setAviso(null); setCargando(true);
    try {
      const { ok, data } = await postJSON(`/api/proceso/${pid}/otp/enviar`, { cedula, correo });
      if (!ok) { setError(data.error ?? "No se pudo enviar el código."); return; }
      setAviso(`Enviamos un código a ${data.correo}. Vence en ${data.vigencia_min} minutos.`);
      setPaso("otp");
    } catch { setError("Error de conexión."); }
    finally { setCargando(false); }
  }

  async function validar(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setCargando(true);
    try {
      const { ok, data } = await postJSON(`/api/proceso/${pid}/otp/validar`, { cedula, codigo });
      if (!ok) { setError(data.error ?? "Código incorrecto."); return; }
      setResultado({ folio_mostrado: data.folio_mostrado, fecha_firma: data.fecha_firma ?? "", traza_url: data.traza_url });
      setPaso("firmado");
    } catch { setError("Error de conexión."); }
    finally { setCargando(false); }
  }

  return (
    <main className="space-y-4">
      <header className="text-center">
        <h1 className="text-xl font-bold text-corte">{doc?.nombre ?? "Firma de documento"}</h1>
      </header>

      <div className="card">
        {error && <div className="alert-error mb-4">{error}</div>}
        {aviso && paso !== "firmado" && <div className="alert-ok mb-4">{aviso}</div>}

        {paso === "cedula" && (
          <form onSubmit={buscar} className="space-y-4">
            <p className="text-slate-600">Digite su número de cédula para ver y firmar el documento.</p>
            <input className="input" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="Número de cédula" required />
            <button className="btn-primary w-full" disabled={cargando}>{cargando ? "Consultando…" : "Continuar"}</button>
          </form>
        )}

        {paso === "documento" && doc && firmante && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Firmante</div>
              <div className="font-semibold">{firmante.nombre_completo}</div>
              <div className="text-xs text-slate-500">C.C. {firmante.cedula}</div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed max-h-80 overflow-y-auto space-y-1">
              <Parrafos texto={doc.doc_encabezado} />
              {doc.doc_titulo && <p className="font-semibold mt-2">{doc.doc_titulo}</p>}
              <div className="mt-2"><Parrafos texto={doc.doc_cuerpo} justify /></div>
            </div>

            {firmante.tiene_opciones && (
              <div>
                <p className="label">{doc.etiqueta_opcion}:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {firmante.opciones.map((o) => (
                    <button key={o} onClick={() => setSel(o)} className={`btn-outline text-left ${sel === o ? "ring-2 ring-corte border-corte" : ""}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-slate-700 font-medium">¿Desea firmar este documento?</p>
            <button className="btn-primary w-full" onClick={continuarAFirmar} disabled={cargando}>
              {cargando ? "Procesando…" : "Sí, deseo firmar"}
            </button>
          </div>
        )}

        {paso === "correo" && (
          <form onSubmit={enviarCodigo} className="space-y-4">
            <p className="text-slate-600">Enviaremos un código de verificación a su correo.</p>
            <input className="input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@correo.com" required />
            <div className="flex gap-3">
              <button className="btn-primary flex-1" disabled={cargando}>{cargando ? "Enviando…" : "Enviar código"}</button>
              <button type="button" className="btn-outline" onClick={() => setPaso("documento")} disabled={cargando}>Atrás</button>
            </div>
            <button type="button" className="text-sm text-corte underline w-full text-center" onClick={() => { setError(null); setAviso(null); setPaso("otp"); }} disabled={cargando}>
              Ya tengo un código — ingresarlo
            </button>
          </form>
        )}

        {paso === "otp" && (
          <form onSubmit={validar} className="space-y-4">
            <label className="label">Código de verificación (6 dígitos)</label>
            <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required />
            <button className="btn-primary w-full" disabled={cargando || codigo.length !== 6}>{cargando ? "Validando…" : "Firmar"}</button>
            <button type="button" className="btn-outline w-full" onClick={() => enviarCodigo()} disabled={cargando}>Reenviar código</button>
          </form>
        )}

        {paso === "firmado" && resultado && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold text-emerald-700">Firma registrada</h2>
            {firmante && <p>{firmante.nombre_completo}</p>}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 inline-block text-left">
              <div className="text-sm"><span className="text-slate-500">Folio:</span> <strong>{resultado.folio_mostrado}</strong></div>
              {resultado.fecha_firma && <div className="text-sm"><span className="text-slate-500">Fecha:</span> {resultado.fecha_firma}</div>}
            </div>
            {resultado.traza_url && (
              <p className="text-sm">Trazabilidad: <a className="text-corte underline" href={resultado.traza_url} target="_blank" rel="noreferrer">{resultado.traza_url}</a></p>
            )}
            <p className="text-xs text-slate-500">Le enviamos un correo de confirmación.</p>
          </div>
        )}

        {paso === "cerrada" && (
          <div className="space-y-3">
            <div className="alert-error">El proceso ya fue cerrado. No es posible firmar.</div>
          </div>
        )}
      </div>

      <footer className="text-center text-xs text-slate-400">
        Firma electrónica conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.
      </footer>
    </main>
  );
}
