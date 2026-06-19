import { NextRequest, NextResponse } from "next/server";
import { passwordCorrecta, crearCookieSesion } from "@/lib/auth";
import { getModo } from "@/lib/env";
import { audit } from "@/lib/audit";
import { getIp } from "@/lib/util";
import { limitar } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  // Anti fuerza bruta: 8 intentos por IP cada 10 minutos.
  const lim = limitar(`login:${ip}`, 8, 10 * 60_000);
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espere ${lim.esperaSeg} segundos.` },
      { status: 429 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!passwordCorrecta(String(password ?? ""))) {
    await audit({ modo: getModo(), accion: "login_fallido", ip });
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const c = crearCookieSesion();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, c.options);
  await audit({ modo: getModo(), accion: "login_ok", ip });
  return res;
}
