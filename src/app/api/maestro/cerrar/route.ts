import { NextRequest, NextResponse } from "next/server";
import { exigirMaestro } from "@/lib/guard";
import { getModo } from "@/lib/env";
import { getEstado, actualizarEstado } from "@/lib/repo";
import { audit } from "@/lib/audit";
import { getIp } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const no = exigirMaestro();
  if (no) return no;

  const { abrir } = await req.json().catch(() => ({ abrir: false }));
  const modo = getModo();
  const estado = await getEstado(modo);

  if (abrir) {
    // Reabrir sólo permitido si aún no se envió el documento final.
    if (estado.enviada_en) {
      return NextResponse.json(
        { error: "No se puede reabrir: el documento final ya fue enviado." },
        { status: 409 }
      );
    }
    const nuevo = await actualizarEstado(modo, { carta_cerrada: false, cerrada_en: null });
    await audit({ modo, accion: "carta_reabierta", ip: getIp(req) });
    return NextResponse.json({ ok: true, estado: nuevo });
  }

  const nuevo = await actualizarEstado(modo, {
    carta_cerrada: true,
    cerrada_en: new Date().toISOString()
  });
  await audit({ modo, accion: "carta_cerrada", ip: getIp(req) });
  return NextResponse.json({ ok: true, estado: nuevo });
}
