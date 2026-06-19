// Formateo de fechas en zona horaria de Colombia (America/Bogota).

const TZ = "America/Bogota";

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d) + " (hora de Colombia)";
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

// "19 de junio de 2026" a partir de un Date o una fecha 'YYYY-MM-DD'.
export function fechaLarga(fecha: Date | string): string {
  let d: Date;
  if (typeof fecha === "string") {
    // 'YYYY-MM-DD' -> interpretamos como fecha local sin desfase de zona.
    const [y, m, day] = fecha.split("-").map(Number);
    d = new Date(y, (m ?? 1) - 1, day ?? 1);
  } else {
    d = fecha;
  }
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// Fecha de hoy en Bogotá como 'YYYY-MM-DD'.
export function hoyBogota(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  return partes; // en-CA da formato YYYY-MM-DD
}
