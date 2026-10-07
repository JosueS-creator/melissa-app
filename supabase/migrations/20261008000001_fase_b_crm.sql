-- ============================================================
-- MELISSA 1.0 · FASE B · Datos y funciones del CRM
-- Aditiva: columnas nuevas nullable/con default, funciones nuevas. No altera
-- las migraciones de la Fase A ni borra datos.
-- ============================================================

-- 1. EMAIL del cliente. La fuente es auth.users (el navegador nunca la lee):
--    se copia por servidor al registrarse. Clientes antiguos sin cuenta: null.
alter table pacientes add column if not exists email text;
update pacientes p set email = u.email
  from auth.users u where u.id = p.perfil_id and p.email is null;

-- 2. UMBRALES por negocio: fuente única de niveles e inactividad (en la base)
alter table clinicas add column if not exists umbral_oro integer not null default 800;
alter table clinicas add column if not exists umbral_platino integer not null default 3200;
alter table clinicas add column if not exists dias_inactividad integer not null default 45;
alter table clinicas add constraint clinicas_umbrales_validos
  check (umbral_oro > 0 and umbral_platino > umbral_oro and dias_inactividad > 0);

-- 3. CITAS: servicio (opcional; los registros viejos siguen solo con `tratamiento`)
--    y fecha de creación (la fija el servidor; permite medir "clientes recuperados")
alter table servicios add constraint servicios_id_clinica_unico unique (id, clinica_id);
alter table citas add column if not exists servicio_id uuid;
alter table citas add constraint citas_servicio_misma_clinica
  foreign key (servicio_id, clinica_id) references servicios (id, clinica_id)
  on delete set null (servicio_id);
create index if not exists idx_citas_servicio on citas(servicio_id);

alter table citas add column if not exists creada_at timestamptz;
alter table citas alter column creada_at set default now();
create or replace function public.fijar_creada_at_cita()
returns trigger language plpgsql set search_path = public as $fn$
begin
  new.creada_at := now();
  return new;
end $fn$;
drop trigger if exists citas_creada_at on citas;
create trigger citas_creada_at before insert on citas
  for each row execute function public.fijar_creada_at_cita();
revoke all on function public.fijar_creada_at_cita() from public, anon, authenticated;

-- 4. REGISTRO: guarda el email (tomado de auth) y la fecha de nacimiento opcional
create or replace function public.crear_perfil_y_paciente()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_clinica_id uuid;
  v_nombre text;
  v_telefono text;
  v_pais text;
  v_fecha_nac date;
  v_rol text := 'paciente';
  v_codigo_invitacion text;
  v_invitacion_id uuid;
begin
  v_nombre := coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1));
  v_telefono := new.raw_user_meta_data->>'telefono';
  v_pais := new.raw_user_meta_data->>'pais';
  v_codigo_invitacion := new.raw_user_meta_data->>'invitacion_codigo';

  -- una fecha inválida nunca debe impedir el registro
  begin
    v_fecha_nac := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
  exception when others then
    v_fecha_nac := null;
  end;
  if v_fecha_nac is not null and (v_fecha_nac < date '1900-01-01' or v_fecha_nac > current_date) then
    v_fecha_nac := null;
  end if;

  if v_codigo_invitacion is not null then
    select id, clinica_id into v_invitacion_id, v_clinica_id from invitaciones_admin
      where codigo = v_codigo_invitacion and usado = false for update;
    if v_invitacion_id is not null then v_rol := 'admin'; end if;
  end if;

  if v_clinica_id is null then
    v_clinica_id := (new.raw_user_meta_data->>'clinica_id')::uuid;
    if v_clinica_id is null then
      raise exception 'Registro sin negocio: usa el link o el QR de tu negocio';
    end if;
    if not exists (select 1 from clinicas where id = v_clinica_id and activa) then
      raise exception 'Este negocio no está disponible';
    end if;
  end if;

  insert into perfiles (id, clinica_id, nombre, telefono, pais, rol)
  values (new.id, v_clinica_id, v_nombre, v_telefono, v_pais, v_rol)
  on conflict (id) do nothing;

  if v_rol = 'admin' then
    update invitaciones_admin set usado = true, usado_por = new.id where id = v_invitacion_id;
  end if;

  if v_rol = 'paciente' then
    insert into pacientes (clinica_id, perfil_id, nombre, telefono, pais, email, fecha_nacimiento)
    values (v_clinica_id, new.id, v_nombre, v_telefono, v_pais, new.email, v_fecha_nac)
    on conflict do nothing;
  end if;

  return new;
end $fn$;

