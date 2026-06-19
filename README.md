# App firma de opción de sede — Sala Civil-Familia

Aplicación web para que los integrantes de la lista de elegibles a Magistrado de Tribunal Superior de
Distrito Judicial – Sala Civil-Familia **elijan su sede de preferencia y firmen electrónicamente** una
carta colectiva dirigida a la Sala Plena de la Corte Suprema de Justicia. La firma se respalda con
verificación por correo (código de un solo uso) y trazabilidad pública vía QR, conforme a la **Ley 527
de 1999** y el **Decreto 2364 de 2012**.

- **Next.js 14 (App Router) + TypeScript**
- **Supabase (Postgres)** para datos
- **Nodemailer + Gmail** (contraseña de aplicación) para correos
- **qrcode** para los códigos QR de trazabilidad
- Pensada para desplegar en **Railway**

---

## 1. Pasos manuales (los hace Omar)

> Estos pasos crean cuentas y credenciales de seguridad: **no se delegan**. Cuando los tengas, pega los
> valores en las variables de entorno (paso 2).

1. **GitHub**: crear cuenta (si no tienes) y un repositorio nuevo (privado) para este proyecto.
2. **Railway**: crear cuenta (login con GitHub).
3. **Supabase**: crear cuenta y un **proyecto nuevo**. Anota de *Project Settings → API*:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key (secreta) → `SUPABASE_SERVICE_ROLE_KEY`
4. **Gmail**: en la cuenta desde la que se enviarán los correos, activar verificación en dos pasos y
   generar una **contraseña de aplicación** (16 caracteres) en
   <https://myaccount.google.com/apppasswords> → `GMAIL_APP_PASSWORD`.
5. Los **22 participantes** y la **carta** ya están incorporados en el código (seed y plantilla).

---

## 2. Variables de entorno

Copia `.env.example` a `.env.local` (desarrollo) y, en Railway, configúralas en *Variables*.
Las claves están explicadas dentro de `.env.example`. Las críticas:

| Variable | Qué es |
|---|---|
| `MODO` | `prueba` o `real`. **Empieza siempre en `prueba`.** |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Conexión a Supabase |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Envío de correos |
| `MAESTRO_PASSWORD` | Clave para entrar a `/maestro` |
| `SESSION_SECRET` | Texto aleatorio largo (firma la cookie de sesión) |
| `NEXT_PUBLIC_BASE_URL` | URL pública del sitio (para los QR) |

---

## 3. Crear las tablas en Supabase

En el panel de Supabase → **SQL Editor** → *New query*:

1. Pega y ejecuta el contenido de [`db/schema.sql`](db/schema.sql) (crea tablas reales y de prueba,
   funciones de firma y estado).
2. Pega y ejecuta [`db/seed_real.sql`](db/seed_real.sql) (carga los 22 participantes reales).

> El seed es idempotente: puedes volver a ejecutarlo sin duplicar datos.

---

## 4. Correr en local

```bash
npm install
npm run dev
```

- Participantes: <http://localhost:3000>
- Consola del maestro: <http://localhost:3000/maestro>
- Trazabilidad (tras una firma): `http://localhost:3000/t/<id>`

---

## 5. Despliegue en Railway

1. Sube el repositorio a GitHub.
2. En Railway: *New Project → Deploy from GitHub repo* y elige el repo.
3. Railway detecta Next.js. Configura **todas** las variables del paso 2 en *Variables*.
4. Ajusta `NEXT_PUBLIC_BASE_URL` a la URL pública que te asigna Railway (p. ej.
   `https://tuapp.up.railway.app`) y vuelve a desplegar.
5. Build command: `npm run build` · Start command: `npm start` (Railway los toma del `package.json`).

---

## 6. Cómo probar antes del proceso real (MODO PRUEBA)

Con `MODO=prueba`:

1. Entra a `/maestro`, sección **Datos de prueba**.
2. Crea uno o varios participantes ficticios (con **tu** correo como destino).
3. Ve a `/`, entra con la cédula ficticia, elige sede, firma con el código que te llega por correo.
4. Revisa la trazabilidad (QR), cierra la carta y prueba **Enviar documento final** (ajusta los
   destinatarios de prueba a tu propio correo en *Configuración del envío*).
5. Cuando todo funcione, usa **Reiniciar datos de prueba** para limpiar.

Los folios de prueba salen como `PRUEBA-01`, `PRUEBA-02`… y nunca se confunden con los reales.

---

## 7. Pasar a REAL

1. Confirma que la prueba fue exitosa.
2. Cambia `MODO=real` (en Railway → Variables) y vuelve a desplegar.
3. En `/maestro`, en *Configuración del envío*, verifica los destinatarios:
   - `secretariag@cortesuprema.gov.co` (verificado en el directorio oficial de la Corte)
   - `damariso@cortesuprema.gov.co` (aportado por Omar; **conviene confirmarlo con la Secretaría**
     antes del envío real)
4. A partir de aquí toda la operación usa exclusivamente los 22 participantes reales.

> El paso de prueba a real es **manual y consciente**. Los datos de prueba **nunca** se copian a los
> reales: son tablas físicamente separadas.

---

## Estructura

```
db/                  SQL: schema, funciones, seed real
src/lib/             supabase, modo, otp, email, auth, qr, repo, carta (letter), util
src/app/             páginas (/, /t/[id], /maestro, /maestro/login) y API (/api/*)
src/components/       UI: flujo del participante, consola del maestro, banner de modo
```

## Seguridad aplicada

- El código OTP **nunca** se guarda en texto plano (sólo su hash bcrypt).
- Rate limiting en envío de OTP y en login del maestro.
- Folio asignado de forma **atómica** por secuencia en el momento de firmar (función SQL).
- Validación en el **backend** de cédula, código, sede y estado de la carta.
- Auditoría server-side de cada acción (base de la trazabilidad).
- Acceso a datos sólo server-side con la `service_role` key; las tablas tienen RLS activado.
