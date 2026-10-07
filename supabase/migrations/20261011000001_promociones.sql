-- ============================================================
-- MELISSA · PROMOCIONES DENTRO DE LA APP (segmentadas con las definiciones de la Fase B)
-- Costo incremental: $0 (solo Postgres/Supabase existentes). Sin IA, sin servicios externos.
-- Aditiva, con una refactorización controlada: el cálculo de segmentos de crm_clientes pasa a
-- crm_calcular (una sola definición) y crm_clientes queda como su envoltorio autorizado.
-- ============================================================

-- 1. SEGMENTOS: una sola definición. crm_calcular es interna (nadie la ejecuta desde la API);
--    crm_clientes (admin) y las funciones de promociones (cliente / admin) la reutilizan.
create or replace function public.crm_calcular(p_clinica uuid, p_paciente uuid default null)
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
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_clinica uuid := p_clinica;
  v_dias integer;
begin
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  if v_dias is null then raise exception 'Negocio no encontrado'; end if;

  return query
  with pts as (
    select m.paciente_id, sum(m.puntos)::bigint as total
    from puntos_movimientos m where m.clinica_id = v_clinica and (p_paciente is null or m.paciente_id = p_paciente) group by m.paciente_id),
  cit as (
    select c.paciente_id,
      max(c.fecha_hora) filter (where c.estado = 'completada') as ultima,
      min(c.fecha_hora) filter (where c.estado in ('pendiente', 'confirmada') and c.fecha_hora > now()) as proxima,
      (count(*) filter (where c.estado = 'completada'))::integer as visitas,
      (count(*) filter (where c.estado = 'completada' and c.fecha_hora >= now() - interval '90 days'))::integer as visitas90
    from citas c where c.clinica_id = v_clinica and (p_paciente is null or c.paciente_id = p_paciente) group by c.paciente_id),
  ult as (
    select distinct on (c.paciente_id) c.paciente_id, coalesce(s.nombre, c.tratamiento) as servicio
    from citas c left join servicios s on s.id = c.servicio_id
    where c.clinica_id = v_clinica and c.estado = 'completada' and (p_paciente is null or c.paciente_id = p_paciente)
    order by c.paciente_id, c.fecha_hora desc),
  pag as (
    select g.paciente_id, sum(g.monto) as total
    from pagos g where g.clinica_id = v_clinica and g.direccion = 'ingreso'
      and g.anulado_at is null and g.paciente_id is not null and (p_paciente is null or g.paciente_id = p_paciente) group by g.paciente_id),
  ped as (
    select d.paciente_id, (count(*))::integer as n
    from pedidos d where d.clinica_id = v_clinica and d.estado <> 'cancelado' and (p_paciente is null or d.paciente_id = p_paciente) group by d.paciente_id),
  ref as (
    select r.paciente_referidor_id as paciente_id, (count(*))::integer as n
    from referidos r where r.clinica_id = v_clinica and (p_paciente is null or r.paciente_referidor_id = p_paciente) group by r.paciente_referidor_id),
  mem as (
    select distinct pm.paciente_id from paciente_membresias pm
    where pm.clinica_id = v_clinica and pm.estado = 'activa' and (p_paciente is null or pm.paciente_id = p_paciente)
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
    where p.clinica_id = v_clinica and (p_paciente is null or p.id = p_paciente))
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
revoke all on function public.crm_calcular(uuid, uuid) from public, anon, authenticated;

-- crm_clientes: misma firma y mismas columnas de siempre. Ahora delega en crm_calcular, por lo que
-- pasa a SECURITY DEFINER: la autorización es el control explícito crm_puede_ver (admin de ese negocio o super admin).
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
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_clinica uuid := coalesce(p_clinica_id, clinica_actual());
begin
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;
  return query select * from crm_calcular(v_clinica);
end $fn$;

-- 2. REGLA DE FRECUENCIA por negocio: máximo un aviso (banner) de la misma promoción cada N días por cliente
alter table clinicas add column if not exists promo_frecuencia_dias integer not null default 3
  check (promo_frecuencia_dias between 1 and 365);

