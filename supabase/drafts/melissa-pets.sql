-- BORRADOR REVISADO — Melissa Pets
-- NO EJECUTAR EN PRODUCCIÓN.
-- Migración incremental para habilitar mascotas e historial veterinario.
-- Requiere PostgreSQL 15+ (el proyecto usa PostgreSQL 17).
-- Antes de aplicar: ejecutar en una copia/staging y completar pruebas pgTAP de RLS.

begin;

-- Claves compuestas para que las relaciones operativas no crucen clínicas.
create unique index if not exists pacientes_id_clinica_uk
  on public.pacientes (id, clinica_id);
create unique index if not exists citas_id_clinica_uk
  on public.citas (id, clinica_id);

create table if not exists public.mascotas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  propietario_paciente_id uuid not null,
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  especie text not null check (especie in ('perro','gato','ave','conejo','reptil','otro')),
  raza text,
  sexo text check (sexo is null or sexo in ('macho','hembra')),
  fecha_nacimiento date,
  peso numeric(7,2) check (peso is null or peso between 0.01 and 500),
  microchip text,
  observaciones text,
  activo boolean not null default true,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.mascotas'::regclass and conname = 'mascotas_id_clinica_uk') then
    alter table public.mascotas add constraint mascotas_id_clinica_uk unique (id, clinica_id);
  end if;
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.mascotas'::regclass and conname = 'mascotas_propietario_misma_clinica') then
    alter table public.mascotas
      add constraint mascotas_propietario_misma_clinica
      foreign key (propietario_paciente_id, clinica_id)
      references public.pacientes(id, clinica_id) on delete restrict;
  end if;
end $$;

create unique index if not exists mascotas_microchip_por_clinica
  on public.mascotas (clinica_id, lower(trim(microchip)))
  where microchip is not null and trim(microchip) <> '';
create index if not exists mascotas_propietario_idx
  on public.mascotas (clinica_id, propietario_paciente_id, activo);
create index if not exists mascotas_nombre_idx
  on public.mascotas (clinica_id, lower(nombre));

-- La mascota es opcional para no invalidar citas antiguas de Melissa Beauty.
alter table public.citas add column if not exists mascota_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.citas'::regclass and conname = 'citas_mascota_misma_clinica') then
    alter table public.citas
      add constraint citas_mascota_misma_clinica
      foreign key (mascota_id, clinica_id)
      references public.mascotas(id, clinica_id)
      on delete set null (mascota_id);
  end if;
end $$;

create index if not exists citas_mascota_idx
  on public.citas (clinica_id, mascota_id) where mascota_id is not null;

create or replace function public.validar_mascota_de_cita()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_propietario uuid;
begin
  if new.mascota_id is null then return new; end if;

  select m.propietario_paciente_id into v_propietario
  from public.mascotas m
  where m.id = new.mascota_id
    and m.clinica_id = new.clinica_id
    and m.activo = true;

  if not found then
    raise exception 'La mascota no existe o no está activa en esta clínica'
      using errcode = '23503';
  end if;
  if v_propietario is distinct from new.paciente_id then
    raise exception 'La mascota seleccionada no pertenece al propietario de la cita'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists citas_validar_mascota on public.citas;
create trigger citas_validar_mascota
before insert or update of mascota_id, paciente_id, clinica_id
on public.citas for each row
execute function public.validar_mascota_de_cita();

create table if not exists public.historial_veterinario (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  mascota_id uuid not null,
  cita_id uuid,
  tipo text not null check (tipo in ('consulta','vacuna','desparasitacion','tratamiento','cirugia','otro')),
  fecha date not null default current_date,
  motivo text not null check (length(trim(motivo)) between 1 and 300),
  notas text,
  peso numeric(7,2) check (peso is null or peso between 0.01 and 500),
  proxima_fecha date,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_at timestamptz not null default now(),
  constraint historial_vet_fechas_coherentes
    check (proxima_fecha is null or proxima_fecha >= fecha)
);

do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.historial_veterinario'::regclass
      and conname = 'historial_vet_mascota_misma_clinica') then
    alter table public.historial_veterinario
      add constraint historial_vet_mascota_misma_clinica
      foreign key (mascota_id, clinica_id)
      references public.mascotas(id, clinica_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.historial_veterinario'::regclass
      and conname = 'historial_vet_cita_misma_clinica') then
    alter table public.historial_veterinario
      add constraint historial_vet_cita_misma_clinica
      foreign key (cita_id, clinica_id)
      references public.citas(id, clinica_id)
      on delete set null (cita_id);
  end if;
end $$;

