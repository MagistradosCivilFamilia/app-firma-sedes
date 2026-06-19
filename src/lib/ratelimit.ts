// Rate limiting básico en memoria (suficiente para una sola instancia en
// Railway y 22 participantes). Para escalar a varias instancias habría que
// mover esto a la base de datos o a Redis.

interface Ventana {
  conteo: number;
  reinicioEn: number;
}

const ventanas = new Map<string, Ventana>();

export function limitar(clave: string, maxPorVentana: number, ventanaMs: number): { ok: boolean; esperaSeg: number } {
  const ahora = Date.now();
  const v = ventanas.get(clave);
  if (!v || ahora > v.reinicioEn) {
    ventanas.set(clave, { conteo: 1, reinicioEn: ahora + ventanaMs });
    return { ok: true, esperaSeg: 0 };
  }
  if (v.conteo < maxPorVentana) {
    v.conteo += 1;
    return { ok: true, esperaSeg: 0 };
  }
  return { ok: false, esperaSeg: Math.ceil((v.reinicioEn - ahora) / 1000) };
}
