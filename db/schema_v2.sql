-- ============================================================================
--  ESQUEMA v2 — MULTIPROCESO (additivo; NO toca participantes/proceso_estado)
--  Ejecutar UNA VEZ en el SQL Editor de Supabase.
--  Permite crear varios procesos de firma, cada uno con su propio documento,
--  sus firmantes, su numeración de folios y (opcional) opciones a escoger.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Un proceso = un documento que se firma colectivamente.
-- ----------------------------------------------------------------------------
create table if not exists procesos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,                       -- nombre del proceso (editable)
  doc_titulo      text,                                -- "Asunto:" / título del documento
  doc_encabezado  text,                                -- bloque destinatario / membrete (texto libre)
  doc_cuerpo      text,                                -- cuerpo del documento (párrafos separados por línea en blanco)
  tiene_opciones  boolean not null default false,      -- ¿los firmantes escogen una opción?
  etiqueta_opcion text not null default 'Opción de preferencia', -- encabezado de la columna de opción
  destinatarios   jsonb not null default '[]'::jsonb,  -- correos "Para" del documento final
  cerrada         boolean not null default false,
  cerrada_en      timestamptz,
  enviada_en      timestamptz,
  enviado_a       jsonb,                               -- registro de a quién se envió (para/cc) al radicar
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Firmantes de cada proceso. Folio independiente por proceso.
-- ----------------------------------------------------------------------------
create table if not exists firmantes (
  id                              uuid primary key default gen_random_uuid(),
  proceso_id                      uuid not null references procesos(id) on delete cascade,
  cedula                          text not null,
  nombre_completo                 text not null,
  opciones                        jsonb not null default '[]'::jsonb, -- opciones a escoger (si aplica)
  elegida                         text,                                -- opción escogida por el firmante
  firmado                         boolean not null default false,
  folio                           integer,
  correo_digitado                 text,
  codigo_otp_hash                 text,
  otp_enviado_en                  timestamptz,
  otp_expira_en                   timestamptz,
  otp_intentos                    integer not null default 0,
  otp_validado_en                 timestamptz,
  correo_confirmacion_enviado_en  timestamptz,
  correo_final_enviado_en         timestamptz,
  ingreso_en                      timestamptz,
  traza_id                        uuid not null default gen_random_uuid(),
  creado_en                       timestamptz not null default now(),
  actualizado_en                  timestamptz not null default now(),
  unique (proceso_id, cedula)
);
create unique index if not exists firmantes_traza_idx on firmantes (traza_id);
create index if not exists firmantes_proceso_idx on firmantes (proceso_id);

alter table procesos  enable row level security;
alter table firmantes enable row level security;

-- ----------------------------------------------------------------------------
-- Firma atómica por proceso: asigna folio = (máx del proceso) + 1, contiguo y
-- en orden de firma. Bloqueo por proceso para evitar colisiones.
-- ----------------------------------------------------------------------------
create or replace function firmar_proceso(p_proceso uuid, p_cedula text)
returns table(out_folio integer, out_validado timestamptz)
language plpgsql
as $$
declare
  v_cerrada boolean;
  v_firmado boolean;
  v_folio   integer;
  v_now     timestamptz := now();
begin
  select cerrada into v_cerrada from procesos where id = p_proceso;
  if not found then raise exception 'NO_PROCESO'; end if;
  if v_cerrada then raise exception 'CARTA_CERRADA'; end if;

  select firmado, folio into v_firmado, v_folio
    from firmantes where proceso_id = p_proceso and cedula = p_cedula for update;
  if not found then raise exception 'NO_EXISTE'; end if;

  if v_firmado then
    out_folio := v_folio;
    select otp_validado_en into out_validado
      from firmantes where proceso_id = p_proceso and cedula = p_cedula;
    return next; return;
  end if;

  -- Serializa la asignación de folio dentro del mismo proceso.
  perform pg_advisory_xact_lock(hashtext(p_proceso::text));
  select coalesce(max(folio), 0) + 1 into v_folio
    from firmantes where proceso_id = p_proceso and firmado = true;

  update firmantes
     set firmado = true, folio = v_folio, otp_validado_en = v_now,
         otp_intentos = 0, actualizado_en = v_now
   where proceso_id = p_proceso and cedula = p_cedula;

  out_folio := v_folio;
  out_validado := v_now;
  return next;
end;
$$;
