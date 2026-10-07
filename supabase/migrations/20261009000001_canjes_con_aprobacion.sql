-- ============================================================
-- MELISSA · CANJES CON APROBACIÓN DEL NEGOCIO Y DESCUENTO JUSTIFICADO EN CAJA
-- (adelanto de la Fase F, pedido por el dueño del producto)
-- Flujo: el cliente SOLICITA (puntos reservados) → el negocio APRUEBA y aplica el
-- descuento en un cobro de Caja, o RECHAZA (puntos devueltos). Todo auditado.
-- Aditiva, salvo que se elimina canjear_recompensa(): no debe existir un canje sin aprobación.
-- ============================================================

-- 1. RECOMPENSAS: valor monetario opcional (precarga el descuento al aprobar y lo limita)
alter table recompensas add column if not exists valor_descuento numeric
  check (valor_descuento is null or valor_descuento > 0);
update recompensas set valor_descuento = 100 where nombre = 'L 100 de descuento' and valor_descuento is null;

-- 2. CANJES: una fila por solicitud, con su ciclo de vida
create table if not exists canjes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id),
  recompensa_id uuid references recompensas(id) on delete set null,
  recompensa_nombre text not null,
  puntos integer not null check (puntos > 0),
  valor_descuento numeric,
  codigo text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aplicado', 'rechazado', 'cancelado')),
  fecha_solicitud timestamptz not null default now(),
  fecha_resolucion timestamptz,
  resuelto_por uuid references perfiles(id) on delete set null,
  descuento_aplicado numeric check (descuento_aplicado is null or descuento_aplicado >= 0),
  pago_id uuid,
  nota text,
  constraint canjes_resolucion_coherente check (
    (estado = 'pendiente' and fecha_resolucion is null) or (estado <> 'pendiente' and fecha_resolucion is not null))
);
create unique index if not exists idx_canjes_codigo on canjes(clinica_id, codigo);
create index if not exists idx_canjes_clinica_estado on canjes(clinica_id, estado, fecha_solicitud);
create index if not exists idx_canjes_paciente on canjes(paciente_id);

alter table canjes enable row level security;
create policy cliente_ve_sus_canjes on canjes for select to authenticated
  using (clinica_id = clinica_actual() and paciente_id = paciente_actual());
create policy admin_ve_canjes on canjes for select to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica());
create policy super_admin_lee_canjes on canjes for select to authenticated
  using (es_super_admin_global());
-- Nadie escribe canjes desde la API: solo las funciones de más abajo.
revoke insert, update, delete on canjes from anon, authenticated;

-- 3. PAGOS y PUNTOS: vínculo con el canje.
--    pagos.monto = lo realmente cobrado; descuento = lo perdonado por el canje
--    (bruto = monto + descuento). Los totales y el cuadre de Caja siguen usando monto.
alter table pagos add column if not exists descuento numeric not null default 0 check (descuento >= 0);
alter table pagos add column if not exists canje_id uuid references canjes(id) on delete set null;
alter table pagos add constraint pagos_descuento_con_canje check (descuento = 0 or canje_id is not null);
create index if not exists idx_pagos_canje on pagos(canje_id);
alter table canjes add constraint canjes_pago_fk foreign key (pago_id) references pagos(id) on delete set null;
alter table puntos_movimientos add column if not exists canje_id uuid references canjes(id) on delete set null;
create index if not exists idx_puntos_canje on puntos_movimientos(canje_id);

-- Un descuento solo puede crearse aprobando un canje: la API no puede escribir
-- descuento ni canje_id directamente en pagos.
revoke insert on pagos from anon, authenticated;
grant insert (clinica_id, paciente_id, concepto, tipo, monto, metodo_pago, direccion, registrado_por)
  on pagos to authenticated;

-- 4. CLIENTE: solicitar un canje (reserva los puntos al instante)
create or replace function public.solicitar_canje(p_recompensa_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_rec recompensas%rowtype;
  v_saldo bigint;
  v_canje uuid;
  v_codigo text;
  v_intentos integer := 0;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select * into v_rec from recompensas where id = p_recompensa_id and clinica_id = v_clinica and activa;
  if not found then return jsonb_build_object('resultado', 'no_disponible'); end if;

  perform 1 from pacientes where id = v_pac for update;
  select coalesce(sum(puntos), 0) into v_saldo from puntos_movimientos where paciente_id = v_pac;
  if v_saldo < v_rec.costo_puntos then return jsonb_build_object('resultado', 'puntos_insuficientes'); end if;

  loop
    v_codigo := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
                 from generate_series(1, 5));
    begin
      insert into canjes (clinica_id, paciente_id, recompensa_id, recompensa_nombre, puntos, valor_descuento, codigo)
      values (v_clinica, v_pac, v_rec.id, v_rec.nombre, v_rec.costo_puntos, v_rec.valor_descuento, v_codigo)
      returning id into v_canje;
      exit;
    exception when unique_violation then
      v_intentos := v_intentos + 1;
      if v_intentos >= 10 then raise exception 'No se pudo generar el código del canje'; end if;
    end;
  end loop;

  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, canje_id)
  values (v_clinica, v_pac, 'canje', -v_rec.costo_puntos, 'Canje solicitado: ' || v_rec.nombre || ' (' || v_codigo || ')', v_canje);

  return jsonb_build_object('resultado', 'ok', 'canje_id', v_canje, 'codigo', v_codigo);
end $fn$;