-- 5. NIVEL por puntos: única definición (silver / gold / platinum)
create or replace function public.nivel_por_puntos(p_clinica uuid, p_puntos bigint)
returns text language sql stable set search_path = public as $fn$
  select case when p_puntos >= c.umbral_platino then 'platinum'
              when p_puntos >= c.umbral_oro then 'gold'
              else 'silver' end
  from clinicas c where c.id = p_clinica
$fn$;

-- 6. AUTORIZACIÓN del CRM: admin de ese negocio o super admin
create or replace function public.crm_puede_ver(p_clinica uuid)
returns boolean language sql stable set search_path = public as $fn$
  select p_clinica is not null and (
    (coalesce(es_admin_clinica(), false) and p_clinica = clinica_actual())
    or coalesce(es_super_admin_global(), false))
$fn$;

-- 7. LISTA de clientes con todo calculado en UNA consulta (sin N+1).
--    Aquí viven las definiciones de segmento; la pantalla solo las muestra.
create or replace function public.crm_clientes(p_clinica_id uuid default null)
returns table (
  paciente_id uuid, nombre text, telefono text, email text,
  fecha_nacimiento date, fecha_registro timestamptz,
  puntos bigint, nivel text,
  ultima_visita timestamptz, proxima_cita timestamptz,
  visitas_completadas integer, visitas_90d integer,
  ultimo_servicio text, dias_inactivo integer,
  total_cobrado numeric, pedidos integer, referidos integer, membresia_activa boolean,
  es_nuevo boolean, es_frecuente boolean, es_vip boolean, es_inactivo boolean,
  sin_proxima_cita boolean, cumple_este_mes boolean)
language plpgsql stable set search_path = public as $fn$
#variable_conflict use_column
declare
  v_clinica uuid := coalesce(p_clinica_id, clinica_actual());
  v_dias integer;
begin
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  if v_dias is null then raise exception 'Negocio no encontrado'; end if;

  return query
  with pts as (
    select m.paciente_id, sum(m.puntos)::bigint as total
    from puntos_movimientos m where m.clinica_id = v_clinica group by m.paciente_id),
  cit as (
    select c.paciente_id,
      max(c.fecha_hora) filter (where c.estado = 'completada') as ultima,
      min(c.fecha_hora) filter (where c.estado in ('pendiente', 'confirmada') and c.fecha_hora > now()) as proxima,
      (count(*) filter (where c.estado = 'completada'))::integer as visitas,
      (count(*) filter (where c.estado = 'completada' and c.fecha_hora >= now() - interval '90 days'))::integer as visitas90
    from citas c where c.clinica_id = v_clinica group by c.paciente_id),
  ult as (
    select distinct on (c.paciente_id) c.paciente_id, coalesce(s.nombre, c.tratamiento) as servicio
    from citas c left join servicios s on s.id = c.servicio_id
    where c.clinica_id = v_clinica and c.estado = 'completada'
    order by c.paciente_id, c.fecha_hora desc),
  pag as (
    select g.paciente_id, sum(g.monto) as total
    from pagos g where g.clinica_id = v_clinica and g.direccion = 'ingreso'
      and g.anulado_at is null and g.paciente_id is not null group by g.paciente_id),
  ped as (
    select d.paciente_id, (count(*))::integer as n
    from pedidos d where d.clinica_id = v_clinica and d.estado <> 'cancelado' group by d.paciente_id),
  ref as (
    select r.paciente_referidor_id as paciente_id, (count(*))::integer as n
    from referidos r where r.clinica_id = v_clinica group by r.paciente_referidor_id),
  mem as (
    select distinct pm.paciente_id from paciente_membresias pm
    where pm.clinica_id = v_clinica and pm.estado = 'activa'
      and (pm.fecha_fin is null or pm.fecha_fin >= current_date)),
  base as (
    select p.id as pid, p.nombre as pnombre, p.telefono as ptel, p.email as pemail,
      p.fecha_nacimiento as pnac, p.fecha_registro as preg,
      coalesce(pts.total, 0)::bigint as ppuntos,
      cit.ultima as pultima, cit.proxima as pproxima,
      coalesce(cit.visitas, 0) as pvisitas, coalesce(cit.visitas90, 0) as pvisitas90,
      ult.servicio as pservicio,
      case when cit.ultima is null then null else (current_date - cit.ultima::date) end as pdias,
      pag.total as pcobrado, coalesce(ped.n, 0) as ppedidos, coalesce(ref.n, 0) as preferidos,
      (mem.paciente_id is not null) as pmem
    from pacientes p
      left join pts on pts.paciente_id = p.id
      left join cit on cit.paciente_id = p.id
      left join ult on ult.paciente_id = p.id
      left join pag on pag.paciente_id = p.id
      left join ped on ped.paciente_id = p.id
      left join ref on ref.paciente_id = p.id
      left join mem on mem.paciente_id = p.id
    where p.clinica_id = v_clinica)
  select b.pid, b.pnombre, b.ptel, b.pemail, b.pnac, b.preg,
    b.ppuntos, nivel_por_puntos(v_clinica, b.ppuntos),
    b.pultima, b.pproxima, b.pvisitas, b.pvisitas90, b.pservicio, b.pdias,
    b.pcobrado, b.ppedidos, b.preferidos, b.pmem,
    (b.preg >= now() - interval '30 days'),
    (b.pvisitas90 >= 3),
    (nivel_por_puntos(v_clinica, b.ppuntos) in ('gold', 'platinum')),
    (b.pultima is not null and b.pproxima is null and b.pdias >= v_dias),
    (b.pvisitas > 0 and b.pproxima is null),
    (b.pnac is not null and extract(month from b.pnac) = extract(month from current_date))
  from base b;
