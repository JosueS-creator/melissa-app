-- ============================================================
-- MELISSA · FASE C · REACTIVACIÓN ASISTIDA POR WHATSAPP
-- Costo incremental: $0. La única integración es un enlace wa.me (lo abre el administrador).
-- Sin envío automático, sin API de mensajería, sin IA. Los límites son protecciones de MELISSA,
-- no límites oficiales de WhatsApp. Reutiliza crm_calcular (quién es oportunidad) y el ayudante de
-- segmentos de promociones. Medición solo desde esta implementación.
-- ============================================================

-- 1. CONSTANTES de las protecciones: una sola fuente (no las configura el negocio)
create or replace function public.reactivacion_limite_diario() returns integer language sql immutable as $fn$ select 30 $fn$;
create or replace function public.reactivacion_cooldown_dias() returns integer language sql immutable as $fn$ select 30 $fn$;
create or replace function public.reactivacion_ventana_regreso_dias() returns integer language sql immutable as $fn$ select 60 $fn$;
revoke all on function public.reactivacion_limite_diario() from public, anon, authenticated;
revoke all on function public.reactivacion_cooldown_dias() from public, anon, authenticated;
revoke all on function public.reactivacion_ventana_regreso_dias() from public, anon, authenticated;

-- 2. TELÉFONO → número para wa.me (solo dígitos, con código de país). Conservadora: no adivina.
--    Con "+" o "00" se respeta el código escrito; sin código solo se completa si el cliente tiene
--    país conocido (HN: 8 dígitos → 504 · ES: 9 dígitos → 34). En cualquier otro caso: null.
create or replace function public.telefono_whatsapp(p_telefono text, p_pais text)
returns text language sql immutable as $fn$
  with t as (
    select regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') as dig,
           left(trim(coalesce(p_telefono, '')), 1) = '+' as con_mas,
           upper(coalesce(p_pais, '')) as pais)
  select case
    when dig = '' then null
    when con_mas then case when length(dig) between 8 and 15 then dig end
    when left(dig, 2) = '00' then case when length(substr(dig, 3)) between 8 and 15 then substr(dig, 3) end
    when pais = 'HN' and length(dig) = 8 and dig ~ '^[23789]' then '504' || dig
    when pais = 'HN' and length(dig) = 11 and left(dig, 3) = '504' then dig
    when pais = 'ES' and length(dig) = 9 and dig ~ '^[6789]' then '34' || dig
    when pais = 'ES' and length(dig) = 11 and left(dig, 2) = '34' then dig
    else null end
  from t
$fn$;
revoke all on function public.telefono_whatsapp(text, text) from public, anon, authenticated;

-- 3. PROMOCIONES VIGENTES PARA UN CLIENTE: única definición (activa, vigente, le corresponde, sin usar).
--    promociones_aplicables la usa ahora (mismo comportamiento) y la reactivación también.
create or replace function public.promociones_vigentes_de(p_clinica uuid, p_paciente uuid)
returns table (id uuid, titulo text, descuento_porcentaje numeric, fin date, segmento text, servicio_nombre text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
begin
  return query
  select p.id, p.titulo, p.descuento_porcentaje, p.fin, p.segmento, s.nombre
  from promociones p
  join crm_calcular(p_clinica, p_paciente) f
    on promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
  left join servicios s on s.id = p.servicio_id
  where p.clinica_id = p_clinica and p.estado = 'activa' and current_date between p.inicio and p.fin
    and not exists (select 1 from promocion_clientes pc where pc.promocion_id = p.id and pc.paciente_id = p_paciente and pc.estado = 'utilizada');
end $fn$;
revoke all on function public.promociones_vigentes_de(uuid, uuid) from public, anon, authenticated;

create or replace function public.promociones_aplicables(p_paciente uuid)
returns table (id uuid, titulo text, descuento_porcentaje numeric, fin date)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_clinica uuid := clinica_actual();
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then return; end if;
  return query
  select v.id, v.titulo, v.descuento_porcentaje, v.fin from promociones_vigentes_de(v_clinica, p_paciente) v order by v.fin;
end $fn$;

-- 4. REGISTRO de acciones de reactivación (datos mínimos: sin el texto del mensaje)
create table if not exists crm_reactivaciones (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id),
  canal text not null default 'whatsapp' check (canal in ('whatsapp')),
  evento text not null default 'contacto_iniciado' check (evento in ('contacto_iniciado')),
  plantilla text not null check (plantilla in ('sin_promocion', 'con_promocion', 'frecuente_vip')),
  promocion_id uuid,
  prioridad text not null check (prioridad in ('alta', 'media', 'baja')),
  ultima_visita_previa timestamptz not null,
  dias_inactivo integer not null,
  visitas_previas integer not null,
  creado_por uuid default auth.uid() references perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (promocion_id, clinica_id) references promociones (id, clinica_id) on delete set null (promocion_id)
);
create index if not exists idx_reactivaciones_clinica on crm_reactivaciones (clinica_id, created_at desc);
create index if not exists idx_reactivaciones_paciente on crm_reactivaciones (paciente_id, created_at desc);
alter table crm_reactivaciones enable row level security;
create policy admin_ve_reactivaciones on crm_reactivaciones for select to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica());
create policy super_admin_lee_reactivaciones on crm_reactivaciones for select to authenticated
  using (es_super_admin_global());
