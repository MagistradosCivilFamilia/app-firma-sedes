import { NextRequest, NextResponse } from "next/server";
import { getModo } from "@/lib/env";
import { getPorCedula, guardarEleccion, getEstado } from "@/lib/repo";
import { aDTO } from "@/lib/dto";
import { normalizarCedula, getIp } from "@/lib/util";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ced = normalizarCedula(String(body.cedula ?? ""));
    const sede = String(body.sede ?? "").trim();

    const modo = getModo();
    const estado = await getEstado(modo);
    if (estado.carta_cerrada) {
      return NextResponse.json(
        { error: "La carta ya fue cerrada por el responsable del proceso. No es posible cambiar la elección." },
        { status: 409 }
      );
    }

    const p = await getPorCedula(modo, ced);
    if (!p) {
      return NextResponse.json({ error: "Cédula no encontrada." }, { status: 404 });
    }
    if (p.firmado) {
      return NextResponse.json(
        { error: "Usted ya firmó. No es posible cambiar la sede." },
        { status: 409 }
      );
    }

    // La sede debe ser exactamente una de sus opciones (validación de servidor).
    const opciones = [p.sede_opcion_a, p.sede_opcion_b].filter(Boolean) as string[];
    if (!opciones.includes(sede)) {
      return NextResponse.json({ error: "La sede seleccionada no es una de sus opciones." }, { status: 400 });
    }

    await guardarEleccion(modo, ced, sede);
    await audit({ modo, accion: "eleccion", cedula: ced, traza_id: p.traza_id, detalle: { sede }, ip: getIp(req) });

    const actualizado = await getPorCedula(modo, ced);
    return NextResponse.json({ participante: aDTO(actualizado!, modo) });
  } catch (e) {
    console.error("[/api/elegir]", e);
    return NextResponse.json({ error: "Ocurrió un error. Intente de nuevo." }, { status: 500 });
  }
}
