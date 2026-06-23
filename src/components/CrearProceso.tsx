"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CrearProceso() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [encabezado, setEncabezado] = useState("");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tieneOpciones, setTieneOpciones] = useState(false);
  const [etiqueta, setEtiqueta] = useState("Sede de preferencia");
  const [destinatarios, setDestinatarios] = useState("");
  const [firmantesTxt, setFirmantesTxt] = useState("");
  const [importando, setImportando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importarWord(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setError(null);
    try {
      // @ts-expect-error - mammoth.browser no incluye tipos
      const mammoth = (await import("mammoth/mammoth.browser")).default;
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      setCuerpo((prev) => (prev ? prev + "\n\n" : "") + value.trim());
    } catch {
      setError("No se pudo leer el archivo Word. Verifique que sea un .docx.");
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  function parseFirmantes() {
    return firmantesTxt
      .split(/\r?\n/)
      .map((l) => l.split(",").map((x) => x.trim()))
      .filter((p) => p[0] && p[1])
      .map((p) => ({
        cedula: p[0].replace(/[^\d]/g, ""),
        nombre_completo: p[1],
        opciones: tieneOpciones ? p.slice(2).filter(Boolean) : []
      }))
      .filter((f) => f.cedula && f.nombre_completo);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError("El proceso necesita un nombre."); return; }
    setCargando(true);
    try {
      const body = {
        nombre,
        doc_titulo: titulo || null,
        doc_encabezado: encabezado || null,
        doc_cuerpo: cuerpo || null,
        tiene_opciones: tieneOpciones,
        etiqueta_opcion: etiqueta || "Opción de preferencia",
        destinatarios: destinatarios.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
        firmantes: parseFirmantes()
      };
      const r = await fetch("/api/maestro/procesos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) { router.replace("/maestro/login"); return; }
      if (!r.ok) { setError(data.error ?? "No se pudo crear el proceso."); return; }
      router.replace(`/maestro/procesos/${data.proceso.id}`);
    } catch { setError("Error de conexión."); }
    finally { setCargando(false); }
  }

  const nFirmantes = parseFirmantes().length;

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-corte">Firmar nuevo documento</h1>
        <Link href="/maestro/procesos" className="btn-outline">Documentos anteriores</Link>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={crear} className="space-y-5">
        <div className="card space-y-4">
          <div>
            <label className="label">Nombre del proceso</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Proceso oficial - manifestación de sede…" required />
            <p className="text-xs text-slate-500 mt-1">Este nombre se ve en toda la consola y como asunto del correo.</p>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Documento</h2>
            <label className="btn-outline cursor-pointer text-sm">
              {importando ? "Importando…" : "Importar de Word (.docx)"}
              <input type="file" accept=".docx" className="hidden" onChange={importarWord} />
            </label>
          </div>
          <div>
            <label className="label">Encabezado / destinatario (opcional)</label>
            <textarea className="input min-h-[90px]" value={encabezado} onChange={(e) => setEncabezado(e.target.value)} placeholder={"Bogotá D.C., …\nHonorable Magistrado\n…"} />
            <p className="text-xs text-slate-500 mt-1">Cada línea es un renglón del encabezado.</p>
          </div>
          <div>
            <label className="label">Título / Asunto (opcional)</label>
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Asunto: …" />
          </div>
          <div>
            <label className="label">Cuerpo del documento</label>
            <textarea className="input min-h-[180px]" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Texto del documento. Separe los párrafos con una línea en blanco." />
            <p className="text-xs text-slate-500 mt-1">La app le agrega automáticamente la tabla de firmas con folios y QR.</p>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-slate-800">Opciones a escoger</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={tieneOpciones} onChange={(e) => setTieneOpciones(e.target.checked)} />
            Este documento requiere que cada firmante escoja una opción (ej. una sede)
          </label>
          {tieneOpciones && (
            <div>
              <label className="label">Nombre de la columna de opción</label>
              <input className="input" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Ej: Sede de preferencia" />
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-slate-800">Firmantes</h2>
          <p className="text-sm text-slate-600">
            Una persona por línea: <code>cédula, Nombre Completo{tieneOpciones ? ", opción A, opción B" : ""}</code>
          </p>
          <textarea className="input min-h-[160px] font-mono text-sm" value={firmantesTxt} onChange={(e) => setFirmantesTxt(e.target.value)}
            placeholder={tieneOpciones ? "12345678, JUAN PÉREZ, Bogotá, Medellín\n87654321, ANA GÓMEZ, Cali" : "12345678, JUAN PÉREZ\n87654321, ANA GÓMEZ"} />
          <p className="text-xs text-slate-500">{nFirmantes} firmante(s) detectado(s).</p>
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-slate-800">Destinatarios del documento final (opcional)</h2>
          <textarea className="input min-h-[70px] font-mono text-sm" value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder="correo1@dominio.com (uno por línea)" />
          <p className="text-xs text-slate-500">A quién se envía el documento final. Editable luego antes de enviar.</p>
        </div>

        <button className="btn-primary w-full" disabled={cargando}>{cargando ? "Creando…" : "Crear proceso"}</button>
      </form>
    </main>
  );
}
