import { getPorTrazaCualquiera } from "@/lib/repo";
import { folioMostrado } from "@/lib/mode";
import { fechaHora } from "@/lib/format";
import { getFirmantePorTraza, getProceso } from "@/lib/procesos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Vista {
  esPrueba: boolean;
  subtitulo: string;
  nombre: string;
  cedula: string;
  opcionLabel: string | null;
  opcionValor: string | null;
  folioTexto: string;
  firmado: boolean;
  ingreso_en: string | null;
  correo_digitado: string | null;
  otp_enviado_en: string | null;
  otp_validado_en: string | null;
  correo_confirmacion_enviado_en: string | null;
  correo_final_enviado_en: string | null;
}

function Fila({ k, v, resaltar = false }: { k: string; v: string; resaltar?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3 py-2 border-b border-slate-100">
      <div className="sm:w-1/2 text-slate-500 text-sm">{k}</div>
      <div className={`sm:w-1/2 ${resaltar ? "font-semibold text-corte" : "text-slate-800"}`}>{v}</div>
    </div>
  );
}

async function resolver(id: string): Promise<Vista | null> {
  // 1) Proceso original (participantes / participantes_prueba)
  const enc = await getPorTrazaCualquiera(id);
  if (enc) {
    const { participante: p, modo } = enc;
    return {
      esPrueba: modo === "prueba",
      subtitulo: "Manifestación de sede de preferencia · Sala Civil-Familia · Corte Suprema de Justicia",
      nombre: p.nombre_completo,
      cedula: p.cedula,
      opcionLabel: "Sede elegida",
      opcionValor: p.sede_elegida,
      folioTexto: p.firmado ? folioMostrado(p.folio, modo) : "—",
      firmado: p.firmado,
      ingreso_en: p.ingreso_en,
      correo_digitado: p.correo_digitado,
      otp_enviado_en: p.otp_enviado_en,
      otp_validado_en: p.otp_validado_en,
      correo_confirmacion_enviado_en: p.correo_confirmacion_enviado_en,
      correo_final_enviado_en: p.correo_final_enviado_en
    };
  }
  // 2) Procesos nuevos (firmantes)
  const f = await getFirmantePorTraza(id);
  if (f) {
    const proc = await getProceso(f.proceso_id);
    return {
      esPrueba: false,
      subtitulo: proc?.nombre ?? "Documento",
      nombre: f.nombre_completo,
      cedula: f.cedula,
      opcionLabel: proc?.tiene_opciones ? proc.etiqueta_opcion : null,
      opcionValor: f.elegida,
      folioTexto: f.firmado && f.folio != null ? String(f.folio).padStart(2, "0") : "—",
      firmado: f.firmado,
      ingreso_en: f.ingreso_en,
      correo_digitado: f.correo_digitado,
      otp_enviado_en: f.otp_enviado_en,
      otp_validado_en: f.otp_validado_en,
      correo_confirmacion_enviado_en: f.correo_confirmacion_enviado_en,
      correo_final_enviado_en: f.correo_final_enviado_en
    };
  }
  return null;
}

export default async function TrazabilidadPage({ params }: { params: { id: string } }) {
  const v = await resolver(params.id);

  if (!v) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card text-center">
          <h1 className="text-xl font-bold text-slate-800">Registro no encontrado</h1>
          <p className="mt-2 text-slate-600">El código consultado no corresponde a ninguna firma registrada.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl">
      {v.esPrueba && (
        <div className="mb-4 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 text-sm font-semibold text-center">
          Registro de PRUEBA — no corresponde a una firma real del proceso.
        </div>
      )}

      <div className="card">
        <h1 className="text-center text-2xl font-extrabold tracking-wide text-corte">
          TRAZABILIDAD FIRMA ELECTRÓNICA
        </h1>
        <p className="text-center text-xs text-slate-500 mt-1 mb-5">{v.subtitulo}</p>

        {!v.firmado && (
          <div className="mb-4 alert-error">Esta persona aún no ha completado su firma electrónica.</div>
        )}

        <section className="mb-2">
          <Fila k="Nombre del firmante" v={v.nombre} resaltar />
          <Fila k="Cédula" v={v.cedula} />
          {v.opcionLabel && <Fila k={v.opcionLabel} v={v.opcionValor ?? "—"} resaltar />}
          <Fila k="Folio de la firma" v={v.folioTexto} />
        </section>

        <h2 className="mt-6 mb-2 text-sm font-bold uppercase text-slate-500">Trazabilidad</h2>
        <section>
          <Fila k="Ingreso con su cédula" v={fechaHora(v.ingreso_en)} />
          <Fila k="Correo electrónico digitado" v={v.correo_digitado ?? "—"} />
          <Fila
            k="Código de verificación"
            v={v.otp_enviado_en ? `Se envió un código de un solo uso a ese correo (${fechaHora(v.otp_enviado_en)})` : "No se ha enviado código"}
          />
          <Fila
            k="Validación del código (firma)"
            v={v.otp_validado_en ? fechaHora(v.otp_validado_en) : "Pendiente"}
            resaltar={!!v.otp_validado_en}
          />
          <Fila
            k="Correo de confirmación al firmante"
            v={v.correo_confirmacion_enviado_en ? `Enviado (${fechaHora(v.correo_confirmacion_enviado_en)})` : "No enviado"}
          />
          {v.correo_final_enviado_en && (
            <Fila k="Documento final radicado/enviado" v={fechaHora(v.correo_final_enviado_en)} />
          )}
        </section>

        <p className="mt-6 text-xs text-slate-500 leading-relaxed">
          Firma electrónica conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012, validada con código
          de un solo uso enviado al correo electrónico del firmante. Esta página de trazabilidad es de
          acceso público mediante código QR.
        </p>
      </div>
    </main>
  );
}
