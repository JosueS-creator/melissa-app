-- ============================================================
-- PRUEBAS FASE B · CRM  (se pegan en el SQL Editor)
-- Crean datos de prueba y los REVIERTEN solos: el bloque termina con un error
-- forzado ("RESULTADOS ...") y Postgres deshace todo. Cada línea dice OK o FALLA.
-- ============================================================
do $$
declare
  v_adm uuid; v_z uuid; v_sup uuid; v_p uuid; v_pac uuid; v_y uuid; v_pac_y uuid; v_srv_y uuid;
  v_sv uuid; v_mem uuid; v_prod1 uuid; v_prod2 uuid; v_ped uuid;
  p0 uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; p7 uuid; p8 uuid; p9 uuid;
  r0 jsonb; r1 jsonb; j3 jsonb; j0 jsonb; jsup jsonb;
  c0 record; c1 record; c2 record; c3 record; c4 record; c5 record; c6 record; c7 record;
  n_filas int; n_tl int; arr timestamptz[]; e_cross1 text; e_cross2 text; e_cross3 text; e_cli1 text; e_cli2 text;
  e_cli3 text; e_cli4 text; e_anon text; n_cli_pac int; n_sup int; n_legacy_null int; n_tot_citas int;
  ts_forzada timestamptz; ts_leida timestamptz; reg1 record; reg2 record; reg3 record; reg4 record;
  e_fk text; fk_ok boolean; srv_tras_borrar uuid; cl_tras_borrar uuid; n_back int; e_umbral text; v_cita_fk uuid;
  v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;

  -- ---------- actores ----------
  -- Clínica y admin de prueba propios (nunca un negocio real); se revierten con el resto.
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Clínica Prueba', 'HN', 'zz-prueba-' || substr(gen_random_uuid()::text, 1, 8), 'HNL') returning id into v_z;
  v_adm := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (v_adm, 'zz-adm-z@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Admin Z'));
  update perfiles set rol = 'admin' where id = v_adm;
  select id into v_sup from perfiles where es_super_admin limit 1;
  select id into v_y from clinicas where slug = 'demo';   -- v_y = la clínica de demostración (no un negocio real)
  v_p := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (v_p, 'zz-pac-y@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Cliente Y'));
  if v_y = v_z then select id into v_y from clinicas where id <> v_z limit 1; end if;    -- otra clínica distinta de la del admin
  select id into v_pac from pacientes where perfil_id = v_p limit 1;
  insert into pacientes (clinica_id, nombre) values (v_y, 'ZZ-otra-clinica') returning id into v_pac_y;
  insert into servicios (clinica_id, nombre, precio) values (v_y, 'ZZ servicio otra clínica', 1) returning id into v_srv_y;
  select count(*), count(*) filter (where creada_at is null) into n_tot_citas, n_legacy_null from citas;

  -- ---------- admin: resumen ANTES de los datos de prueba ----------
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  r0 := public.crm_resumen();
  reset role;

  -- ---------- datos de prueba en la clínica del admin (v_z) ----------
  insert into servicios (clinica_id, nombre, precio) values (v_z, 'ZZ Facial', 500) returning id into v_sv;
  insert into membresias (clinica_id, nombre, nivel, precio_mensual) values (v_z, 'ZZ Membresía', 'silver', 100) returning id into v_mem;
  insert into productos (clinica_id, nombre, categoria, precio) values (v_z, 'ZZ Crema', 'cremas', 100) returning id into v_prod1;
  insert into productos (clinica_id, nombre, categoria, precio) values (v_z, 'ZZ Suero', 'sueros', 250) returning id into v_prod2;

  -- P0: sin citas, sin pagos, sin puntos, sin email, sin fecha de nacimiento (registro reciente)
  insert into pacientes (clinica_id, nombre) values (v_z, 'ZZ-P0 sin nada') returning id into p0;
  -- P1: inactivo (visita hace 100 días, sin cita futura), con email, cumpleaños este mes, 900 puntos, servicio del catálogo
  insert into pacientes (clinica_id, nombre, email, fecha_nacimiento, fecha_registro)
    values (v_z, 'ZZ-P1 inactivo', 'p1@x.test', make_date(1990, extract(month from current_date)::int, 15), now() - interval '200 days') returning id into p1;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento, servicio_id) values (v_z, p1, now() - interval '100 days', 'completada', 'texto viejo', v_sv);
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo) values (v_z, p1, 'acumulacion', 900, 'prueba');
  -- P2: visita reciente y cita futura confirmada
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P2 con futura', now() - interval '200 days') returning id into p2;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p2, now() - interval '10 days', 'completada', 'Limpieza'), (v_z, p2, now() + interval '5 days', 'confirmada', 'Limpieza');
  -- P3: frecuente, varias compras, pagos (uno anulado), puntos con canje, membresía, referido y tratamiento
  insert into pacientes (clinica_id, nombre, email, fecha_registro) values (v_z, 'ZZ-P3 frecuente', 'p3@x.test', now() - interval '200 days') returning id into p3;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p3, now() - interval '10 days', 'completada', 'Peeling'), (v_z, p3, now() - interval '30 days', 'completada', 'Peeling'),
    (v_z, p3, now() - interval '60 days', 'completada', 'Limpieza');
  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado) values (v_z, p3, 450, 'wallet', 'domicilio', 'pagado') returning id into v_ped;
  insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario) values (v_ped, v_prod1, 2, 100), (v_ped, v_prod2, 1, 250);
  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado) values (v_z, p3, 100, 'wallet', 'domicilio', 'entregado');
  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado) values (v_z, p3, 999, 'wallet', 'domicilio', 'cancelado');
  insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, metodo_pago, direccion) values
    (v_z, p3, 'Peeling', 'servicio', 100, 'efectivo', 'ingreso'), (v_z, p3, 'Crema', 'producto', 250, 'tarjeta', 'ingreso');
  insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, metodo_pago, direccion, anulado_at) values
    (v_z, p3, 'Cobro anulado', 'servicio', 9999, 'efectivo', 'ingreso', now());
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo) values (v_z, p3, 'acumulacion', 100, 'visita');
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo) values (v_z, p3, 'canje', -50, 'Canje: prueba');
  insert into paciente_membresias (clinica_id, paciente_id, membresia_id, fecha_inicio, estado) values (v_z, p3, v_mem, current_date - 5, 'activa');
  insert into referidos (clinica_id, paciente_referidor_id, telefono_referido, estado, codigo) values (v_z, p3, '999', 'registrado', 'ZZ');
  insert into tratamientos_paciente (clinica_id, paciente_id, procedimiento) values (v_z, p3, 'ZZ Registro');
  -- P4: visita hace 50 días pero con cita futura PENDIENTE (no debe contar como inactivo)
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P4 pendiente futura', now() - interval '200 days') returning id into p4;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p4, now() - interval '50 days', 'completada', 'Limpieza'), (v_z, p4, now() + interval '3 days', 'pendiente', 'Limpieza');
  -- P5/P6/P7: recuperación (creada_at: dentro del periodo de inactividad / antes / desconocida)
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P5 recuperado', now() - interval '200 days') returning id into p5;
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P6 agendado antes', now() - interval '200 days') returning id into p6;
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P7 historial viejo', now() - interval '200 days') returning id into p7;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p5, now() - interval '120 days', 'completada', 'A'), (v_z, p6, now() - interval '120 days', 'completada', 'A'), (v_z, p7, now() - interval '120 days', 'completada', 'A');
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p5, now() - interval '10 days', 'completada', 'B'), (v_z, p6, now() - interval '10 days', 'completada', 'B'), (v_z, p7, now() - interval '10 days', 'completada', 'B');
  update citas set creada_at = now() - interval '70 days'  where paciente_id = p5 and tratamiento = 'B';   -- agendada ya inactivo → recuperado
  update citas set creada_at = now() - interval '100 days' where paciente_id = p6 and tratamiento = 'B';   -- agendada antes de quedar inactivo
  update citas set creada_at = null                         where paciente_id = p7 and tratamiento = 'B';   -- historial sin fecha de creación
  -- P8: historial IMPORTADO/retroactivo (se registra hoy visitas que ocurrieron hace meses) → NO es recuperación
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P8 importado', now() - interval '200 days') returning id into p8;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p8, now() - interval '120 days', 'completada', 'A'), (v_z, p8, now() - interval '10 days', 'completada', 'B');
  -- P9: volvió y se registró EL MISMO DÍA de la visita (cliente sin reserva previa) → sí es recuperación
  insert into pacientes (clinica_id, nombre, fecha_registro) values (v_z, 'ZZ-P9 mismo día', now() - interval '200 days') returning id into p9;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, p9, now() - interval '120 days', 'completada', 'A'),
    (v_z, p9, date_trunc('day', now()) - interval '14 hours', 'completada', 'B');   -- ayer 10:00
  update citas set creada_at = date_trunc('day', now()) - interval '13 hours 50 minutes'  -- ayer 10:10 (mismo día)
    where paciente_id = p9 and tratamiento = 'B';

  -- ================= ADMIN (su clínica) =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select * into c0 from public.crm_clientes() c where c.nombre = 'ZZ-P0 sin nada';
  select * into c1 from public.crm_clientes() c where c.nombre = 'ZZ-P1 inactivo';
  select * into c2 from public.crm_clientes() c where c.nombre = 'ZZ-P2 con futura';
  select * into c3 from public.crm_clientes() c where c.nombre = 'ZZ-P3 frecuente';
  select * into c4 from public.crm_clientes() c where c.nombre = 'ZZ-P4 pendiente futura';
  select * into c5 from public.crm_clientes() c where c.nombre = 'ZZ-P5 recuperado';
  select * into c6 from public.crm_clientes() c where c.nombre = 'ZZ-P6 agendado antes';
  select * into c7 from public.crm_clientes() c where c.nombre = 'ZZ-P7 historial viejo';
  select count(*) into n_back from public.crm_clientes() c where c.nombre = 'ZZ-otra-clinica';        -- cliente de OTRA clínica
  r1 := public.crm_resumen();
  j3 := public.crm_cliente_360(p3);
  j0 := public.crm_cliente_360(p0);
  select count(*), array_agg(t.fecha) into n_tl, arr from public.crm_cliente_timeline(p3) t;
  begin perform public.crm_clientes(v_y);                  e_cross1 := 'PERMITIDO'; exception when others then e_cross1 := sqlerrm; end;
  begin perform public.crm_resumen(v_y);                   e_cross2 := 'PERMITIDO'; exception when others then e_cross2 := sqlerrm; end;
  begin perform public.crm_cliente_360(v_pac_y);           e_cross3 := 'PERMITIDO'; exception when others then e_cross3 := sqlerrm; end;
  begin perform public.crm_cliente_timeline(v_pac_y);      e_cli4  := 'PERMITIDO'; exception when others then e_cli4  := sqlerrm; end;
  reset role;

  -- ================= CLIENTE =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_p::text, true);
  set local role authenticated;
  begin perform public.crm_clientes();                     e_cli1 := 'PERMITIDO'; exception when others then e_cli1 := sqlerrm; end;
  begin perform public.crm_resumen();                      e_cli2 := 'PERMITIDO'; exception when others then e_cli2 := sqlerrm; end;
  begin perform public.crm_cliente_360(v_pac);             e_cli3 := 'PERMITIDO'; exception when others then e_cli3 := sqlerrm; end;
  select count(*) into n_cli_pac from pacientes;                                                          -- solo debe ver el suyo
  begin
    insert into citas (clinica_id, paciente_id, fecha_hora, estado, creada_at)
      values ((select clinica_id from pacientes where id = v_pac), v_pac, now() + interval '9 days', 'pendiente', now() - interval '1 year')
      returning id, creada_at into v_cita_fk, ts_forzada;
    select creada_at into ts_leida from citas where id = v_cita_fk;
  exception when others then ts_leida := null; end;
  reset role;

  -- ================= SUPER ADMIN =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated;
  select count(*) into n_sup from public.crm_clientes(v_z) c where c.nombre like 'ZZ-%';
  jsup := public.crm_resumen(v_z);
  begin perform public.crm_cliente_360(v_pac_y); n_filas := 1; exception when others then n_filas := 0; end;   -- cliente de otra clínica
  reset role;

  -- ================= ANÓNIMO =================
  set local role anon;
  begin perform public.crm_clientes(v_z); e_anon := 'PERMITIDO'; exception when others then e_anon := sqlstate; end;
  reset role;

  -- ================= REGISTRO, FK, UMBRALES (como superusuario) =================
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'reg1@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'R1', 'fecha_nacimiento', '1990-05-17'));
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'reg2@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'R2', 'fecha_nacimiento', 'no-es-fecha'));
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'reg3@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'R3', 'fecha_nacimiento', '2999-01-01'));
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'reg4@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'R4'));
  select email, fecha_nacimiento into reg1 from pacientes where nombre = 'R1' and clinica_id = v_z;
  select email, fecha_nacimiento into reg2 from pacientes where nombre = 'R2' and clinica_id = v_z;
  select email, fecha_nacimiento into reg3 from pacientes where nombre = 'R3' and clinica_id = v_z;
  select email, fecha_nacimiento into reg4 from pacientes where nombre = 'R4' and clinica_id = v_z;

  begin insert into citas (clinica_id, paciente_id, fecha_hora, estado, servicio_id) values (v_z, p0, now() + interval '1 day', 'pendiente', v_srv_y); e_fk := 'PERMITIDO';
  exception when foreign_key_violation then e_fk := 'bloqueado'; end;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, servicio_id) values (v_z, p0, now() + interval '1 day', 'pendiente', v_sv); fk_ok := true;
  delete from servicios where id = v_sv;
  select servicio_id, clinica_id into srv_tras_borrar, cl_tras_borrar from citas where paciente_id = p0 and estado = 'pendiente' limit 1;
  begin update clinicas set umbral_oro = 0 where id = v_z; e_umbral := 'PERMITIDO'; exception when check_violation then e_umbral := 'bloqueado'; end;

  -- ================= EVALUACIÓN =================
  v_out := E'--- ADMIN: solo ve su clínica / abre Cliente 360 ---\n';
  v_out := v_out || pg_temp.chk('lista del admin NO incluye clientes de otra clínica', n_back = 0);
  v_out := v_out || pg_temp.chk('admin NO puede pedir la lista de otra clínica', e_cross1 = 'No autorizado', e_cross1);
  v_out := v_out || pg_temp.chk('admin NO puede pedir el resumen de otra clínica', e_cross2 = 'No autorizado', e_cross2);
  v_out := v_out || pg_temp.chk('admin NO puede abrir el Cliente 360 de otra clínica', e_cross3 in ('Cliente no encontrado','No autorizado'), e_cross3);
  v_out := v_out || pg_temp.chk('admin NO puede ver la línea de tiempo de otra clínica', e_cli4 in ('Cliente no encontrado','No autorizado'), e_cli4);
  v_out := v_out || pg_temp.chk('resumen: total +10 clientes', (r1->>'total')::int - (r0->>'total')::int = 10, (r1->>'total') || ' vs ' || (r0->>'total'));
  v_out := v_out || pg_temp.chk('resumen: nuevos 30d +1 (solo P0)', (r1->>'nuevos_30d')::int - (r0->>'nuevos_30d')::int = 1);
  v_out := v_out || pg_temp.chk('resumen: recurrentes +6 (P3,P5,P6,P7,P8,P9)', (r1->>'recurrentes')::int - (r0->>'recurrentes')::int = 6);
  v_out := v_out || pg_temp.chk('resumen: inactivos +1 (solo P1)', (r1->>'inactivos')::int - (r0->>'inactivos')::int = 1);
  v_out := v_out || pg_temp.chk('resumen: sin próxima cita +7 (P1,P3,P5,P6,P7,P8,P9)', (r1->>'sin_proxima_cita')::int - (r0->>'sin_proxima_cita')::int = 7);
  v_out := v_out || pg_temp.chk('resumen: recuperados +2 (P5 y P9)', (r1->>'recuperados')::int - (r0->>'recuperados')::int = 2, (r1->>'recuperados'));
  v_out := v_out || pg_temp.chk('resumen: "recuperados_desde" informado', (r1->>'recuperados_desde') is not null);
  v_out := v_out || E'--- DATOS: 10 casos ---\n';
  v_out := v_out || pg_temp.chk('cliente SIN citas/pagos/puntos/email/nacimiento: no rompe y valores nulos/cero',
    c0.ultima_visita is null and c0.dias_inactivo is null and c0.total_cobrado is null and c0.puntos = 0 and c0.nivel = 'silver'
    and c0.email is null and c0.fecha_nacimiento is null and not c0.es_inactivo and not c0.sin_proxima_cita and not c0.cumple_este_mes and c0.es_nuevo);
  v_out := v_out || pg_temp.chk('cliente INACTIVO: 100 días, sin cita futura', c1.es_inactivo and c1.sin_proxima_cita and c1.dias_inactivo between 99 and 101 and c1.proxima_cita is null, c1.dias_inactivo::text);
  v_out := v_out || pg_temp.chk('cliente con PUNTOS: 900 → nivel gold (umbral central) y VIP', c1.puntos = 900 and c1.nivel = 'gold' and c1.es_vip);
  v_out := v_out || pg_temp.chk('último servicio sale del catálogo (no del texto viejo)', c1.ultimo_servicio = 'ZZ Facial', c1.ultimo_servicio);
  v_out := v_out || pg_temp.chk('con email y cumpleaños este mes', c1.email = 'p1@x.test' and c1.cumple_este_mes);
  v_out := v_out || pg_temp.chk('cliente CON cita futura confirmada: no inactivo', c2.proxima_cita is not null and not c2.es_inactivo and not c2.sin_proxima_cita);
  v_out := v_out || pg_temp.chk('cita futura PENDIENTE también cuenta como cita futura', c4.proxima_cita is not null and not c4.es_inactivo and not c4.sin_proxima_cita);
  v_out := v_out || pg_temp.chk('cliente frecuente: 3 visitas en 90 días', c3.es_frecuente and c3.visitas_completadas = 3 and c3.visitas_90d = 3);
  v_out := v_out || pg_temp.chk('MÚLTIPLES compras: 2 pedidos (cancelado excluido)', c3.pedidos = 2, c3.pedidos::text);
  v_out := v_out || pg_temp.chk('total cobrado: 350 (el pago anulado no cuenta)', c3.total_cobrado = 350, c3.total_cobrado::text);
  v_out := v_out || pg_temp.chk('puntos 100 − canje 50 = 50', c3.puntos = 50);
  v_out := v_out || pg_temp.chk('membresía activa y 1 referido', c3.membresia_activa and c3.referidos = 1);
  v_out := v_out || pg_temp.chk('recuperación: P5 sí · P6 (agendó antes) no · P7 (sin fecha de creación) no · P8 (historial importado) no · P9 (mismo día) sí', (r1->>'recuperados')::int - (r0->>'recuperados')::int = 2);
  v_out := v_out || E'--- CLIENTE 360 ---\n';
  v_out := v_out || pg_temp.chk('360 finanzas: total 350 y 2 cobros', (j3->'finanzas'->>'total_cobrado')::numeric = 350 and (j3->'finanzas'->>'cobros')::int = 2);
  v_out := v_out || pg_temp.chk('360 fidelidad: 50 puntos, 1 canje de 50, membresía "ZZ Membresía"',
    (j3->'fidelidad'->>'puntos')::int = 50 and (j3->'fidelidad'->'canjes'->>'cantidad')::int = 1 and (j3->'fidelidad'->'canjes'->>'puntos')::int = 50 and j3->'fidelidad'->'membresia'->>'nombre' = 'ZZ Membresía');
  v_out := v_out || pg_temp.chk('360 actividad: 3 completadas, 2 pedidos, 2 productos distintos, 1 referido',
    (j3->'actividad'->>'citas_completadas')::int = 3 and (j3->'actividad'->'pedidos'->>'cantidad')::int = 2 and jsonb_array_length(j3->'actividad'->'productos') = 2 and (j3->'actividad'->'referidos'->>'total')::int = 1);
  v_out := v_out || pg_temp.chk('360 cliente vacío: sin última visita, sin membresía, nivel silver',
    j0->'actividad'->>'ultima_visita' is null and jsonb_typeof(j0->'fidelidad'->'membresia') = 'null' and j0->'fidelidad'->>'nivel' = 'silver' and j0->'paciente'->>'email' is null);
  v_out := v_out || pg_temp.chk('línea de tiempo: 13 eventos (3 citas, 2 pagos, 3 pedidos, 2 puntos, referido, membresía, tratamiento)', n_tl = 13, n_tl::text);
  v_out := v_out || pg_temp.chk('línea de tiempo ordenada de más reciente a más antigua', arr = (select array_agg(f order by f desc nulls last) from unnest(arr) f));
  v_out := v_out || E'--- CLIENTE: no entra al CRM ---\n';
  v_out := v_out || pg_temp.chk('cliente NO puede pedir la lista de clientes', e_cli1 = 'No autorizado', e_cli1);
  v_out := v_out || pg_temp.chk('cliente NO puede pedir el resumen del negocio', e_cli2 = 'No autorizado', e_cli2);
  v_out := v_out || pg_temp.chk('cliente NO puede abrir ni su propio Cliente 360 (el CRM es del negocio)', e_cli3 = 'No autorizado', e_cli3);
  v_out := v_out || pg_temp.chk('cliente solo ve SU fila en pacientes', n_cli_pac = 1, n_cli_pac::text);
  v_out := v_out || pg_temp.chk('cliente no puede falsear citas.creada_at (la fija el servidor)', ts_leida is not null and ts_leida > now() - interval '1 minute', coalesce(ts_leida::text, 'null'));
  v_out := v_out || E'--- SUPER ADMIN / ANÓNIMO ---\n';
  v_out := v_out || pg_temp.chk('super admin lee la lista de otra clínica (10 de prueba)', n_sup = 10, n_sup::text);
  v_out := v_out || pg_temp.chk('super admin lee el resumen de otra clínica', (jsup->>'total') is not null);
  v_out := v_out || pg_temp.chk('super admin abre el Cliente 360 de cualquier clínica', n_filas = 1);
  v_out := v_out || pg_temp.chk('anónimo NO puede ejecutar el CRM (permiso denegado 42501)', e_anon = '42501', e_anon);
  v_out := v_out || E'--- REGISTRO / ESQUEMA ---\n';
  v_out := v_out || pg_temp.chk('registro guarda email desde auth + fecha de nacimiento válida', reg1.email = 'reg1@x.test' and reg1.fecha_nacimiento = date '1990-05-17');
  v_out := v_out || pg_temp.chk('fecha de nacimiento inválida o futura no impide el registro (queda null)', reg2.email = 'reg2@x.test' and reg2.fecha_nacimiento is null and reg3.fecha_nacimiento is null);
  v_out := v_out || pg_temp.chk('registro sin fecha de nacimiento: opcional', reg4.email = 'reg4@x.test' and reg4.fecha_nacimiento is null);
  v_out := v_out || pg_temp.chk('cita NO puede apuntar al servicio de otra clínica (FK compuesta)', e_fk = 'bloqueado', e_fk);
  v_out := v_out || pg_temp.chk('cita con servicio propio y cita sin servicio: permitidas', fk_ok);
  v_out := v_out || pg_temp.chk('al borrar un servicio, la cita queda con servicio_id null y conserva su clínica', srv_tras_borrar is null and cl_tras_borrar = v_z);
  v_out := v_out || pg_temp.chk('no se inventó historia: ninguna cita real tiene creada_at anterior a la migración (las citas nuevas sí lo tienen)',
    (select count(*) from citas c where c.creada_at is not null and c.paciente_id not in (p0, p1, p2, p3, p4, p5, p6, p7, p8, p9)
       and c.creada_at < (select to_timestamp(version, 'YYYYMMDDHH24MISS') from supabase_migrations.schema_migrations where name = 'fase_b_crm')) = 0);
  v_out := v_out || pg_temp.chk('umbrales: 799 silver · 800 gold · 3199 gold · 3200 platinum',
    public.nivel_por_puntos(v_z, 799) = 'silver' and public.nivel_por_puntos(v_z, 800) = 'gold' and public.nivel_por_puntos(v_z, 3199) = 'gold' and public.nivel_por_puntos(v_z, 3200) = 'platinum');
  v_out := v_out || pg_temp.chk('umbral inválido (0) rechazado por la base', e_umbral = 'bloqueado', e_umbral);

  raise exception E'RESULTADOS FASE B (todo se revierte)\n%', v_out;
end $$;