-- 5. CLIENTE: cancelar su propia solicitud pendiente (se devuelven los puntos)
create or replace function public.cancelar_canje(p_canje_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_pac uuid := paciente_actual();
  v_c canjes%rowtype;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select * into v_c from canjes where id = p_canje_id and paciente_id = v_pac for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_c.estado <> 'pendiente' then return jsonb_build_object('resultado', 'ya_resuelto'); end if;

  update canjes set estado = 'cancelado', fecha_resolucion = now() where id = v_c.id;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, canje_id)
  values (v_c.clinica_id, v_c.paciente_id, 'ajuste', v_c.puntos,
          'Canje cancelado: ' || v_c.recompensa_nombre || ' (' || v_c.codigo || ')', v_c.id);
  return jsonb_build_object('resultado', 'ok', 'puntos_devueltos', v_c.puntos);
end $fn$;

-- 6. NEGOCIO: rechazar (exige motivo; se devuelven los puntos)
create or replace function public.rechazar_canje(p_canje_id uuid, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_c canjes%rowtype;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select * into v_c from canjes where id = p_canje_id and clinica_id = clinica_actual() for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_c.estado <> 'pendiente' then return jsonb_build_object('resultado', 'ya_resuelto'); end if;
  if v_nota is null then return jsonb_build_object('resultado', 'motivo_requerido'); end if;

  update canjes set estado = 'rechazado', fecha_resolucion = now(), resuelto_por = auth.uid(), nota = v_nota
  where id = v_c.id;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, canje_id)
  values (v_c.clinica_id, v_c.paciente_id, 'ajuste', v_c.puntos,
          'Canje rechazado: ' || v_c.recompensa_nombre || ' (' || v_c.codigo || ') — ' || v_nota, v_c.id);
  return jsonb_build_object('resultado', 'ok', 'puntos_devueltos', v_c.puntos);
end $fn$;

-- 7. NEGOCIO: aprobar y aplicar el descuento en un cobro de Caja (una sola transacción)
create or replace function public.aplicar_canje(
  p_canje_id uuid, p_monto_bruto numeric, p_descuento numeric,
  p_tipo text, p_metodo_pago text, p_concepto text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_c canjes%rowtype;
  v_pago uuid;
  v_neto numeric;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select * into v_c from canjes where id = p_canje_id and clinica_id = clinica_actual() for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_c.estado <> 'pendiente' then return jsonb_build_object('resultado', 'ya_resuelto'); end if;

  if p_tipo not in ('servicio', 'producto', 'membresia', 'otro')
     or p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    return jsonb_build_object('resultado', 'datos_invalidos');
  end if;
  if coalesce(trim(p_concepto), '') = '' then return jsonb_build_object('resultado', 'concepto_requerido'); end if;
  if p_monto_bruto is null or p_monto_bruto <= 0 then return jsonb_build_object('resultado', 'monto_invalido'); end if;
  if p_descuento is null or p_descuento <= 0 or p_descuento > p_monto_bruto then
    return jsonb_build_object('resultado', 'descuento_invalido');
  end if;
  if v_c.valor_descuento is not null and p_descuento > v_c.valor_descuento then
    return jsonb_build_object('resultado', 'descuento_excede_recompensa', 'maximo', v_c.valor_descuento);
  end if;

  v_neto := p_monto_bruto - p_descuento;
  insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, descuento, metodo_pago, direccion, registrado_por, canje_id)
  values (v_c.clinica_id, v_c.paciente_id,
          trim(p_concepto) || ' · Canje ' || v_c.codigo || ': ' || v_c.recompensa_nombre,
          p_tipo, v_neto, p_descuento, p_metodo_pago, 'ingreso', auth.uid(), v_c.id)
  returning id into v_pago;

  update canjes set estado = 'aplicado', fecha_resolucion = now(), resuelto_por = auth.uid(),
    descuento_aplicado = p_descuento, pago_id = v_pago
  where id = v_c.id;

  return jsonb_build_object('resultado', 'ok', 'pago_id', v_pago, 'cobrado', v_neto);
end $fn$;

-- 8. Se elimina la vía antigua (canje instantáneo sin aprobación)
drop function if exists public.canjear_recompensa(uuid);

-- 9. CLIENTE 360: "Recompensas canjeadas" cuenta solo canjes aplicados (y los
--    anteriores a esta función); las solicitudes pendientes se muestran aparte.
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
      'canjes', (select jsonb_build_object('cantidad', count(*), 'puntos', coalesce(sum(-m.puntos), 0),
            'pendientes', (select count(*) from canjes k where k.paciente_id = p_paciente_id and k.estado = 'pendiente'))
          from puntos_movimientos m left join canjes c on c.id = m.canje_id
          where m.paciente_id = p_paciente_id and m.tipo = 'canje' and (c.id is null or c.estado = 'aplicado')),
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

-- 10. PERMISOS
revoke all on function public.solicitar_canje(uuid) from public, anon;
revoke all on function public.cancelar_canje(uuid) from public, anon;
revoke all on function public.rechazar_canje(uuid, text) from public, anon;
revoke all on function public.aplicar_canje(uuid, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.solicitar_canje(uuid) to authenticated;
grant execute on function public.cancelar_canje(uuid) to authenticated;
grant execute on function public.rechazar_canje(uuid, text) to authenticated;
grant execute on function public.aplicar_canje(uuid, numeric, numeric, text, text, text) to authenticated;
