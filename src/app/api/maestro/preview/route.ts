import { NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import { getEstado, listarFirmantes } from "@/lib/repo";
import { construirCartaHtml } from "@/lib/letter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Devuelve el HTML de la carta tal como quedaría (vista previa).
export async function GET() {
  const no = exigirMaestro();
  if (no) return no;

  const modo = getModo();
  const [estado, firmantes] = await Promise.all([getEstado(modo), listarFirmantes(modo)]);
  const html = await construirCartaHtml({ modo, estado, firmantes });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
