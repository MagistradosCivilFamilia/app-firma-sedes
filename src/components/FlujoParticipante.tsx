"use client";

import { useState } from "react";

// Tipo local (espejo de ParticipanteDTO) para no importar código de servidor.
interface ParticipanteDTO {
  cedula: string;
  nombre_completo: string;
  sede_opcion_a: string;
  sede_opcion_b: string | null;
  sede_elegida: string | null;
  tiene_dos_opciones: boolean;
  firmado: boolean;
  folio_mostrado: string | null;
  correo_digitado: string | null;
  traza_url: string | null;
}

type Paso = "cedula" | "eleccion" | "confirmar" | "correo" | "otp" | "firmado" | "cerrada";

interface ResultadoFirma {
  folio_mostrado: string;
  fecha_firma: string;
  traza_url: string;
}

async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default function FlujoParticipante() {
  const [paso, setPaso] = useState<Paso>("cedula");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cedula, setCedula] = useState("");
  const [participante, setParticipante] = useState<ParticipanteDTO | null>(null);
  const [sedeSel, setSedeSel] = useState<string | null>(null);
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<ResultadoFirma | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function reiniciar() {
    setPaso("cedula");
    setParticipante(null);
    setSedeSel(null);
    setCorreo("");
    setCodigo("");
    setResultado(null);
    setError(null);
    setAviso(null);
    setCedula("");
  }

  async function buscarCedula(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { ok, data } = await postJSON("/api/participante", { cedula });
      if (!ok) {
        setError(data.error ?? "No se pudo consultar la cédula.");
        return;
      }
      const p: ParticipanteDTO = data.participante;
      setParticipante(p);
      setSedeSel(p.sede_elegida ?? (p.tiene_dos_opciones ? null : p.sede_opcion_a));

      if (p.firmado) {
        setResultado({
          folio_mostrado: p.folio_mostrado ?? "—",
          fecha_firma: "",
          traza_url: p.traza_url ?? ""
        });
        setPaso("firmado");
      } else if (data.carta_cerrada) {
        setPaso("cerrada");
      } else if (p.tiene_dos_opciones) {
        setPaso("eleccion");
      } else {
        setPaso("confirmar");
      }
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function elegirSede(sede: string) {
    setError(null);
    setCargando(true);
    try {
      const { ok, data } = await postJSON("/api/elegir", { cedula, sede });
      if (!ok) {
        setError(data.error ?? "No se pudo guardar la elección.");
        return;
      }
      setParticipante(data.participante);
      setSedeSel(sede);
      setPaso("confirmar");
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function confirmarYFirmar() {
    if (!participante || !sedeSel) return;
    setError(null);
    setCargando(true);
    try {
      // Para quienes tienen una sola opción, persistimos la sede al confirmar.
      if (participante.sede_elegida !== sedeSel) {
        const { ok, data } = await postJSON("/api/elegir", { cedula, sede: sedeSel });
        if (!ok) {
          setError(data.error ?? "No se pudo registrar la sede.");
          return;
        }
        setParticipante(data.participante);
      }
      setPaso("correo");
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarCodigo(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);
    try {
      const { ok, data } = await postJSON("/api/otp/enviar", { cedula, correo });
      if (!ok) {
        setError(data.error ?? "No se pudo enviar el código.");
        return;
      }
      setAviso(`Enviamos un código de 6 dígitos a ${data.correo}. Vence en ${data.vigencia_min} minutos.`);
      setPaso("otp");
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function validarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { ok, data } = await postJSON("/api/otp/validar", { cedula, codigo });
      if (!ok) {
        setError(data.error ?? "Código incorrecto.");
        return;
      }
      setResultado({
        folio_mostrado: data.folio_mostrado,
        fecha_firma: data.fecha_firma ?? "",
        traza_url: data.traza_url
      });
      setPaso("firmado");
    } catch {
      setError("Error de conexión. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  // -------------------------------------------------------------------------

  return (
    <div className="card">
      {error && <div className="alert-error mb-4">{error}</div>}
      {aviso && paso !== "firmado" && <div className="alert-ok mb-4">{aviso}</div>}

      {paso === "cedula" && (
        <form onSubmit={buscarCedula} className="space-y-4">
          <p className="text-slate-600">Para iniciar, digite su número de cédula.</p>
          <div>
            <label className="label" htmlFor="cedula">Número de cédula</label>
            <input
              id="cedula"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej: 1085245321"
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={cargando}>
            {cargando ? "Consultando…" : "Continuar"}
          </button>
        </form>
      )}

      {participante && paso === "eleccion" && (
        <div className="space-y-4">
          <Saludo p={participante} />
          <p className="text-slate-600">Seleccione la sede de su preferencia:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[participante.sede_opcion_a, participante.sede_opcion_b].filter(Boolean).map((s) => (
              <button
                key={s}
                onClick={() => elegirSede(s as string)}
                disabled={cargando}
                className={`btn-outline text-left ${sedeSel === s ? "ring-2 ring-corte border-corte" : ""}`}
              >
                <span className="font-semibold">{s}</span>
              </button>
            ))}
          </div>
          {participante.sede_elegida && (
            <p className="text-xs text-slate-500">
              Elección actual: <strong>{participante.sede_elegida}</strong>. Puede cambiarla seleccionando otra.
            </p>
          )}
        </div>
      )}

      {participante && paso === "confirmar" && sedeSel && (
        <div className="space-y-5">
          <Saludo p={participante} />
          {!participante.tiene_dos_opciones && (
            <p className="text-slate-600">
              Usted tiene una única sede disponible para este proceso:
            </p>
          )}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-slate-500">Sede elegida</div>
            <div className="text-lg font-bold text-corte">{sedeSel}</div>
          </div>
          <p className="text-slate-700 font-medium">¿Desea firmar este documento con la sede elegida?</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="btn-primary flex-1" onClick={confirmarYFirmar} disabled={cargando}>
              {cargando ? "Procesando…" : "Sí, deseo firmar"}
            </button>
            {participante.tiene_dos_opciones && (
              <button className="btn-outline flex-1" onClick={() => setPaso("eleccion")} disabled={cargando}>
                Cambiar de sede
              </button>
            )}
          </div>
        </div>
      )}

      {participante && paso === "correo" && (
        <form onSubmit={enviarCodigo} className="space-y-4">
          <Saludo p={participante} />
          <p className="text-slate-600">
            Para firmar, enviaremos un código de verificación a su correo electrónico.
          </p>
          <div>
            <label className="label" htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              type="email"
              className="input"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="nombre@correo.com"
              required
            />
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex-1" disabled={cargando}>
              {cargando ? "Enviando…" : "Enviar código"}
            </button>
            <button type="button" className="btn-outline" onClick={() => setPaso("confirmar")} disabled={cargando}>
              Atrás
            </button>
          </div>
          <button
            type="button"
            className="text-sm text-corte underline w-full text-center"
            onClick={() => { setError(null); setAviso(null); setPaso("otp"); }}
            disabled={cargando}
          >
            Ya tengo un código — ingresarlo
          </button>
        </form>
      )}

      {participante && paso === "otp" && (
        <form onSubmit={validarCodigo} className="space-y-4">
          <Saludo p={participante} />
          <div>
            <label className="label" htmlFor="codigo">Código de verificación (6 dígitos)</label>
            <input
              id="codigo"
              className="input text-center text-2xl tracking-[0.5em]"
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={cargando || codigo.length !== 6}>
            {cargando ? "Validando…" : "Firmar"}
          </button>
          <button
            type="button"
            className="btn-outline w-full"
            onClick={() => enviarCodigo()}
            disabled={cargando}
          >
            Reenviar código
          </button>
        </form>
      )}

      {paso === "firmado" && resultado && (
        <div className="space-y-4 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-emerald-700">Firma registrada</h2>
          {participante && <p className="text-slate-700">{participante.nombre_completo}</p>}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-left inline-block mx-auto">
            <Linea k="Folio de firma" v={resultado.folio_mostrado} />
            {resultado.fecha_firma && <Linea k="Fecha y hora" v={resultado.fecha_firma} />}
            {participante?.sede_elegida && <Linea k="Sede elegida" v={participante.sede_elegida} />}
          </div>
          {resultado.traza_url && (
            <p className="text-sm">
              Trazabilidad pública:{" "}
              <a className="text-corte underline" href={resultado.traza_url} target="_blank" rel="noreferrer">
                {resultado.traza_url}
              </a>
            </p>
          )}
          <p className="text-xs text-slate-500">
            Le enviamos un correo de confirmación. El documento colectivo final será radicado por el
            responsable del proceso.
          </p>
          <button className="btn-outline" onClick={reiniciar}>Salir</button>
        </div>
      )}

      {paso === "cerrada" && participante && (
        <div className="space-y-4">
          <Saludo p={participante} />
          <div className="alert-error">
            La carta ya fue cerrada por el responsable del proceso. No es posible firmar ni cambiar la
            elección.
          </div>
          {participante.sede_elegida && (
            <Linea k="Su elección registrada" v={participante.sede_elegida} />
          )}
          <button className="btn-outline" onClick={reiniciar}>Salir</button>
        </div>
      )}
    </div>
  );
}

function Saludo({ p }: { p: ParticipanteDTO }) {
  return (
    <div className="border-b border-slate-100 pb-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">Aspirante</div>
      <div className="font-semibold text-slate-800">{p.nombre_completo}</div>
      <div className="text-xs text-slate-500">C.C. {p.cedula}</div>
    </div>
  );
}

function Linea({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="text-slate-500">{k}:</span>
      <span className="font-medium text-slate-800">{v}</span>
    </div>
  );
}
