import { getPorTrazaCualquiera } from "@/lib/repo";
import { folioMostrado } from "@/lib/mode";
import { fechaHora } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Fila({ k, v, resaltar = false }: { k: string; v: string; resaltar?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3 py-2 border-b border-slate-100">
      <div className="sm:w-1/2 text-slate-500 text-sm">{k}</div>
      <div className={`sm:w-1/2 ${resaltar ? "font-semibold text-corte" : "text-slate-800"}`}>{v}</div>
    </div>
  );
}

export default async function TrazabilidadPage({ params }: { params: { id: string } }) {
  const encontrado = await getPorTrazaCualquiera(params.id);

  if (!encontrado) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="card text-center">
          <h1 className="text-xl font-bold text-slate-800">Registro no encontrado</h1>
          <p className="mt-2 text-slate-600">
            El código consultado no corresponde a ninguna firma registrada.
          </p>
        </div>
      </main>
    );
  }

  const { participante: p, modo } = encontrado;
  const esPrueba = modo === "prueba";

  return (
    <main className="mx-auto max-w-2xl">
      {esPrueba && (
        <div className="mb-4 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 text-sm font-semibold text-center">
          Registro de PRUEBA — no corresponde a una firma real del proceso.
        </div>
      )}

      <div className="card">
        <h1 className="text-center text-2xl font-extrabold tracking-wide text-corte">
          TRAZABILIDAD FIRMA ELECTRÓNICA
        </h1>
        <p className="text-center text-xs text-slate-500 mt-1 mb-5">
          Manifestación de sede de preferencia · Sala Civil-Familia · Corte Suprema de Justicia
        </p>

        {!p.firmado && (
          <div className="mb-4 alert-error">
            Esta persona aún no ha completado su firma electrónica.
          </div>
        )}

        <section className="mb-2">
          <Fila k="Nombre del firmante" v={p.nombre_completo} resaltar />
          <Fila k="Cédula" v={p.cedula} />
          <Fila k="Sede elegida" v={p.sede_elegida ?? "—"} resaltar />
          <Fila k="Folio de la firma" v={p.firmado ? folioMostrado(p.folio, modo) : "—"} />
        </section>

        <h2 className="mt-6 mb-2 text-sm font-bold uppercase text-slate-500">Trazabilidad</h2>
        <section>
          <Fila k="Ingreso con su cédula" v={fechaHora(p.ingreso_en)} />
          <Fila k="Correo electrónico digitado" v={p.correo_digitado ?? "—"} />
          <Fila
            k="Código de verificación"
            v={
              p.otp_enviado_en
                ? `Se envió un código de un solo uso a ese correo (${fechaHora(p.otp_enviado_en)})`
                : "No se ha enviado código"
            }
          />
          <Fila
            k="Validación del código (firma)"
            v={p.otp_validado_en ? fechaHora(p.otp_validado_en) : "Pendiente"}
            resaltar={!!p.otp_validado_en}
          />
          <Fila
            k="Correo de confirmación al firmante"
            v={
              p.correo_confirmacion_enviado_en
                ? `Enviado (${fechaHora(p.correo_confirmacion_enviado_en)})`
                : "No enviado"
            }
          />
          {p.correo_final_enviado_en && (
            <Fila
              k="Documento final radicado/enviado"
              v={fechaHora(p.correo_final_enviado_en)}
            />
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