-- Nadie escribe desde la API: solo registrar_contacto_reactivacion (que aplica el límite y el cooldown).
revoke insert, update, delete on crm_reactivaciones from anon, authenticated;

-- 5. BASE: clientes inactivos (ÚNICA definición: crm_calcular.es_inactivo = con visitas, sin próxima cita y
--    ≥ dias_inactividad días) y por qué quedarían fuera: en pausa (contactado hace poco) o no desea promociones.
create or replace function public.reactivacion_base(p_clinica uuid)
returns table (paciente_id uuid, nombre text, telefono text, telefono_wa text, ultima_visita timestamptz,
               dias_inactivo integer, visitas integer, ultimo_servicio text, nivel text, total_cobrado numeric, exclusion text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_cool integer := reactivacion_cooldown_dias();
begin
  return query
  select f.paciente_id, f.nombre, f.telefono, telefono_whatsapp(f.telefono, p.pais), f.ultima_visita, f.dias_inactivo,
         f.visitas_completadas, f.ultimo_servicio, f.nivel, f.total_cobrado,
         case
           when exists (select 1 from crm_reactivaciones r where r.paciente_id = f.paciente_id
                          and r.created_at > now() - make_interval(days => v_cool)) then 'en_pausa'
           when pf.promociones_ofertas is false then 'no_desea'
           else null end
  from crm_calcular(p_clinica) f
  join pacientes p on p.id = f.paciente_id
  left join perfiles pf on pf.id = p.perfil_id
  where f.es_inactivo;
end $fn$;
revoke all on function public.reactivacion_base(uuid) from public, anon, authenticated;

-- 6. OPORTUNIDADES con prioridad sencilla y explicable (puntos: visitas, consumo registrado, tiempo, promoción)
create or replace function public.reactivacion_oportunidades()
returns table (paciente_id uuid, nombre text, telefono text, telefono_wa text, ultima_visita timestamptz,
               dias_inactivo integer, visitas integer, ultimo_servicio text, nivel text,
               prioridad text, puntaje integer, motivos text[],
               promocion_id uuid, promocion_titulo text, promocion_descuento numeric,
               promocion_servicio text, promocion_segmento text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_clinica uuid := clinica_actual();
  v_umbral integer;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_umbral from clinicas c where c.id = v_clinica;

  return query
  with b as (select * from reactivacion_base(v_clinica) where exclusion is null),
  c as (
    select b.*, pr.id as pr_id, pr.titulo as pr_titulo, pr.descuento_porcentaje as pr_desc,
           pr.servicio_nombre as pr_serv, pr.segmento as pr_seg,
           (case when b.visitas >= 3 then 2 when b.visitas = 2 then 1 else 0 end)
           + (case when coalesce(b.total_cobrado, 0) > 0 then 1 else 0 end)
           + (case when b.dias_inactivo >= 2 * v_umbral then 1 else 0 end)
           + (case when pr.id is not null then 1 else 0 end) as pts
    from b
    left join lateral (select v.* from promociones_vigentes_de(v_clinica, b.paciente_id) v
                       order by v.descuento_porcentaje desc, v.fin limit 1) pr on true)
  select c.paciente_id, c.nombre, c.telefono, c.telefono_wa, c.ultima_visita, c.dias_inactivo, c.visitas,
         c.ultimo_servicio, c.nivel,
         case when c.pts >= 3 then 'alta' when c.pts = 2 then 'media' else 'baja' end,
         c.pts,
         array_remove(array[
           'No ha regresado y no tiene próxima cita',
           case when c.visitas >= 2 then c.visitas || ' visitas anteriores' else 'Solo 1 visita anterior' end,
           case when coalesce(c.total_cobrado, 0) > 0 then 'Tiene historial de consumo registrado' end,
           'Lleva ' || c.dias_inactivo || ' días sin volver',
           case when c.pr_id is not null then 'Tiene una promoción vigente que le corresponde' end
         ]::text[], null),
         c.pr_id, c.pr_titulo, c.pr_desc, c.pr_serv, c.pr_seg
  from c
  order by c.pts desc, c.visitas desc, c.dias_inactivo desc;
end $fn$;

-- 7. REGISTRAR "Abrir WhatsApp": valida TODO en el servidor y aplica el cooldown y el límite diario
--    con un bloqueo por clínica (varios administradores o clics simultáneos no pueden saltárselos).
create or replace function public.registrar_contacto_reactivacion(
  p_paciente uuid, p_promocion uuid default null, p_plantilla text default 'sin_promocion')
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_clinica uuid := clinica_actual();
  v_limite integer := reactivacion_limite_diario();
  v_cool integer := reactivacion_cooldown_dias();
  v_usadas integer;
  v_op record;
  v_ultimo timestamptz;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if p_plantilla not in ('sin_promocion', 'con_promocion', 'frecuente_vip') then
    return jsonb_build_object('resultado', 'plantilla_invalida');
  end if;
  perform pg_advisory_xact_lock(hashtext('reactivacion:' || v_clinica::text));

  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then
    return jsonb_build_object('resultado', 'cliente_invalido');
  end if;

  select max(r.created_at) into v_ultimo from crm_reactivaciones r
   where r.paciente_id = p_paciente and r.created_at > now() - make_interval(days => v_cool);
  if v_ultimo is not null then
    return jsonb_build_object('resultado', 'en_cooldown', 'disponible_desde', v_ultimo + make_interval(days => v_cool));
  end if;

  select count(*) into v_usadas from crm_reactivaciones r
   where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours';
  if v_usadas >= v_limite then
    return jsonb_build_object('resultado', 'limite_diario', 'limite', v_limite,
      'libre_desde', (select r.created_at + interval '24 hours' from crm_reactivaciones r
                       where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours'
                       order by r.created_at offset (v_usadas - v_limite) limit 1));
  end if;

  select * into v_op from reactivacion_oportunidades() o where o.paciente_id = p_paciente;
  if v_op.paciente_id is null or v_op.telefono_wa is null then
    return jsonb_build_object('resultado', 'no_oportunidad');
  end if;
  if p_promocion is not null and not exists (select 1 from promociones_vigentes_de(v_clinica, p_paciente) v where v.id = p_promocion) then
    return jsonb_build_object('resultado', 'promocion_no_aplicable');
  end if;

  insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, promocion_id, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas)
  values (v_clinica, p_paciente, p_plantilla, p_promocion, v_op.prioridad, v_op.ultima_visita, v_op.dias_inactivo, v_op.visitas);

  return jsonb_build_object('resultado', 'ok', 'telefono_wa', v_op.telefono_wa, 'restantes', v_limite - v_usadas - 1, 'limite', v_limite);
end $fn$;

-- 8. RESUMEN: tarjeta del CRM, protección y medición (solo lo que se sabe; sin atribuir ingresos)
create or replace function public.reactivacion_resumen()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_clinica uuid := clinica_actual();
  v_limite integer := reactivacion_limite_diario();
  v_cool integer := reactivacion_cooldown_dias();
  v_vent integer := reactivacion_ventana_regreso_dias();
  v_usadas integer;
  v_out jsonb;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select count(*) into v_usadas from crm_reactivaciones r where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours';

  select jsonb_build_object(
    'oportunidades', count(*) filter (where o.telefono_wa is not null),
    'alta', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'alta'),
    'media', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'media'),
    'baja', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'baja'),
    'sin_telefono', count(*) filter (where o.telefono_wa is null))
  into v_out from reactivacion_oportunidades() o;

  v_out := v_out || (select jsonb_build_object(
      'en_pausa', count(*) filter (where b.exclusion = 'en_pausa'),
      'no_desean', count(*) filter (where b.exclusion = 'no_desea'))
    from reactivacion_base(v_clinica) b);

  return v_out || jsonb_build_object(
    'contactos_24h', v_usadas, 'limite_diario', v_limite, 'restantes', greatest(v_limite - v_usadas, 0),
    'libre_desde', case when v_usadas >= v_limite then
      (select r.created_at + interval '24 hours' from crm_reactivaciones r
        where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours'
        order by r.created_at offset (v_usadas - v_limite) limit 1) end,
    'cooldown_dias', v_cool, 'ventana_dias', v_vent,
    'medicion_desde', (select min(r.created_at) from crm_reactivaciones r where r.clinica_id = v_clinica),
    'acciones_total', (select count(*) from crm_reactivaciones r where r.clinica_id = v_clinica),
    'acciones_con_promocion', (select count(*) from crm_reactivaciones r where r.clinica_id = v_clinica and r.promocion_id is not null),
    'citas_posteriores', (select count(distinct c.paciente_id) from citas c
        join crm_reactivaciones a on a.paciente_id = c.paciente_id and a.clinica_id = v_clinica
         and c.creada_at >= a.created_at and c.creada_at <= a.created_at + make_interval(days => v_vent)
       where c.clinica_id = v_clinica and c.estado <> 'cancelada'),
    'regresaron', (select count(distinct c.paciente_id) from citas c
        join crm_reactivaciones a on a.paciente_id = c.paciente_id and a.clinica_id = v_clinica
         and c.creada_at >= a.created_at and c.creada_at <= a.created_at + make_interval(days => v_vent)
       where c.clinica_id = v_clinica and c.estado = 'completada'),
    'promos_usadas', (select count(*) from crm_reactivaciones a
        join promocion_clientes pc on pc.promocion_id = a.promocion_id and pc.paciente_id = a.paciente_id and pc.estado = 'utilizada'
         and pc.utilizada_at >= a.created_at and pc.utilizada_at <= a.created_at + make_interval(days => v_vent)
       where a.clinica_id = v_clinica and a.promocion_id is not null));
