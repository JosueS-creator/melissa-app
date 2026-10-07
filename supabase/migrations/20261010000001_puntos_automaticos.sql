-- ============================================================
-- MELISSA · PUNTOS AUTOMÁTICOS (catálogo → libro mayor) + valor de referencia del punto
-- Reglas: nunca por crear una cita; una misma operación nunca otorga dos veces
-- (protegido por un índice único en Postgres); el libro mayor sigue siendo la fuente histórica.
-- Aditiva. Reemplaza crear_pedido() para guardar los puntos vigentes al momento de pedir.
-- ============================================================

-- 1. PUNTOS configurables en el catálogo (el negocio los define; 0 = no otorga)
alter table productos add column if not exists puntos_otorga integer not null default 0
  check (puntos_otorga between 0 and 1000000);
alter table servicios add column if not exists puntos_otorga integer not null default 0
  check (puntos_otorga between 0 and 1000000);

-- 2. VALOR DE REFERENCIA del punto: fuente única, por negocio. Solo alimenta las
--    sugerencias; NO modifica puntos históricos ni productos existentes.
alter table clinicas add column if not exists valor_punto numeric(10, 4) not null default 0.10
  check (valor_punto > 0);

-- 3. IDEMPOTENCIA: cada abono automático indica su origen y solo puede existir una vez
alter table puntos_movimientos add column if not exists origen_tipo text
  check (origen_tipo in ('cita', 'venta', 'pedido'));
alter table puntos_movimientos add column if not exists origen_id uuid;
alter table puntos_movimientos add constraint puntos_origen_completo
  check ((origen_tipo is null) = (origen_id is null));
create unique index if not exists idx_puntos_origen_unico
  on puntos_movimientos (origen_tipo, origen_id) where origen_tipo is not null;

-- 4. Los pedidos guardan los puntos vigentes al pedir; los pagos, una clave de operación
alter table pedido_items add column if not exists puntos_unitarios integer not null default 0
  check (puntos_unitarios >= 0);
alter table pagos add column if not exists clave_operacion uuid;
create unique index if not exists idx_pagos_clave_operacion
  on pagos (clinica_id, clave_operacion) where clave_operacion is not null;

-- 5. ÚNICA puerta de abonos automáticos (interna: no ejecutable desde la API)
create or replace function public.otorgar_puntos(
  p_clinica uuid, p_paciente uuid, p_puntos integer, p_motivo text, p_origen_tipo text, p_origen_id uuid)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare v_filas integer;
begin
  if p_puntos is null or p_puntos <= 0 then return false; end if;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, origen_tipo, origen_id)
  values (p_clinica, p_paciente, 'acumulacion', p_puntos, p_motivo, p_origen_tipo, p_origen_id)
  on conflict (origen_tipo, origen_id) where origen_tipo is not null do nothing;
  get diagnostics v_filas = row_count;
  return v_filas > 0;
end $fn$;
revoke all on function public.otorgar_puntos(uuid, uuid, integer, text, text, uuid) from public, anon, authenticated;

-- 6. CITA COMPLETADA → puntos del servicio (solo al pasar a "completada"; nunca al crearla)
create or replace function public.puntos_por_cita_completada()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_serv record;
begin
  if new.servicio_id is null then return new; end if;   -- citas antiguas solo con texto: no se adivina el servicio
  select nombre, puntos_otorga into v_serv from servicios where id = new.servicio_id;
  if found and v_serv.puntos_otorga > 0 then
    perform otorgar_puntos(new.clinica_id, new.paciente_id, v_serv.puntos_otorga,
                           'Servicio completado: ' || v_serv.nombre, 'cita', new.id);
  end if;
  return new;
end $fn$;
revoke all on function public.puntos_por_cita_completada() from public, anon, authenticated;
drop trigger if exists citas_puntos_al_completar on citas;
create trigger citas_puntos_al_completar after update of estado on citas
  for each row when (new.estado = 'completada' and old.estado is distinct from 'completada')
  execute function public.puntos_por_cita_completada();

