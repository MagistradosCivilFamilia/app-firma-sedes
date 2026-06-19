-- ============================================================================
--  ESQUEMA - app-firma-sedes
--  Ejecutar UNA VEZ en el editor SQL de Supabase (SQL Editor -> New query).
--  Crea dos conjuntos de datos FÍSICAMENTE SEPARADOS:
--    * participantes        -> proceso REAL (los 22)
--    * participantes_prueba -> ensayos de Omar (datos ficticios)
--  Los datos de prueba NUNCA se mezclan ni se migran a los reales.
-- ============================================================================

-- gen_random_uuid() es nativo en Postgres 13+ (Supabase). Por si acaso:
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Secuencias de folio: numeración independiente para real y prueba.
-- El folio se asigna SOLO al firmar con éxito -> queda contiguo (01,02,03...)
-- y en el orden exacto en que se fue firmando. Nunca se reutiliza.
-- ----------------------------------------------------------------------------
create sequence if not exists folio_real_seq   start 1;
create sequence if not exists folio_prueba_seq start 1;

-- ----------------------------------------------------------------------------
-- Definición común de columnas (se aplica idéntica a real y prueba).
-- ----------------------------------------------------------------------------
create table if not exists participantes (
  cedula                          text primary key,
  puesto_lista                    integer not null,          -- orden de elegibilidad (NO es el folio)
  nombre_completo                 text not null,
  sede_opcion_a                   text not null,             -- única opción para quienes no tienen B
  sede_opcion_b                   text,                      -- nullable: 5 de 22 sólo tienen una sede
  sede_elegida                    text,
  firmado                         boolean not null default false,
  folio                           integer,                   -- asignado atómicamente al firmar
  correo_digitado                 text,
  codigo_otp_hash                 text,                      -- sólo el hash, jamás el código en claro
  otp_enviado_en                  timestamptz,
  otp_expira_en                   timestamptz,
  otp_intentos                    integer not null default 0,
  otp_validado_en                 timestamptz,               -- = fecha/hora de la firma
  correo_confirmacion_enviado_en  timestamptz,
  correo_final_enviado_en         timestamptz,
  ingreso_en                      timestamptz,               -- 1ª vez que entró con su cédula
  traza_id                        uuid not null default gen_random_uuid(),  -- id público del QR
  creado_en                       timestamptz not null default now(),
  actualizado_en                  timestamptz not null default now()
);
create unique index if not exists participantes_traza_id_idx on participantes (traza_id);

create table if not exists participantes_prueba (
  cedula                          text primary key,
  puesto_lista                    integer not null,
  nombre_completo                 text not null,
  sede_opcion_a                   text not null,
  sede_opcion_b                   text,
  sede_elegida                    text,
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
  -- correo de destino del "documento final" SÓLO para prueba (Omar lo cambia libremente).
  correo_destino_prueba           text,
  creado_en                       timestamptz not null default now(),
  actualizado_en                  timestamptz not null default now()
);
create unique index if not exists participantes_prueba_traza_id_idx on participantes_prueba (traza_id);

-- ----------------------------------------------------------------------------
-- Estado del proceso (una fila por modo). Guarda si la carta está cerrada,
-- los destinatarios editables, la fecha de la carta y la frase de opciones.
-- ----------------------------------------------------------------------------
create table if not exists proceso_estado (
  modo            text primary key check (modo in ('real','prueba')),
  carta_cerrada   boolean not null default false,
  cerrada_en      timestamptz,
  enviada_en      timestamptz,
  fecha_carta     date,
  destinatarios   jsonb not null default '[]'::jsonb,   -- array de correos "Para:"
  frase_opciones  text not null default 'manifestar la sede de nuestra preferencia dentro de las opciones inicialmente marcadas',
  actualizado_en  timestamptz not null default now()
);

insert into proceso_estado (modo, destinatarios) values
  ('real',   '["secretariag@cortesuprema.gov.co","damariso@cortesuprema.gov.co"]'::jsonb)
on conflict (modo) do nothing;
insert into proceso_estado (modo, destinatarios) values
  ('prueba', '[]'::jsonb)
on conflict (modo) do nothing;