-- 3. PROMOCIONES (las crea y administra el negocio; el cliente solo las consulta mediante funciones)
create table if not exists promociones (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 1 and 80),
  descripcion text check (descripcion is null or length(descripcion) <= 500),
  descuento_porcentaje numeric(5, 2) not null check (descuento_porcentaje > 0 and descuento_porcentaje <= 100),
  segmento text not null check (segmento in ('todos', 'nuevos', 'frecuentes', 'vip', 'inactivos', 'sin_proxima', 'cumple', 'membresia')),
  servicio_id uuid,
  inicio date not null default current_date,
  fin date not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'pausada')),
  creada_por uuid default auth.uid() references perfiles(id) on delete set null,
  creada_at timestamptz not null default now(),
  constraint promociones_fechas check (fin >= inicio),
  constraint promociones_id_clinica unique (id, clinica_id),
  foreign key (servicio_id, clinica_id) references servicios (id, clinica_id) on delete set null (servicio_id)
);
create index if not exists idx_promociones_clinica on promociones (clinica_id, estado, fin);
alter table promociones enable row level security;
create policy admin_gestiona_promociones on promociones for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy super_admin_lee_promociones on promociones for select to authenticated
  using (es_super_admin_global());

-- 4. ESTADO POR CLIENTE: disponible → vista → utilizada (o descartada). "Expirada" se deduce de la fecha.
create table if not exists promocion_clientes (
  promocion_id uuid not null,
  clinica_id uuid not null references clinicas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id),
  estado text not null default 'disponible' check (estado in ('disponible', 'vista', 'descartada', 'utilizada')),
  veces_mostrada integer not null default 0 check (veces_mostrada >= 0),
  ultima_vez_mostrada timestamptz,
  vista_at timestamptz,
  utilizada_at timestamptz,
  pago_id uuid references pagos(id) on delete set null,
  primary key (promocion_id, paciente_id),
  foreign key (promocion_id, clinica_id) references promociones (id, clinica_id) on delete cascade
);
alter table promocion_clientes enable row level security;
create policy admin_ve_promocion_clientes on promocion_clientes for select to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica());
create policy super_admin_lee_promocion_clientes on promocion_clientes for select to authenticated
  using (es_super_admin_global());
-- Nadie escribe estos datos desde la API: solo las funciones de más abajo.
revoke insert, update, delete on promocion_clientes from anon, authenticated;

-- 5. VÍNCULOS: un cobro con descuento por promoción, y una cita reservada desde una promoción
alter table pagos add column if not exists promocion_id uuid references promociones(id) on delete set null;
alter table pagos drop constraint if exists pagos_descuento_con_canje;
alter table pagos add constraint pagos_descuento_con_origen
  check (descuento = 0 or canje_id is not null or promocion_id is not null);
-- una promoción se usa una sola vez por cliente: lo garantiza la base
create unique index if not exists idx_pagos_promocion_unica on pagos (promocion_id, paciente_id) where promocion_id is not null;
alter table citas add column if not exists promocion_id uuid;
alter table citas add constraint citas_promocion_misma_clinica
  foreign key (promocion_id, clinica_id) references promociones (id, clinica_id) on delete set null (promocion_id);

-- 6. ¿Pertenece un cliente a un segmento? UNA sola traducción de segmento → indicador de crm_calcular
create or replace function public.promo_aplica_segmento(
  p_segmento text, p_nuevo boolean, p_frecuente boolean, p_vip boolean, p_inactivo boolean,
  p_sin_proxima boolean, p_cumple boolean, p_membresia boolean)
returns boolean language sql immutable as $fn$
  select case p_segmento
    when 'todos' then true
    when 'nuevos' then p_nuevo
    when 'frecuentes' then p_frecuente
    when 'vip' then p_vip
    when 'inactivos' then p_inactivo
    when 'sin_proxima' then p_sin_proxima
    when 'cumple' then p_cumple
    when 'membresia' then p_membresia
    else false end
