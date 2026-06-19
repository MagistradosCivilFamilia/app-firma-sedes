import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import { actualizarEstado } from "@/lib/repo";
import { esCorreoValido } from "@/lib/util";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edita destinatarios, fecha de la carta y la frase de opciones.
export async function POST(req: NextRequest) {
  const no = exigirMaestro();
  if (no) return no;

  const body = await req.json().catch(() => ({}));
  const modo = getModo();
  const patch: Record<string, unknown> = {};

  if (Array.isArray(body.destinatarios)) {
    const limpios = (body.destinatarios as unknown[])
      .map((x) => String(x).trim())
      .filter((x) => x.length > 0);
    const invalidos = limpios.filter((c) => !esCorreoValido(c));
    if (invalidos.length > 0) {
      return NextResponse.json(
        { error: `Correo(s) inválido(s): ${invalidos.join(", ")}` },
        { status: 400 }
      );
    }
    patch.destinatarios = limpios;
  }

  if (typeof body.fecha_carta === "string" && body.fecha_carta.trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_carta)) {
      return NextResponse.json({ error: "Fecha inválida (use AAAA-MM-DD)." }, { status: 400 });
    }
    patch.fecha_carta = body.fecha_carta;
  } else if (body.fecha_carta === null) {
    patch.fecha_carta = null;
  }

  if (typeof body.frase_opciones === "string" && body.frase_opciones.trim() !== "") {
    patch.frase_opciones = body.frase_opciones.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No hay cambios para guardar." }, { status: 400 });
  }

  const estado = await actualizarEstado(modo, patch);
  await audit({ modo, accion: "config_actualizada", detalle: patch });
  return NextResponse.json({ ok: true, estado });
}
