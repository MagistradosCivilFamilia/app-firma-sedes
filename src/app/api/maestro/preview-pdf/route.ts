import { NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import { getEstado, listarFirmantes } from "@/lib/repo";
import { construirCartaPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Devuelve el PDF de la carta (igual al que se adjunta al radicar) para vista previa.
export async function GET() {
  const no = exigirMaestro();
  if (no) return no;

  const modo = getModo();
  const [estado, firmantes] = await Promise.all([getEstado(modo), listarFirmantes(modo)]);
  const pdf = await construirCartaPdf({ modo, estado, firmantes });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=carta-sedes.pdf"
    }
  });
}