create index if not exists historial_veterinario_mascota_fecha_idx
  on public.historial_veterinario (clinica_id, mascota_id, fecha desc);
create index if not exists historial_veterinario_proxima_fecha_idx
  on public.historial_veterinario (clinica_id, proxima_fecha)
  where proxima_fecha is not null;

-- Impide vincular una entrada clínica con una cita de otra mascota.
create or replace function public.validar_cita_de_historial_veterinario()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_mascota_id uuid;
begin
  if new.cita_id is null then return new; end if;

  select c.mascota_id into v_mascota_id
  from public.citas c
  where c.id = new.cita_id and c.clinica_id = new.clinica_id;

  if not found then
    raise exception 'La cita no existe en esta clínica' using errcode = '23503';
  end if;
  if v_mascota_id is distinct from new.mascota_id then
    raise exception 'La cita asociada no corresponde a esta mascota'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists historial_vet_validar_cita on public.historial_veterinario;
create trigger historial_vet_validar_cita
before insert or update of cita_id, mascota_id, clinica_id
on public.historial_veterinario for each row
execute function public.validar_cita_de_historial_veterinario();

alter table public.historial_veterinario
  alter column creado_por set default auth.uid();

-- RLS: sin acceso anónimo; los privilegios de authenticated quedan
-- limitados por las políticas de clínica, propietario o supervisión.
alter table public.mascotas enable row level security;
alter table public.historial_veterinario enable row level security;

revoke all on table public.mascotas from anon, authenticated;
revoke all on table public.historial_veterinario from anon, authenticated;
grant select, insert, update, delete on table public.mascotas to authenticated;
grant select, insert, update, delete on table public.historial_veterinario to authenticated;

drop policy if exists mascotas_admin_gestiona on public.mascotas;
create policy mascotas_admin_gestiona on public.mascotas
  for all to authenticated
  using (clinica_id = (select public.clinica_actual())
    and coalesce((select public.es_admin_clinica()), false))
  with check (clinica_id = (select public.clinica_actual())
    and coalesce((select public.es_admin_clinica()), false));

drop policy if exists mascotas_tutor_ve_suyas on public.mascotas;
create policy mascotas_tutor_ve_suyas on public.mascotas
  for select to authenticated
  using (clinica_id = (select public.clinica_actual())
    and propietario_paciente_id = (select public.paciente_actual())
    and activo = true);

-- El superadministrador global puede auditar, pero no escribir desde estas políticas.
drop policy if exists mascotas_superadmin_lectura on public.mascotas;
create policy mascotas_superadmin_lectura on public.mascotas
  for select to authenticated
  using (coalesce((select public.es_super_admin_global()), false));

drop policy if exists historial_vet_admin_gestiona on public.historial_veterinario;
create policy historial_vet_admin_gestiona on public.historial_veterinario
  for all to authenticated
  using (clinica_id = (select public.clinica_actual())
    and coalesce((select public.es_admin_clinica()), false))
  with check (clinica_id = (select public.clinica_actual())
    and coalesce((select public.es_admin_clinica()), false));

drop policy if exists historial_vet_tutor_lee_suyo on public.historial_veterinario;
create policy historial_vet_tutor_lee_suyo on public.historial_veterinario
  for select to authenticated
  using (
    clinica_id = (select public.clinica_actual())
    and exists (
      select 1 from public.mascotas m
      where m.id = historial_veterinario.mascota_id
        and m.clinica_id = historial_veterinario.clinica_id
        and m.propietario_paciente_id = (select public.paciente_actual())
        and m.activo = true
    )
  );

drop policy if exists historial_vet_superadmin_lectura on public.historial_veterinario;
create policy historial_vet_superadmin_lectura on public.historial_veterinario
  for select to authenticated
  using (coalesce((select public.es_super_admin_global()), false));

-- Los temas existentes no se sobrescriben si ya fueron personalizados.
insert into public.temas_base
  (id, nombre, color_primario_default, color_secundario_default,
   color_acento_default, descripcion)
values
  ('pets_verde', 'Pets · Verde natural', '#287C68', '#FFFFFF', '#E5F2ED',
   'Identidad natural y cercana para clínicas veterinarias'),
  ('pets_azul', 'Pets · Azul confianza', '#245A86', '#FFFFFF', '#E8F0F7',
   'Identidad clínica y profesional para veterinarias')
on conflict (id) do nothing;

commit;

-- Sigue siendo un borrador: no se ha ejecutado en Supabase.
-- Antes de producción deben añadirse/ejecutarse pruebas pgTAP para:
-- aislamiento entre clínicas, tutor propio, superadmin solo lectura,
-- cita-mascota y cita-historial, además de validar el flujo frontend.