end $fn$;

-- 8. RESUMEN del CRM. "Recuperado" se mide desde que existe citas.creada_at.
create or replace function public.crm_resumen(p_clinica_id uuid default null)
returns jsonb language plpgsql stable set search_path = public as $fn$
declare
  v_clinica uuid := coalesce(p_clinica_id, clinica_actual());
  v_dias integer;
  v_out jsonb;
  v_desde timestamptz;
  v_recuperados integer;
begin
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  if v_dias is null then raise exception 'Negocio no encontrado'; end if;

  select jsonb_build_object(
    'total', count(*),
    'nuevos_30d', count(*) filter (where es_nuevo),
    'recurrentes', count(*) filter (where visitas_completadas >= 2),
    'inactivos', count(*) filter (where es_inactivo),
    'sin_proxima_cita', count(*) filter (where sin_proxima_cita),
    'dias_inactividad', v_dias)
  into v_out from crm_clientes(v_clinica);

  -- Recuperado: cita COMPLETADA creada después de que el cliente ya llevaba
  -- `dias_inactividad` días sin visitar (la cita fue lo que lo hizo volver).
  select min(c.creada_at) into v_desde from citas c where c.clinica_id = v_clinica and c.creada_at is not null;
  with comp as (
    select c.paciente_id, c.creada_at,
      lag(c.fecha_hora) over (partition by c.paciente_id order by c.fecha_hora) as previa
    from citas c where c.clinica_id = v_clinica and c.estado = 'completada')
  select count(distinct comp.paciente_id)::integer into v_recuperados from comp
  where comp.previa is not null and comp.creada_at is not null
    and comp.creada_at >= comp.previa + make_interval(days => v_dias);

  return v_out || jsonb_build_object('recuperados', v_recuperados, 'recuperados_desde', v_desde);
end $fn$;

-- 9. CLIENTE 360: un solo viaje con todo el resumen del cliente
create or replace function public.crm_cliente_360(p_paciente_id uuid)
returns jsonb language plpgsql stable set search_path = public as $fn$
declare
  v_pac pacientes%rowtype;
  v_cfg clinicas%rowtype;
  v_puntos bigint;
  v_ultima timestamptz;
  v_proxima timestamptz;