$fn$;
revoke all on function public.promo_aplica_segmento(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon, authenticated;

-- 7. CLIENTE: sus promociones vigentes y elegibles (no incluye las que descartó ni las expiradas)
create or replace function public.mis_promociones()
returns table (id uuid, titulo text, descripcion text, descuento_porcentaje numeric, fin date,
               servicio_id uuid, servicio_nombre text, estado text)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  return query
  select p.id, p.titulo, p.descripcion, p.descuento_porcentaje, p.fin, p.servicio_id, s.nombre,
         coalesce(pc.estado, 'disponible')
  from promociones p
  join crm_calcular(v_clinica, v_pac) f
    on promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
  left join servicios s on s.id = p.servicio_id
  left join promocion_clientes pc on pc.promocion_id = p.id and pc.paciente_id = v_pac
  where p.clinica_id = v_clinica and p.estado = 'activa' and current_date between p.inicio and p.fin
    and coalesce(pc.estado, 'disponible') <> 'descartada'
  order by p.fin, p.creada_at;
end $fn$;

-- 8. CLIENTE: la promoción a mostrar como aviso AHORA (como mucho una) y se registra que se mostró.
--    Respeta su preferencia "Promociones y ofertas" y la frecuencia del negocio; un refresh no la repite.
create or replace function public.promocion_para_banner()
returns table (id uuid, titulo text, descripcion text, descuento_porcentaje numeric, fin date,
               servicio_id uuid, servicio_nombre text, estado text)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_dias integer;
  v_quiere boolean;
  v_elegida record;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select coalesce(promociones_ofertas, true) into v_quiere from perfiles where id = auth.uid();
  if not coalesce(v_quiere, true) then return; end if;
  select promo_frecuencia_dias into v_dias from clinicas where id = v_clinica;

  select m.* into v_elegida
  from mis_promociones() m
  left join promocion_clientes pc on pc.promocion_id = m.id and pc.paciente_id = v_pac
  where m.estado = 'disponible'
    and (pc.ultima_vez_mostrada is null or pc.ultima_vez_mostrada < now() - make_interval(days => v_dias))
  order by m.fin limit 1;
  if v_elegida.id is null then return; end if;

  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, veces_mostrada, ultima_vez_mostrada)
  values (v_elegida.id, v_clinica, v_pac, 1, now())
  on conflict (promocion_id, paciente_id) do update
    set veces_mostrada = promocion_clientes.veces_mostrada + 1, ultima_vez_mostrada = now();

  id := v_elegida.id; titulo := v_elegida.titulo; descripcion := v_elegida.descripcion;
  descuento_porcentaje := v_elegida.descuento_porcentaje; fin := v_elegida.fin;
  servicio_id := v_elegida.servicio_id; servicio_nombre := v_elegida.servicio_nombre; estado := v_elegida.estado;
  return next;
end $fn$;

-- 9. CLIENTE: marcar una promoción como vista o dejar de verla. NO puede marcarla utilizada.
create or replace function public.marcar_promocion(p_promocion uuid, p_accion text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  if p_accion not in ('vista', 'descartar') then return jsonb_build_object('resultado', 'accion_invalida'); end if;
  if not exists (select 1 from mis_promociones() m where m.id = p_promocion) then
    return jsonb_build_object('resultado', 'no_disponible');
  end if;

  if p_accion = 'vista' then
    insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado, vista_at)
    values (p_promocion, v_clinica, v_pac, 'vista', now())
    on conflict (promocion_id, paciente_id) do update
      set estado = case when promocion_clientes.estado in ('utilizada', 'descartada') then promocion_clientes.estado else 'vista' end,
          vista_at = coalesce(promocion_clientes.vista_at, now());
  else
    insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado)
    values (p_promocion, v_clinica, v_pac, 'descartada')
    on conflict (promocion_id, paciente_id) do update
      set estado = case when promocion_clientes.estado = 'utilizada' then 'utilizada' else 'descartada' end;
  end if;
  return jsonb_build_object('resultado', 'ok');
end $fn$;

-- 10. NEGOCIO: contadores por promoción (solo lo que los datos permiten contar: sin conversión ni ingresos)
create or replace function public.promociones_resumen()
returns table (promocion_id uuid, elegibles integer, vistas integer, descartadas integer, utilizadas integer)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_clinica uuid := clinica_actual();
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  return query
  with f as materialized (select * from crm_calcular(v_clinica))
  select p.id,
    (select count(*) from f where promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa))::integer,
    (select count(*) from promocion_clientes pc where pc.promocion_id = p.id and pc.vista_at is not null)::integer,
    (select count(*) from promocion_clientes pc where pc.promocion_id = p.id and pc.estado = 'descartada')::integer,
    (select count(*) from promocion_clientes pc where pc.promocion_id = p.id and pc.estado = 'utilizada')::integer
  from promociones p where p.clinica_id = v_clinica;
end $fn$;

-- 11. NEGOCIO: promociones que HOY se le pueden aplicar a un cliente (vigentes, elegibles, sin usar)
create or replace function public.promociones_aplicables(p_paciente uuid)
returns table (id uuid, titulo text, descuento_porcentaje numeric, fin date)
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare v_clinica uuid := clinica_actual();
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then return; end if;
  return query
  select p.id, p.titulo, p.descuento_porcentaje, p.fin
  from promociones p
  join crm_calcular(v_clinica, p_paciente) f
    on promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
  where p.clinica_id = v_clinica and p.estado = 'activa' and current_date between p.inicio and p.fin
    and not exists (select 1 from promocion_clientes pc where pc.promocion_id = p.id and pc.paciente_id = p_paciente and pc.estado = 'utilizada')
  order by p.fin;