-- 7. VENTA DE PRODUCTO (escáner de Caja): precio y puntos los calcula el servidor;
--    la clave de operación hace seguro el doble clic, el refresh y los reintentos
create or replace function public.registrar_venta_producto(
  p_clave uuid, p_producto_id uuid, p_cantidad integer, p_metodo_pago text, p_paciente_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_clinica uuid := clinica_actual();
  v_prod productos%rowtype;
  v_pago uuid;
  v_puntos integer := 0;
  v_otorgado boolean := false;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if p_clave is null then return jsonb_build_object('resultado', 'clave_requerida'); end if;

  select id into v_pago from pagos where clinica_id = v_clinica and clave_operacion = p_clave;
  if found then
    return jsonb_build_object('resultado', 'ok', 'repetido', true, 'pago_id', v_pago,
      'puntos_otorgados', coalesce((select puntos from puntos_movimientos where origen_tipo = 'venta' and origen_id = v_pago), 0));
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 1000 then return jsonb_build_object('resultado', 'cantidad_invalida'); end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then return jsonb_build_object('resultado', 'datos_invalidos'); end if;
  select * into v_prod from productos where id = p_producto_id and clinica_id = v_clinica and activo;
  if not found then return jsonb_build_object('resultado', 'producto_no_disponible'); end if;
  if p_paciente_id is not null and not exists (select 1 from pacientes where id = p_paciente_id and clinica_id = v_clinica) then
    return jsonb_build_object('resultado', 'cliente_invalido');
  end if;

  begin
    insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, metodo_pago, direccion, registrado_por, clave_operacion)
    values (v_clinica, p_paciente_id,
            'Venta: ' || v_prod.nombre || case when p_cantidad > 1 then ' x' || p_cantidad else '' end,
            'producto', v_prod.precio * p_cantidad, p_metodo_pago, 'ingreso', auth.uid(), p_clave)
    returning id into v_pago;
  exception when unique_violation then   -- dos envíos simultáneos con la misma clave
    select id into v_pago from pagos where clinica_id = v_clinica and clave_operacion = p_clave;
    return jsonb_build_object('resultado', 'ok', 'repetido', true, 'pago_id', v_pago,
      'puntos_otorgados', coalesce((select puntos from puntos_movimientos where origen_tipo = 'venta' and origen_id = v_pago), 0));
  end;

  if p_paciente_id is not null then
    v_puntos := v_prod.puntos_otorga * p_cantidad;
    v_otorgado := otorgar_puntos(v_clinica, p_paciente_id, v_puntos,
                                 'Compra: ' || v_prod.nombre || ' x' || p_cantidad, 'venta', v_pago);
  end if;
  return jsonb_build_object('resultado', 'ok', 'repetido', false, 'pago_id', v_pago,
                            'puntos_otorgados', case when v_otorgado then v_puntos else 0 end);
end $fn$;

-- 8. PEDIDO DE LA TIENDA COMPLETADO (entregado) → puntos de lo comprado, una sola vez
create or replace function public.completar_pedido(p_pedido_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_ped pedidos%rowtype;
  v_puntos integer;
  v_otorgado boolean;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select * into v_ped from pedidos where id = p_pedido_id and clinica_id = clinica_actual() for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_ped.estado = 'cancelado' then return jsonb_build_object('resultado', 'cancelado'); end if;

  select coalesce(sum(cantidad * puntos_unitarios), 0) into v_puntos from pedido_items where pedido_id = v_ped.id;
  if v_ped.estado <> 'entregado' then update pedidos set estado = 'entregado' where id = v_ped.id; end if;
  v_otorgado := otorgar_puntos(v_ped.clinica_id, v_ped.paciente_id, v_puntos, 'Compra en tienda completada', 'pedido', v_ped.id);
  return jsonb_build_object('resultado', 'ok', 'repetido', v_ped.estado = 'entregado',
                            'puntos_otorgados', case when v_otorgado then v_puntos else 0 end);
end $fn$;

-- 9. crear_pedido(): igual que antes, pero guarda los puntos vigentes al pedir
create or replace function public.crear_pedido(p_items jsonb, p_entrega text default 'domicilio')
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_total numeric := 0;
  v_pedido uuid;
  v_item jsonb;
  v_prod productos%rowtype;
  v_cant int;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  if p_entrega not in ('domicilio', 'recoger_clinica') then raise exception 'Entrega inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Pedido vacío'; end if;

  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado)
  values (v_clinica, v_pac, 0, 'wallet', p_entrega, 'pendiente') returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::int;
    if v_cant is null or v_cant < 1 or v_cant > 100 then raise exception 'Cantidad inválida'; end if;
    select * into v_prod from productos
      where id = (v_item->>'producto_id')::uuid and clinica_id = v_clinica and activo;
    if not found then raise exception 'Producto no disponible'; end if;
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario, puntos_unitarios)
    values (v_pedido, v_prod.id, v_cant, v_prod.precio, v_prod.puntos_otorga);
    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update pedidos set total = v_total where id = v_pedido;
  return jsonb_build_object('pedido_id', v_pedido, 'total', v_total);
end $fn$;

-- 10. PERMISOS
revoke all on function public.registrar_venta_producto(uuid, uuid, integer, text, uuid) from public, anon;
revoke all on function public.completar_pedido(uuid) from public, anon;
grant execute on function public.registrar_venta_producto(uuid, uuid, integer, text, uuid) to authenticated;
grant execute on function public.completar_pedido(uuid) to authenticated;
