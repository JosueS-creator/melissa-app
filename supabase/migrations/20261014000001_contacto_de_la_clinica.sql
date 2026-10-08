-- Datos de contacto de cada negocio (teléfono y WhatsApp), administrados SOLO por Super Administración.
--
-- Por qué una tabla aparte y no columnas en `clinicas`: la política `lectura_publica_clinicas_activas` permite leer
-- todas las columnas de todas las clínicas activas a cualquier visitante y a cualquier cliente. Columnas nuevas ahí
-- quedarían expuestas entre negocios. Esta tabla no tiene política de lectura para clientes ni administradores:
-- el cliente obtiene SOLO el contacto de su clínica mediante contacto_de_mi_clinica().
-- Aditiva: no modifica ningún objeto existente.
create table if not exists public.clinica_contacto (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  telefono_contacto text,
  whatsapp_contacto text,
  actualizado_at timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references public.perfiles(id) on delete set null,
  constraint contacto_telefono_valido check (
    telefono_contacto is null
    or (telefono_contacto ~ '^\+?[0-9().\s-]+$' and length(regexp_replace(telefono_contacto, '\D', '', 'g')) between 7 and 15)),
  constraint contacto_whatsapp_valido check (
    whatsapp_contacto is null
    or (whatsapp_contacto ~ '^\+?[0-9().\s-]+$' and length(regexp_replace(whatsapp_contacto, '\D', '', 'g')) between 7 and 15))
);

alter table public.clinica_contacto enable row level security;
-- Única política: el Super Administrador lee y escribe. Nadie más accede a la tabla directamente.
create policy super_admin_gestiona_contacto on public.clinica_contacto
  for all to authenticated
  using (es_super_admin_global())
  with check (es_super_admin_global());
revoke all on public.clinica_contacto from public, anon;
grant select, insert, update, delete on public.clinica_contacto to authenticated;

-- Limpia los valores (espacios, vacío = sin dato) y exige que el WhatsApp sea utilizable en un enlace wa.me,
-- reutilizando la normalización de la Fase C (código de país escrito, o país del negocio: HN 8 dígitos · ES 9 dígitos).
create or replace function public.validar_contacto_clinica()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_pais text;
begin
  new.telefono_contacto := nullif(trim(new.telefono_contacto), '');
  new.whatsapp_contacto := nullif(trim(new.whatsapp_contacto), '');
  if new.whatsapp_contacto is not null then
    select c.pais into v_pais from clinicas c where c.id = new.clinica_id;
    if telefono_whatsapp(new.whatsapp_contacto, v_pais) is null then
      raise exception 'El WhatsApp debe incluir el código de país (por ejemplo +504 9999-0000) o ser un número local válido del país del negocio.'
        using errcode = 'check_violation';
    end if;
  end if;
  new.actualizado_at := now();
  return new;
end $fn$;
revoke all on function public.validar_contacto_clinica() from public, anon, authenticated;
create trigger validar_contacto_clinica before insert or update on public.clinica_contacto
  for each row execute function public.validar_contacto_clinica();

-- Lo que ve el cliente (o el administrador, solo lectura): el contacto de SU clínica y nada más.
-- No recibe parámetros: no hay forma de pedir otra clínica. Devuelve además el número listo para tel: y para wa.me.
create or replace function public.contacto_de_mi_clinica()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_clinica uuid := clinica_actual();
  v_pais text;
  r public.clinica_contacto%rowtype;
begin
  if v_clinica is null then return null; end if;
  select c.pais into v_pais from clinicas c where c.id = v_clinica;
  select * into r from clinica_contacto where clinica_id = v_clinica;
  return jsonb_build_object(
    'telefono', r.telefono_contacto,
    'telefono_marcar', case when r.telefono_contacto is null then null else regexp_replace(r.telefono_contacto, '[^0-9+]', '', 'g') end,
    'whatsapp', r.whatsapp_contacto,
    'whatsapp_wa', case when r.whatsapp_contacto is null then null else telefono_whatsapp(r.whatsapp_contacto, v_pais) end);
end $fn$;
revoke all on function public.contacto_de_mi_clinica() from public, anon;
grant execute on function public.contacto_de_mi_clinica() to authenticated;