end $fn$;

-- 12. NEGOCIO: aplicar la promoción en un cobro. El descuento lo calcula el servidor (% de la promoción),
--     una sola vez por cliente, con clave de operación contra dobles clics y reintentos.
create or replace function public.aplicar_promocion(
  p_clave uuid, p_promocion uuid, p_paciente uuid, p_monto_bruto numeric,
  p_tipo text, p_metodo_pago text, p_concepto text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_clinica uuid := clinica_actual();
  v_promo promociones%rowtype;
  v_pago uuid;
  v_desc numeric;
  v_aplica boolean;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if p_clave is null then return jsonb_build_object('resultado', 'clave_requerida'); end if;
  perform pg_advisory_xact_lock(hashtext(p_promocion::text || p_paciente::text));

  select id into v_pago from pagos where clinica_id = v_clinica and clave_operacion = p_clave;
  if found then
    return jsonb_build_object('resultado', 'ok', 'repetido', true, 'pago_id', v_pago);
  end if;

  select * into v_promo from promociones where id = p_promocion and clinica_id = v_clinica;
  if not found then return jsonb_build_object('resultado', 'no_encontrada'); end if;
  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then
    return jsonb_build_object('resultado', 'cliente_invalido');
  end if;
  if v_promo.estado <> 'activa' or current_date not between v_promo.inicio and v_promo.fin then
    return jsonb_build_object('resultado', 'no_vigente');
  end if;
  select promo_aplica_segmento(v_promo.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
    into v_aplica from crm_calcular(v_clinica, p_paciente) f;
  if not coalesce(v_aplica, false) then return jsonb_build_object('resultado', 'no_elegible'); end if;
  if exists (select 1 from promocion_clientes where promocion_id = p_promocion and paciente_id = p_paciente and estado = 'utilizada') then
    return jsonb_build_object('resultado', 'ya_utilizada');
  end if;
  if p_tipo not in ('servicio', 'producto', 'membresia', 'otro') or p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    return jsonb_build_object('resultado', 'datos_invalidos');
  end if;
  if coalesce(trim(p_concepto), '') = '' then return jsonb_build_object('resultado', 'concepto_requerido'); end if;
  if p_monto_bruto is null or p_monto_bruto <= 0 then return jsonb_build_object('resultado', 'monto_invalido'); end if;

  v_desc := round(p_monto_bruto * v_promo.descuento_porcentaje / 100, 2);
  insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, descuento, metodo_pago, direccion, registrado_por, clave_operacion, promocion_id)
  values (v_clinica, p_paciente, trim(p_concepto) || ' · Promoción: ' || v_promo.titulo,
          p_tipo, p_monto_bruto - v_desc, v_desc, p_metodo_pago, 'ingreso', auth.uid(), p_clave, v_promo.id)
  returning id into v_pago;

  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado, utilizada_at, pago_id)
  values (v_promo.id, v_clinica, p_paciente, 'utilizada', now(), v_pago)
  on conflict (promocion_id, paciente_id) do update set estado = 'utilizada', utilizada_at = now(), pago_id = v_pago;

  return jsonb_build_object('resultado', 'ok', 'repetido', false, 'pago_id', v_pago, 'descuento', v_desc, 'cobrado', p_monto_bruto - v_desc);
end $fn$;

-- 13. PERMISOS
revoke all on function public.mis_promociones() from public, anon;
revoke all on function public.promocion_para_banner() from public, anon;
revoke all on function public.marcar_promocion(uuid, text) from public, anon;
revoke all on function public.promociones_resumen() from public, anon;
revoke all on function public.promociones_aplicables(uuid) from public, anon;
revoke all on function public.aplicar_promocion(uuid, uuid, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.mis_promociones() to authenticated;
grant execute on function public.promocion_para_banner() to authenticated;
grant execute on function public.marcar_promocion(uuid, text) to authenticated;
grant execute on function public.promociones_resumen() to authenticated;
grant execute on function public.promociones_aplicables(uuid) to authenticated;
grant execute on function public.aplicar_promocion(uuid, uuid, uuid, numeric, text, text, text) to authenticated;