end $fn$;

-- 9. LÍNEA DE TIEMPO del Cliente 360: muestra el contacto iniciado (misma fuente, sin copiar datos)
create or replace function public.crm_cliente_timeline(p_paciente_id uuid, p_limite integer default 100)
returns table (fecha timestamptz, tipo text, descripcion text, valor numeric, unidad text)
language plpgsql stable set search_path = public as $fn$
#variable_conflict use_column
declare v_clinica uuid;
begin
  select p.clinica_id into v_clinica from pacientes p where p.id = p_paciente_id;
  if v_clinica is null then raise exception 'Cliente no encontrado'; end if;
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;

  return query
  select e.fecha, e.tipo, e.descripcion, e.valor, e.unidad from (
    select c.fecha_hora as fecha, 'cita'::text as tipo,
      (case c.estado when 'pendiente' then 'Cita pendiente' when 'confirmada' then 'Cita confirmada'
                     when 'completada' then 'Cita completada' else 'Cita cancelada' end
       || ' · ' || coalesce(s.nombre, c.tratamiento, 'Sin servicio')) as descripcion,
      null::numeric as valor, null::text as unidad
    from citas c left join servicios s on s.id = c.servicio_id where c.paciente_id = p_paciente_id
    union all
    select g.fecha, 'pago', g.concepto || ' (' || g.metodo_pago || ')', g.monto, 'moneda'
    from pagos g where g.paciente_id = p_paciente_id and g.direccion = 'ingreso' and g.anulado_at is null
    union all
    select d.fecha, 'compra', 'Pedido en tienda · ' || d.estado, d.total, 'moneda'
    from pedidos d where d.paciente_id = p_paciente_id
    union all
    select m.fecha,
      case m.tipo when 'acumulacion' then 'puntos_ganados' when 'canje' then 'puntos_canjeados' else 'puntos_ajuste' end,
      coalesce(m.motivo, case m.tipo when 'acumulacion' then 'Puntos ganados' when 'canje' then 'Canje de puntos' else 'Ajuste de puntos' end),
      m.puntos::numeric, 'puntos'
    from puntos_movimientos m where m.paciente_id = p_paciente_id
    union all
    select r.fecha, 'referido', 'Invitó a ' || coalesce(r.telefono_referido, 'un contacto') || ' · ' || r.estado, null::numeric, null::text
    from referidos r where r.paciente_referidor_id = p_paciente_id
    union all
    select pm.fecha_inicio::timestamptz, 'membresia', 'Membresía ' || mb.nombre || ' · ' || pm.estado, null::numeric, null::text
    from paciente_membresias pm join membresias mb on mb.id = pm.membresia_id where pm.paciente_id = p_paciente_id
    union all
    select t.fecha, 'tratamiento', t.procedimiento, null::numeric, null::text
    from tratamientos_paciente t where t.paciente_id = p_paciente_id
    union all
    select r.created_at, 'reactivacion', 'Se inició un contacto por WhatsApp para invitarlo a volver (no se sabe si se envió el mensaje)', null::numeric, null::text
    from crm_reactivaciones r where r.paciente_id = p_paciente_id
  ) e
  order by e.fecha desc nulls last
  limit greatest(p_limite, 1);
end $fn$;

-- 10. PERMISOS
revoke all on function public.reactivacion_oportunidades() from public, anon;
revoke all on function public.registrar_contacto_reactivacion(uuid, uuid, text) from public, anon;
revoke all on function public.reactivacion_resumen() from public, anon;
grant execute on function public.reactivacion_oportunidades() to authenticated;
grant execute on function public.registrar_contacto_reactivacion(uuid, uuid, text) to authenticated;
grant execute on function public.reactivacion_resumen() to authenticated;
