import Link from "next/link";
import FlujoParticipante from "@/components/FlujoParticipante";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-corte">Manifestación de sede de preferencia</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lista de elegibles · Magistrado de Tribunal Superior de Distrito Judicial – Sala Civil-Familia
        </p>
      </header>
      <FlujoParticipante />
      <div className="mt-4 text-center">
        <Link href="/carta" className="text-sm text-corte underline">
          Ver la carta y el estado de las firmas en vivo
        </Link>
      </div>
      <footer className="mt-8 text-center text-xs text-slate-400">
        Firma electrónica conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012.
      </footer>
    </main>
  );
}