-- ----------------------------------------------------------------------------
-- Auditoría server-side: base de la trazabilidad. Una sola tabla, con modo.
-- ----------------------------------------------------------------------------
create table if not exists auditoria (
  id         bigint generated always as identity primary key,
  modo       text not null,
  cedula     text,
  traza_id   uuid,
  accion     text not null,        -- ingreso | eleccion | otp_enviado | otp_fallido | firma | correo_confirmacion | carta_cerrada | documento_enviado | ...
  detalle    jsonb,
  ip         text,
  creado_en  timestamptz not null default now()
);
create index if not exists auditoria_modo_cedula_idx on auditoria (modo, cedula);

-- ----------------------------------------------------------------------------
-- RLS: activamos sin políticas. Todo el acceso es server-side con la
-- service_role key (que bypassa RLS). El anon key NUNCA toca estas tablas.
-- ----------------------------------------------------------------------------
alter table participantes        enable row level security;
alter table participantes_prueba enable row level security;
alter table proceso_estado       enable row level security;
alter table auditoria            enable row level security;

-- ----------------------------------------------------------------------------
-- Función de firma atómica (REAL). Asigna folio por secuencia y marca firmado
-- en una sola transacción. Si ya estaba firmado, devuelve el folio existente
-- sin reasignar. Rechaza si la carta ya está cerrada.
-- ----------------------------------------------------------------------------
create or replace function firmar_real(p_cedula text)
returns table(out_folio integer, out_validado timestamptz)
language plpgsql
as $$
declare
  v_cerrada  boolean;
  v_firmado  boolean;
  v_folio    integer;
  v_now      timestamptz := now();
begin
  select carta_cerrada into v_cerrada from proceso_estado where modo = 'real';
  if v_cerrada then
    raise exception 'CARTA_CERRADA';
  end if;

  select firmado, folio into v_firmado, v_folio
    from participantes where cedula = p_cedula for update;
  if not found then
    raise exception 'NO_EXISTE';
  end if;

  if v_firmado then
    out_folio := v_folio;
    select otp_validado_en into out_validado from participantes where cedula = p_cedula;
    return next;
    return;
  end if;

  v_folio := nextval('folio_real_seq');
  update participantes
     set firmado         = true,
         folio           = v_folio,
         otp_validado_en = v_now,
         otp_intentos    = 0,
         actualizado_en  = v_now
   where cedula = p_cedula;

  out_folio    := v_folio;
  out_validado := v_now;
  return next;
end;
$$;

-- ----------------------------------------------------------------------------
-- Función de firma atómica (PRUEBA). Secuencia y tabla independientes.
-- ----------------------------------------------------------------------------
create or replace function firmar_prueba(p_cedula text)
returns table(out_folio integer, out_validado timestamptz)
language plpgsql
as $$
declare
  v_cerrada  boolean;
  v_firmado  boolean;
  v_folio    integer;
  v_now      timestamptz := now();
begin
  select carta_cerrada into v_cerrada from proceso_estado where modo = 'prueba';
  if v_cerrada then
    raise exception 'CARTA_CERRADA';
  end if;

  select firmado, folio into v_firmado, v_folio
    from participantes_prueba where cedula = p_cedula for update;
  if not found then
    raise exception 'NO_EXISTE';
  end if;

  if v_firmado then
    out_folio := v_folio;
    select otp_validado_en into out_validado from participantes_prueba where cedula = p_cedula;
    return next;
    return;
  end if;

  v_folio := nextval('folio_prueba_seq');
  update participantes_prueba
     set firmado         = true,
         folio           = v_folio,
         otp_validado_en = v_now,
         otp_intentos    = 0,
         actualizado_en  = v_now
   where cedula = p_cedula;

  out_folio    := v_folio;
  out_validado := v_now;
  return next;
end;
$$;

-- ----------------------------------------------------------------------------
-- Reinicia la secuencia de folio de PRUEBA (al limpiar los ensayos).
-- Nunca toca la secuencia real.
-- ----------------------------------------------------------------------------
create or replace function reiniciar_folio_prueba()
returns void
language plpgsql
as $$
begin
  perform setval('folio_prueba_seq', 1, false);
end;
$$;
