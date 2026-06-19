"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PartFila {
  puesto_lista: number;
  cedula: string;
  nombre_completo: string;
  sede_opcion_a: string;
  sede_opcion_b: string | null;
  tiene_dos_opciones: boolean;
  sede_elegida: string | null;
  ingreso_en: string | null;
  firmado: boolean;
  folio_mostrado: string | null;
  correo_digitado: string | null;
  otp_validado_en: string | null;
  correo_final_enviado_en: string | null;
  correo_destino_prueba: string | null;
}

interface EstadoProc {
  modo: string;
  carta_cerrada: boolean;
  cerrada_en: string | null;
  enviada_en: string | null;
  fecha_carta: string | null;
  destinatarios: string[];
  frase_opciones: string;
}

interface Datos {
  modo: string;
  es_prueba: boolean;
  estado: EstadoProc;
  participantes: PartFila[];
  total: number;
  firmados: number;
}

async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default function ConsolaMaestro() {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  // Editor de destinatarios / fecha / frase
  const [destinos, setDestinos] = useState("");
  const [fechaCarta, setFechaCarta] = useState("");
  const [frase, setFrase] = useState("");

  // Form de participante de prueba
  const [pf, setPf] = useState({
    cedula: "",
    nombre_completo: "",
    sede_opcion_a: "",
    sede_opcion_b: "",
    correo_destino_prueba: ""
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    const { ok, status, data } = await api("/api/maestro/datos");
    if (status === 401) {
      router.replace("/maestro/login");
      return;
    }
    if (ok) {
      setDatos(data);
      setDestinos((data.estado.destinatarios ?? []).join("\n"));
      setFechaCarta(data.estado.fecha_carta ?? "");
      setFrase(data.estado.frase_opciones ?? "");
    } else {
      setMsg({ tipo: "error", texto: data.error ?? "No se pudieron cargar los datos." });
    }
    setCargando(false);
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function aviso(tipo: "ok" | "error", texto: string) {
    setMsg({ tipo, texto });
  }

  async function accionSimple(url: string, body?: unknown, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setTrabajando(true);
    setMsg(null);
    const { ok, data } = await api(url, "POST", body ?? {});
    setTrabajando(false);
    if (ok) {
      aviso("ok", "Operación realizada.");
      await cargar();
    } else {
      aviso("error", data.error ?? "No se pudo completar la operación.");
    }
  }

  async function guardarConfig() {
    setTrabajando(true);
    setMsg(null);
    const lista = destinos.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const { ok, data } = await api("/api/maestro/config", "POST", {
      destinatarios: lista,
      fecha_carta: fechaCarta || null,
      frase_opciones: frase
    });
    setTrabajando(false);
    if (ok) {
      aviso("ok", "Configuración guardada.");
      await cargar();
    } else {
      aviso("error", data.error ?? "No se pudo guardar.");
    }
  }

  async function enviarDocumento() {
    const dest = destinos.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const confirmar =
      `Se enviará el documento final a:\n${dest.join(", ")}\n\n` +
      `con copia a todos los firmantes. ¿Confirma el envío?`;
    await accionSimple("/api/maestro/enviar", {}, confirmar);
  }

  async function verificarSmtp() {
    setTrabajando(true);
    const { ok, data } = await api("/api/maestro/smtp");
    setTrabajando(false);
    aviso(ok ? "ok" : "error", data.mensaje ?? (ok ? "Conexión OK." : "Falló la conexión."));
  }

  async function guardarPrueba(e: React.FormEvent) {
    e.preventDefault();
    setTrabajando(true);
    const { ok, data } = await api("/api/maestro/prueba", "POST", { accion: "upsert", ...pf });
    setTrabajando(false);
    if (ok) {
      aviso("ok", "Participante de prueba guardado.");
      setPf({ cedula: "", nombre_completo: "", sede_opcion_a: "", sede_opcion_b: "", correo_destino_prueba: "" });
      await cargar();
    } else {
      aviso("error", data.error ?? "No se pudo guardar.");
    }
  }

  async function logout() {
    await api("/api/maestro/logout", "POST", {});
    router.replace("/maestro/login");
    router.refresh();
  }

  if (cargando || !datos) {
    return <div className="card">Cargando…</div>;
  }

  const e = datos.estado;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-corte">Consola del maestro</h1>
        <button className="btn-outline" onClick={logout}>Salir</button>
      </div>

      {msg && (
        <div className={msg.tipo === "ok" ? "alert-ok" : "alert-error"}>{msg.texto}</div>
      )}

      {/* Resumen / estado */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat etiqueta="Modo" valor={datos.es_prueba ? "PRUEBA" : "REAL"} alerta={datos.es_prueba} />
          <Stat etiqueta="Firmados" valor={`${datos.firmados} / ${datos.total}`} />
          <Stat etiqueta="Carta" valor={e.carta_cerrada ? "Cerrada" : "Abierta"} alerta={e.carta_cerrada} />
          <Stat etiqueta="Documento" valor={e.enviada_en ? "Enviado" : "Pendiente"} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {!e.carta_cerrada ? (
            <button
              className="btn-primary"
              disabled={trabajando}
              onClick={() =>
                accionSimple("/api/maestro/cerrar", { abrir: false },
                  "¿Cerrar la carta? Los participantes ya no podrán firmar ni cambiar su elección.")
              }
            >
              Cerrar la carta
            </button>
          ) : (
            !e.enviada_en && (
              <button
                className="btn-outline"
                disabled={trabajando}
                onClick={() => accionSimple("/api/maestro/cerrar", { abrir: true }, "¿Reabrir la carta?")}
              >
                Reabrir la carta
              </button>
            )
          )}

          <a className="btn-outline" href="/api/maestro/preview" target="_blank" rel="noreferrer">
            Vista previa del documento
          </a>

          <button
            className="btn-primary"
            disabled={trabajando || !e.carta_cerrada}
            onClick={enviarDocumento}
            title={!e.carta_cerrada ? "Primero cierre la carta" : ""}
          >
            Enviar documento final
          </button>

          <button className="btn-outline" disabled={trabajando} onClick={verificarSmtp}>
            Verificar conexión Gmail
          </button>

          <button className="btn-outline" disabled={trabajando} onClick={cargar}>
            Actualizar
          </button>
        </div>
        {e.enviada_en && (
          <p className="mt-3 text-sm text-emerald-700">Documento final enviado.</p>
        )}
      </div>

      {/* Destinatarios / fecha / frase */}
      <div className="card space-y-4">
        <h2 className="font-bold text-slate-800">Configuración del envío</h2>
        <div>
          <label className="label">Destinatarios (uno por línea)</label>
          <textarea
            className="input min-h-[90px] font-mono text-sm"
            value={destinos}
            onChange={(ev) => setDestinos(ev.target.value)}
            placeholder="secretariag@cortesuprema.gov.co"
          />
          <p className="text-xs text-slate-500 mt-1">
            Editable antes de cada envío. El documento se enviará a estos correos, con copia a los firmantes.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de la carta (AAAA-MM-DD, opcional)</label>
            <input
              className="input"
              value={fechaCarta}
              onChange={(ev) => setFechaCarta(ev.target.value)}
              placeholder="(vacío = fecha del envío)"
            />
          </div>
        </div>
        <div>
          <label className="label">Frase de opciones (cuerpo de la carta)</label>
          <textarea
            className="input min-h-[60px] text-sm"
            value={frase}
            onChange={(ev) => setFrase(ev.target.value)}
          />
        </div>
        <button className="btn-primary" disabled={trabajando} onClick={guardarConfig}>
          Guardar configuración
        </button>
      </div>

      {/* Tablero de participantes */}
      <div className="card overflow-x-auto">
        <h2 className="font-bold text-slate-800 mb-3">
          Participantes ({datos.firmados}/{datos.total} firmados)
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Nombre</th>
              <th className="py-2 pr-2">Cédula</th>
              <th className="py-2 pr-2">Entró</th>
              <th className="py-2 pr-2">Sede elegida</th>
              <th className="py-2 pr-2">Correo</th>
              <th className="py-2 pr-2">Folio</th>
              <th className="py-2 pr-2">Firmó</th>
            </tr>
          </thead>
          <tbody>
            {datos.participantes.map((p) => (
              <tr key={p.cedula} className="border-b last:border-0">
                <td className="py-2 pr-2 text-slate-400">{p.puesto_lista}</td>
                <td className="py-2 pr-2">{p.nombre_completo}</td>
                <td className="py-2 pr-2">{p.cedula}</td>
                <td className="py-2 pr-2">{p.ingreso_en ? "Sí" : "—"}</td>
                <td className="py-2 pr-2">{p.sede_elegida ?? "—"}</td>
                <td className="py-2 pr-2 text-xs">{p.correo_digitado ?? "—"}</td>
                <td className="py-2 pr-2 font-mono">{p.folio_mostrado ?? "—"}</td>
                <td className="py-2 pr-2">
                  {p.firmado ? (
                    <span className="inline-block rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-semibold">
                      Firmó
                    </span>
                  ) : (
                    <span className="inline-block rounded bg-slate-100 text-slate-500 px-2 py-0.5 text-xs">
                      Pendiente
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sección de PRUEBA */}
      {datos.es_prueba && (
        <div className="card border-amber-300 bg-amber-50 space-y-4">
          <h2 className="font-bold text-amber-800">Datos de prueba (sólo MODO PRUEBA)</h2>
          <p className="text-sm text-amber-800">
            Cargue participantes ficticios para ensayar el flujo completo. Estos datos están en una tabla
            separada y nunca se mezclan con los 22 reales.
          </p>
          <form onSubmit={guardarPrueba} className="grid sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Cédula" value={pf.cedula}
              onChange={(ev) => setPf({ ...pf, cedula: ev.target.value })} required />
            <input className="input" placeholder="Nombre completo" value={pf.nombre_completo}
              onChange={(ev) => setPf({ ...pf, nombre_completo: ev.target.value })} required />
            <input className="input" placeholder="Sede opción A" value={pf.sede_opcion_a}
              onChange={(ev) => setPf({ ...pf, sede_opcion_a: ev.target.value })} required />
            <input className="input" placeholder="Sede opción B (opcional)" value={pf.sede_opcion_b}
              onChange={(ev) => setPf({ ...pf, sede_opcion_b: ev.target.value })} />
            <input className="input sm:col-span-2" placeholder="Correo de destino para la prueba (ej: tu correo)"
              value={pf.correo_destino_prueba}
              onChange={(ev) => setPf({ ...pf, correo_destino_prueba: ev.target.value })} />
            <button className="btn-primary sm:col-span-2" disabled={trabajando}>
              Guardar participante de prueba
            </button>
          </form>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-amber-200">
            <button
              className="btn-outline"
              disabled={trabajando}
              onClick={() =>
                accionSimple("/api/maestro/prueba", { accion: "reiniciar" },
                  "¿Borrar TODOS los datos de prueba y reiniciar folios de prueba? (no afecta los datos reales)")
              }
            >
              Reiniciar datos de prueba
            </button>
          </div>

          {datos.participantes.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Eliminar individual:</p>
              <div className="flex flex-wrap gap-2">
                {datos.participantes.map((p) => (
                  <button
                    key={p.cedula}
                    className="rounded border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100"
                    disabled={trabajando}
                    onClick={() =>
                      accionSimple("/api/maestro/prueba", { accion: "eliminar", cedula: p.cedula },
                        `¿Eliminar al participante de prueba ${p.nombre_completo}?`)
                    }
                  >
                    ✕ {p.nombre_completo} ({p.cedula})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{etiqueta}</div>
      <div className={`text-lg font-bold ${alerta ? "text-amber-600" : "text-slate-800"}`}>{valor}</div>
    </div>
  );
}