begin
  select * into v_pac from pacientes where id = p_paciente_id;
  if not found then raise exception 'Cliente no encontrado'; end if;
  if not crm_puede_ver(v_pac.clinica_id) then raise exception 'No autorizado'; end if;
  select * into v_cfg from clinicas where id = v_pac.clinica_id;

  select coalesce(sum(m.puntos), 0) into v_puntos from puntos_movimientos m where m.paciente_id = p_paciente_id;
  select max(c.fecha_hora) filter (where c.estado = 'completada'),
         min(c.fecha_hora) filter (where c.estado in ('pendiente', 'confirmada') and c.fecha_hora > now())
    into v_ultima, v_proxima from citas c where c.paciente_id = p_paciente_id;

  return jsonb_build_object(
    'moneda', v_cfg.moneda,
    'dias_inactividad', v_cfg.dias_inactividad,
    'paciente', jsonb_build_object(
      'id', v_pac.id, 'clinica_id', v_pac.clinica_id, 'nombre', v_pac.nombre, 'telefono', v_pac.telefono,
      'email', v_pac.email, 'fecha_nacimiento', v_pac.fecha_nacimiento, 'fecha_registro', v_pac.fecha_registro),
    'fidelidad', jsonb_build_object(
      'puntos', v_puntos,
      'nivel', nivel_por_puntos(v_pac.clinica_id, v_puntos),
      'recientes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
          select m.fecha, m.tipo, m.puntos, m.motivo from puntos_movimientos m
          where m.paciente_id = p_paciente_id order by m.fecha desc nulls last limit 5) x),
      'canjes', (select jsonb_build_object('cantidad', count(*), 'puntos', coalesce(sum(-m.puntos), 0))
          from puntos_movimientos m where m.paciente_id = p_paciente_id and m.tipo = 'canje'),
      'membresia', (select to_jsonb(y) from (
          select mb.nombre, mb.nivel, pm.estado, pm.fecha_inicio, pm.fecha_fin
          from paciente_membresias pm join membresias mb on mb.id = pm.membresia_id
          where pm.paciente_id = p_paciente_id and pm.estado = 'activa'
            and (pm.fecha_fin is null or pm.fecha_fin >= current_date)
          order by pm.fecha_inicio desc limit 1) y)),
    'actividad', jsonb_build_object(
      'ultima_visita', v_ultima,
      'proxima_cita', v_proxima,
      'dias_inactivo', case when v_ultima is null then null else (current_date - v_ultima::date) end,
      'citas_completadas', (select count(*) from citas c where c.paciente_id = p_paciente_id and c.estado = 'completada'),
      'citas_canceladas', (select count(*) from citas c where c.paciente_id = p_paciente_id and c.estado = 'cancelada'),
      'ultimo_servicio', (select coalesce(s.nombre, c.tratamiento) from citas c left join servicios s on s.id = c.servicio_id
          where c.paciente_id = p_paciente_id and c.estado = 'completada' order by c.fecha_hora desc limit 1),
      'servicios', (select coalesce(jsonb_agg(jsonb_build_object('nombre', t.n, 'veces', t.v) order by t.v desc), '[]'::jsonb) from (
          select coalesce(s.nombre, c.tratamiento, 'Sin especificar') as n, count(*) as v
          from citas c left join servicios s on s.id = c.servicio_id
          where c.paciente_id = p_paciente_id and c.estado = 'completada' group by 1) t),
      'pedidos', (select jsonb_build_object('cantidad', count(*), 'total', coalesce(sum(d.total), 0))
          from pedidos d where d.paciente_id = p_paciente_id and d.estado <> 'cancelado'),
      'productos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', t.n, 'cantidad', t.q) order by t.q desc), '[]'::jsonb) from (
          select pr.nombre as n, sum(i.cantidad) as q
          from pedido_items i join pedidos d on d.id = i.pedido_id join productos pr on pr.id = i.producto_id
          where d.paciente_id = p_paciente_id and d.estado <> 'cancelado' group by pr.nombre) t),
      'referidos', (select jsonb_build_object('total', count(*),
          'registrados', count(*) filter (where r.estado in ('registrado', 'recompensado')),
          'recompensados', count(*) filter (where r.estado = 'recompensado'))
          from referidos r where r.paciente_referidor_id = p_paciente_id),
      'tratamientos_registrados', (select count(*) from tratamientos_paciente t where t.paciente_id = p_paciente_id)),
    'finanzas', jsonb_build_object(
      'total_cobrado', (select coalesce(sum(g.monto), 0) from pagos g
          where g.paciente_id = p_paciente_id and g.direccion = 'ingreso' and g.anulado_at is null),
      'cobros', (select count(*) from pagos g
          where g.paciente_id = p_paciente_id and g.direccion = 'ingreso' and g.anulado_at is null)));
end $fn$;

-- 10. LÍNEA DE TIEMPO construida desde las tablas existentes (sin tabla de eventos).
--     `citas` no guarda cuándo se creó cada cita, por eso la cita aparece con su
--     fecha y su estado actual (no existe un evento separado de "cita creada").
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
  ) e
  order by e.fecha desc nulls last
  limit greatest(p_limite, 1);
end $fn$;

-- 11. PERMISOS: solo usuarios con sesión; la autorización real está dentro de cada función
revoke all on function public.nivel_por_puntos(uuid, bigint) from public, anon;
revoke all on function public.crm_puede_ver(uuid) from public, anon;
revoke all on function public.crm_clientes(uuid) from public, anon;
revoke all on function public.crm_resumen(uuid) from public, anon;
revoke all on function public.crm_cliente_360(uuid) from public, anon;
revoke all on function public.crm_cliente_timeline(uuid, integer) from public, anon;
grant execute on function public.nivel_por_puntos(uuid, bigint) to authenticated;
grant execute on function public.crm_puede_ver(uuid) to authenticated;
grant execute on function public.crm_clientes(uuid) to authenticated;
grant execute on function public.crm_resumen(uuid) to authenticated;
grant execute on function public.crm_cliente_360(uuid) to authenticated;
grant execute on function public.crm_cliente_timeline(uuid, integer) to authenticated;
