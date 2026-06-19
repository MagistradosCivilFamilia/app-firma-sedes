import { NextRequest, NextResponse } from "next/server";
import { getModo } from "@/lib/env";
import { getPorCedula, marcarIngreso, getEstado } from "@/lib/repo";
import { aDTO } from "@/lib/dto";
import { normalizarCedula, getIp } from "@/lib/util";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { cedula } = await req.json();
    const ced = normalizarCedula(String(cedula ?? ""));
    if (!ced) {
      return NextResponse.json({ error: "Digite un número de cédula válido." }, { status: 400 });
    }

    const modo = getModo();
    const p = await getPorCedula(modo, ced);
    if (!p) {
      return NextResponse.json(
        { error: "Cédula no encontrada en la lista. Por favor contacte al administrador del proceso." },
        { status: 404 }
      );
    }

    await marcarIngreso(modo, ced);
    await audit({ modo, accion: "ingreso", cedula: ced, traza_id: p.traza_id, ip: getIp(req) });

    const estado = await getEstado(modo);
    return NextResponse.json({
      participante: aDTO(p, modo),
      carta_cerrada: estado.carta_cerrada,
      modo
    });
  } catch (e) {
    console.error("[/api/participante]", e);
    return NextResponse.json({ error: "Ocurrió un error. Intente de nuevo." }, { status: 500 });
  }
}
