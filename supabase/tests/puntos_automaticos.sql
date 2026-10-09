-- ============================================================
-- PRUEBAS · PUNTOS AUTOMÁTICOS Y VALOR DEL PUNTO
-- Crean datos de prueba y los REVIERTEN solos (error forzado final). Cada línea: OK o FALLA.
-- ============================================================
do $$
declare
  v_adm uuid; v_z uuid; v_sup uuid; v_y uuid;
  v_u1 uuid := gen_random_uuid(); v_u3 uuid := gen_random_uuid();   -- u1: cliente de Z · u3: admin NO super de otra clínica
  v_pac1 uuid; pa uuid; pb uuid; pc uuid; py uuid; sv uuid; sv0 uuid; svy uuid;
  c_sv0 uuid; c_sv uuid; c_leg uuid; c_ins uuid; c_nueva uuid; c_cli uuid; pac_y uuid; n_cita_cli bigint; ped uuid; ped_cancel uuid;
  n_ins_cita bigint; n_tras_crear bigint;
  jv1 jsonb; jv2 jsonb; jv3 jsonb; jv4 jsonb; jv5 jsonb; jped jsonb; jped2 jsonb; jcancel jsonb;
  e_cant text; e_met text; e_prod text; e_cli text; e_clave text; e_cli_adm text; e_otra_prod text;
  e_dup text; e_otorgar text; e_trig text; e_anon1 text; e_anon2 text; e_ped_cli text; e_ped_otra text;
  n_prod_cli bigint; n_serv_cli bigint; n_prod_otra bigint; n_vp_cli bigint; n_vp_otra bigint; n_vp_adm bigint;
  e_vp0 text; e_ledger_upd text; e_ledger_ins text; vp_final numeric; vp_antes numeric;
  items_snap jsonb; v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;

  -- ---------- actores y datos de prueba ----------
  -- Clínica y admin de prueba propios (nunca un negocio real); se revierten con el resto.
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Clínica Prueba', 'HN', 'zz-prueba-' || substr(gen_random_uuid()::text, 1, 8), 'HNL') returning id into v_z;
  v_adm := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (v_adm, 'zz-adm-z@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Admin Z'));
  update perfiles set rol = 'admin' where id = v_adm;
  select id, clinica_id into v_sup, v_y from perfiles where es_super_admin limit 1;
  insert into auth.users (id, email, raw_user_meta_data) values (v_u1, 'zz-p1@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Cliente'));
  insert into auth.users (id, email, raw_user_meta_data) values (v_u3, 'zz-p3@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Admin otra clínica'));
  update perfiles set rol = 'admin' where id = v_u3;
  select id into v_pac1 from pacientes where perfil_id = v_u1;
  select valor_punto into vp_antes from clinicas where id = v_z;
  select id into pac_y from pacientes where clinica_id = v_y limit 1;   -- cliente de OTRA clínica (se obtiene como superusuario)
  insert into productos (clinica_id, nombre, categoria, precio, puntos_otorga) values (v_z, 'ZZ A', 'cremas', 500, 10) returning id into pa;
  insert into productos (clinica_id, nombre, categoria, precio, puntos_otorga) values (v_z, 'ZZ B', 'sueros', 300, 15) returning id into pb;
  insert into productos (clinica_id, nombre, categoria, precio, puntos_otorga) values (v_z, 'ZZ C sin puntos', 'cremas', 80, 0) returning id into pc;
  insert into productos (clinica_id, nombre, categoria, precio, puntos_otorga) values (v_y, 'ZZ Y', 'cremas', 100, 5) returning id into py;
  insert into servicios (clinica_id, nombre, precio, puntos_otorga) values (v_z, 'ZZ Manicure', 250, 100) returning id into sv;
  insert into servicios (clinica_id, nombre, precio, puntos_otorga) values (v_z, 'ZZ Sin puntos', 250, 0) returning id into sv0;
  insert into servicios (clinica_id, nombre, precio, puntos_otorga) values (v_y, 'ZZ Servicio Y', 250, 50) returning id into svy;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento, servicio_id) values (v_z, v_pac1, now() - interval '3 days', 'confirmada', 'ZZ Sin puntos', sv0) returning id into c_sv0;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento, servicio_id) values (v_z, v_pac1, now() - interval '2 days', 'confirmada', 'ZZ Manicure', sv) returning id into c_sv;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (v_z, v_pac1, now() - interval '5 days', 'confirmada', 'Texto antiguo') returning id into c_leg;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento, servicio_id) values (v_z, v_pac1, now() - interval '9 days', 'completada', 'ZZ Manicure', sv) returning id into c_ins;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento, servicio_id) values (v_z, v_pac1, now() - interval '4 days', 'confirmada', 'ZZ Manicure', sv) returning id into c_cli;
  select count(*) into n_ins_cita from puntos_movimientos where origen_tipo = 'cita' and origen_id in (c_sv, c_sv0, c_ins);   -- crear NUNCA otorga

  -- ================= ADMIN: citas completadas y ventas =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  update citas set estado = 'completada' where id = c_sv0;                                   -- servicio con 0 puntos
  update citas set estado = 'completada' where id = c_sv;                                    -- servicio con 100 puntos
  perform set_config('app.sv1', (select count(*) from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv)::text, true);
  update citas set estado = 'completada' where id = c_sv;                                    -- refresh / doble clic (sin cambio)
  update citas set estado = 'confirmada' where id = c_sv;                                    -- se revierte el estado por error…
  update citas set estado = 'completada' where id = c_sv;                                    -- …y se vuelve a completar
  update citas set estado = 'completada' where id = c_leg;                                   -- cita antigua sin servicio_id
  update servicios set puntos_otorga = 500 where id = sv;                                    -- cambia el catálogo DESPUÉS
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento, servicio_id) values (v_z, v_pac1, now() - interval '1 day', 'confirmada', 'ZZ Manicure', sv) returning id into c_nueva;
  update citas set estado = 'completada' where id = c_nueva;                                 -- esta sí usa el valor vigente (500)

  jv1 := public.registrar_venta_producto('00000000-0000-0000-0000-0000000000a1', pa, 2, 'efectivo', v_pac1);   -- 2 × 10 = 20
  jv2 := public.registrar_venta_producto('00000000-0000-0000-0000-0000000000a1', pa, 2, 'efectivo', v_pac1);   -- reintento / doble clic (misma clave)
  jv3 := public.registrar_venta_producto('00000000-0000-0000-0000-0000000000a3', pb, 1, 'tarjeta', v_pac1);    -- otra venta: 15
  jv4 := public.registrar_venta_producto('00000000-0000-0000-0000-0000000000a4', pc, 3, 'efectivo', v_pac1);   -- producto con 0 puntos
  jv5 := public.registrar_venta_producto('00000000-0000-0000-0000-0000000000a5', pa, 1, 'efectivo', null);     -- sin cliente
  e_cant := (public.registrar_venta_producto(gen_random_uuid(), pa, 0, 'efectivo', v_pac1))->>'resultado';
  e_met := (public.registrar_venta_producto(gen_random_uuid(), pa, 1, 'bitcoin', v_pac1))->>'resultado';
  e_prod := (public.registrar_venta_producto(gen_random_uuid(), py, 1, 'efectivo', v_pac1))->>'resultado';          -- producto de otra clínica
  e_cli := (public.registrar_venta_producto(gen_random_uuid(), pa, 1, 'efectivo', pac_y))->>'resultado';
  e_clave := (public.registrar_venta_producto(null, pa, 1, 'efectivo', v_pac1))->>'resultado';
  reset role;

  -- ================= CLIENTE: pedido y ataques =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  set local role authenticated;
  jped := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', pa, 'cantidad', 2), jsonb_build_object('producto_id', pb, 'cantidad', 1)));
  ped := (jped->>'pedido_id')::uuid;                                                         -- A: 10×2 + B: 15×1 = 35
  select count(*) into n_tras_crear from puntos_movimientos where origen_tipo = 'pedido' and origen_id = ped;   -- crear NUNCA otorga
  begin update productos set puntos_otorga = 99999 where id = pa; get diagnostics n_prod_cli = row_count; exception when others then n_prod_cli := -1; end;
  begin update servicios set puntos_otorga = 99999 where id = sv; get diagnostics n_serv_cli = row_count; exception when others then n_serv_cli := -1; end;
  begin update clinicas set valor_punto = 5 where id = v_z; get diagnostics n_vp_cli = row_count; exception when others then n_vp_cli := -1; end;
  begin perform public.otorgar_puntos(v_z, v_pac1, 99999, 'hack', 'cita', gen_random_uuid()); e_otorgar := 'PERMITIDO'; exception when others then e_otorgar := sqlstate; end;
  begin perform public.puntos_por_cita_completada(); e_trig := 'PERMITIDO'; exception when others then e_trig := sqlstate; end;
  begin perform public.registrar_venta_producto(gen_random_uuid(), pa, 1, 'efectivo', v_pac1); e_cli_adm := 'PERMITIDO'; exception when others then e_cli_adm := sqlerrm; end;
  begin perform public.completar_pedido(ped); e_ped_cli := 'PERMITIDO'; exception when others then e_ped_cli := sqlerrm; end;
  begin update puntos_movimientos set puntos = 99999 where paciente_id = v_pac1; e_ledger_upd := 'PERMITIDO'; exception when others then e_ledger_upd := sqlstate; end;
  begin insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, origen_tipo, origen_id) values (v_z, v_pac1, 'acumulacion', 99999, 'cita', gen_random_uuid()); e_ledger_ins := 'PERMITIDO'; exception when others then e_ledger_ins := sqlstate; end;
  begin update citas set estado = 'completada' where id = c_cli; get diagnostics n_cita_cli = row_count; exception when others then n_cita_cli := -1; end;   -- el cliente NO puede completar su cita
  reset role;

  -- un pedido cancelado (fixture) para probar que no otorga
  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado) values (v_z, v_pac1, 10, 'wallet', 'domicilio', 'cancelado') returning id into ped_cancel;
  insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario, puntos_unitarios) values (ped_cancel, pa, 1, 500, 10);

  -- ================= ADMIN: completa el pedido =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  update productos set puntos_otorga = 999 where id = pa;                                    -- el catálogo cambia ENTRE pedir y completar
  jped2 := public.completar_pedido(ped);
  perform set_config('app.ped1', (select count(*) from puntos_movimientos where origen_tipo = 'pedido' and origen_id = ped)::text, true);
  perform set_config('app.ped_rep', (public.completar_pedido(ped))->>'repetido', true);       -- segundo intento
  jcancel := public.completar_pedido(ped_cancel);
  reset role;

  -- ================= ADMIN DE OTRA CLÍNICA (no super) y SUPER ADMIN =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_u3, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  set local role authenticated;
  begin update productos set puntos_otorga = 7 where id = pa; get diagnostics n_prod_otra = row_count; exception when others then n_prod_otra := -1; end;
  begin update clinicas set valor_punto = 5 where id = v_z; get diagnostics n_vp_otra = row_count; exception when others then n_vp_otra := -1; end;
  e_otra_prod := (public.registrar_venta_producto(gen_random_uuid(), pa, 1, 'efectivo', v_pac1))->>'resultado';    -- producto de Z desde otra clínica
  e_ped_otra := (public.completar_pedido(ped))->>'resultado';
  reset role;

  -- ================= ANÓNIMO =================
  set local role anon;
  begin perform public.registrar_venta_producto(gen_random_uuid(), pa, 1, 'efectivo', null); e_anon1 := 'PERMITIDO'; exception when others then e_anon1 := sqlstate; end;
  begin perform public.completar_pedido(ped); e_anon2 := 'PERMITIDO'; exception when others then e_anon2 := sqlstate; end;
  reset role;

  -- ================= DUPLICADO DIRECTO EN LA BASE =================
  begin
    insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, origen_tipo, origen_id) values (v_z, v_pac1, 'acumulacion', 100, 'cita', c_sv);
    e_dup := 'PERMITIDO';
  exception when unique_violation then e_dup := 'bloqueado'; end;

  -- ================= VALOR DEL PUNTO (admin de su negocio) =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  update clinicas set valor_punto = 0.25 where id = v_z;
  begin update clinicas set valor_punto = 0 where id = v_z; e_vp0 := 'PERMITIDO'; exception when check_violation then e_vp0 := 'bloqueado'; end;
  begin update clinicas set valor_punto = -1 where id = v_z; e_vp0 := e_vp0 || '/PERMITIDO'; exception when check_violation then e_vp0 := e_vp0 || '/bloqueado'; end;
  select valor_punto into vp_final from clinicas where id = v_z;
  select count(*) into n_vp_adm from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv and puntos = 100;   -- el histórico no cambia
  reset role;

  -- ================= EVALUACIÓN =================
  v_out := E'--- SERVICIOS ---\n';
  v_out := v_out || pg_temp.chk('crear/registrar una cita NO otorga puntos (ni siquiera una insertada ya como completada)', n_ins_cita = 0, n_ins_cita::text);
  v_out := v_out || pg_temp.chk('servicio con 0 puntos al completar: no genera movimiento', (select count(*) from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv0) = 0);
  v_out := v_out || pg_temp.chk('servicio con 100 puntos al completar: exactamente 1 movimiento de 100', current_setting('app.sv1') = '1' and (select puntos from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv) = 100, current_setting('app.sv1'));
  v_out := v_out || pg_temp.chk('refresh/doble clic y completada→confirmada→completada: sigue siendo 1 solo movimiento', (select count(*) from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv) = 1);
  v_out := v_out || pg_temp.chk('cita antigua sin servicio_id completada: no inventa puntos', (select count(*) from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_leg) = 0);
  v_out := v_out || pg_temp.chk('cambio posterior del catálogo: el abono anterior sigue en 100', (select puntos from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv) = 100);
  v_out := v_out || pg_temp.chk('…y la cita siguiente usa el valor vigente (500)', (select puntos from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_nueva) = 500);
  v_out := v_out || pg_temp.chk('el movimiento queda en el libro mayor del cliente con motivo del servicio', (select motivo from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_sv) = 'Servicio completado: ZZ Manicure');
  v_out := v_out || E'--- PRODUCTOS (venta por escáner) ---\n';
  v_out := v_out || pg_temp.chk('2 unidades × 10 puntos = 20; precio calculado por el servidor (2 × 500 = 1000)', jv1->>'resultado' = 'ok' and (jv1->>'puntos_otorgados')::int = 20 and (select monto from pagos where id = (jv1->>'pago_id')::uuid) = 1000, jv1::text);
  v_out := v_out || pg_temp.chk('reintento con la misma clave: misma venta, sin duplicar pago ni puntos', jv2->>'repetido' = 'true' and jv2->>'pago_id' = jv1->>'pago_id' and (jv2->>'puntos_otorgados')::int = 20
    and (select count(*) from pagos where clave_operacion = '00000000-0000-0000-0000-0000000000a1') = 1
    and (select count(*) from puntos_movimientos where origen_tipo = 'venta' and origen_id = (jv1->>'pago_id')::uuid) = 1);
  v_out := v_out || pg_temp.chk('otra venta (otra clave) otorga sus propios puntos: 1 × 15', jv3->>'repetido' = 'false' and (jv3->>'puntos_otorgados')::int = 15);
  v_out := v_out || pg_temp.chk('producto con 0 puntos: se vende y no genera movimiento', jv4->>'resultado' = 'ok' and (jv4->>'puntos_otorgados')::int = 0
    and (select count(*) from puntos_movimientos where origen_tipo = 'venta' and origen_id = (jv4->>'pago_id')::uuid) = 0);
  v_out := v_out || pg_temp.chk('venta sin cliente: se registra y no otorga puntos', jv5->>'resultado' = 'ok' and (jv5->>'puntos_otorgados')::int = 0);
  v_out := v_out || pg_temp.chk('la venta queda ligada al cliente (alimenta el Cliente 360)', (select paciente_id from pagos where id = (jv1->>'pago_id')::uuid) = v_pac1);
  v_out := v_out || pg_temp.chk('validaciones: cantidad 0, método inválido, producto o cliente de otra clínica, sin clave',
    e_cant = 'cantidad_invalida' and e_met = 'datos_invalidos' and e_prod = 'producto_no_disponible' and e_cli = 'cliente_invalido' and e_clave = 'clave_requerida', e_cant || '/' || e_met || '/' || e_prod || '/' || e_cli || '/' || e_clave);
  v_out := v_out || E'--- PRODUCTOS (pedido de la tienda) ---\n';
  v_out := v_out || pg_temp.chk('crear el pedido NO otorga puntos', n_tras_crear = 0);
  v_out := v_out || pg_temp.chk('varios productos y unidades: A 10×2 + B 15×1 = 35 al completar', jped2->>'resultado' = 'ok' and (jped2->>'puntos_otorgados')::int = 35, jped2::text);
  v_out := v_out || pg_temp.chk('el catálogo cambió entre pedir y completar (A: 10 → 999): se respetan los 35 pedidos', (select puntos from puntos_movimientos where origen_tipo = 'pedido' and origen_id = ped) = 35);
  v_out := v_out || pg_temp.chk('completar dos veces: 1 solo movimiento y se informa repetido', current_setting('app.ped1') = '1' and current_setting('app.ped_rep') = 'true'
    and (select count(*) from puntos_movimientos where origen_tipo = 'pedido' and origen_id = ped) = 1);
  v_out := v_out || pg_temp.chk('pedido cancelado: no se completa ni otorga puntos', jcancel->>'resultado' = 'cancelado' and (select count(*) from puntos_movimientos where origen_tipo = 'pedido' and origen_id = ped_cancel) = 0);
  v_out := v_out || pg_temp.chk('el pedido queda en estado entregado', (select estado from pedidos where id = ped) = 'entregado');
  v_out := v_out || E'--- IDEMPOTENCIA EN LA BASE ---\n';
  v_out := v_out || pg_temp.chk('un abono duplicado para el mismo origen lo rechaza Postgres (índice único)', e_dup = 'bloqueado', e_dup);
  v_out := v_out || E'--- SEGURIDAD ---\n';
  v_out := v_out || pg_temp.chk('cliente NO puede cambiar los puntos de un producto ni de un servicio (0 filas)', n_prod_cli = 0 and n_serv_cli = 0, n_prod_cli || '/' || n_serv_cli);
  v_out := v_out || pg_temp.chk('cliente NO puede cambiar el valor del punto (0 filas)', n_vp_cli = 0, n_vp_cli::text);
  v_out := v_out || pg_temp.chk('cliente NO puede ejecutar otorgar_puntos ni el trigger directamente (42501)', e_otorgar = '42501' and e_trig = '42501', e_otorgar || '/' || e_trig);
  v_out := v_out || pg_temp.chk('cliente NO puede registrar ventas ni completar pedidos', e_cli_adm = 'No autorizado' and e_ped_cli = 'No autorizado', e_cli_adm || '/' || e_ped_cli);
  v_out := v_out || pg_temp.chk('cliente NO puede completar su propia cita (0 filas) ni obtener los puntos', n_cita_cli = 0 and (select estado from citas where id = c_cli) = 'confirmada' and (select count(*) from puntos_movimientos where origen_tipo = 'cita' and origen_id = c_cli) = 0, n_cita_cli::text);
  v_out := v_out || pg_temp.chk('cliente NO puede modificar ni insertar movimientos del libro mayor (42501)', e_ledger_upd = '42501' and e_ledger_ins = '42501', e_ledger_upd || '/' || e_ledger_ins);
  v_out := v_out || pg_temp.chk('admin de OTRA clínica NO puede cambiar puntos de productos ajenos ni el valor del punto (0 filas)', n_prod_otra = 0 and n_vp_otra = 0, n_prod_otra || '/' || n_vp_otra);
  v_out := v_out || pg_temp.chk('admin de OTRA clínica NO puede vender productos ajenos ni completar pedidos ajenos', e_otra_prod = 'producto_no_disponible' and e_ped_otra = 'no_encontrado', e_otra_prod || '/' || e_ped_otra);
  v_out := v_out || pg_temp.chk('anónimo NO puede ejecutar ventas ni completar pedidos (42501)', e_anon1 = '42501' and e_anon2 = '42501', e_anon1 || '/' || e_anon2);
  v_out := v_out || E'--- VALOR DE REFERENCIA DEL PUNTO ---\n';
  v_out := v_out || pg_temp.chk('valor inicial por negocio = 0.10 (única fuente: clinicas.valor_punto)', vp_antes = 0.10, vp_antes::text);
  v_out := v_out || pg_temp.chk('el admin de su negocio lo cambia (0.10 → 0.25)', vp_final = 0.25, vp_final::text);
  v_out := v_out || pg_temp.chk('valores 0 o negativos los rechaza la base', e_vp0 = 'bloqueado/bloqueado', e_vp0);
  v_out := v_out || pg_temp.chk('cambiar el valor del punto NO altera puntos históricos ni los puntos de los productos', n_vp_adm = 1 and (select puntos_otorga from productos where id = pb) = 15);

  raise exception E'RESULTADOS PUNTOS AUTOMATICOS (todo se revierte)\n%', v_out;
end $$;
