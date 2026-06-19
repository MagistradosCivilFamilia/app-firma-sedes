import type { Modo } from "@/lib/env";

// Banner siempre visible que indica en qué entorno se está operando.
export default function ModoBanner({ modo }: { modo: Modo }) {
  if (modo === "prueba") {
    return (
      <div className="w-full bg-amber-600 text-white text-center text-sm font-bold py-2 px-4">
        ⚠️ MODO PRUEBA — Ensayo. Ningún dato aquí corresponde al proceso real.
      </div>
    );
  }
  return (
    <div className="w-full bg-corte text-white text-center text-sm font-semibold py-2 px-4">
      Proceso oficial — Manifestación de sede de preferencia · Sala Civil-Familia
    </div>
  );
}
