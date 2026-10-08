-- ============================================================
-- PRUEBAS · CICLO CLIENTE (lo que ve y usa el cliente final)
-- Crean datos de prueba y los REVIERTEN solos (error forzado final). Cada línea: OK o FALLA.
-- ============================================================
do $$
declare
  v_adm uuid; v_z uuid; v_sup uuid; v_y uuid;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); uy uuid := gen_random_uuid(); uay uuid := gen_random_uuid();
  p1 uuid; p2 uuid; py uuid; esp_z uuid; esp_y uuid; sv_z uuid; sv_y uuid; pr_z uuid; pr_y uuid; r300 uuid; prod_z uuid; prod_y uuid;
  c_ok uuid; c_far uuid; c_prox uuid; c_promo uuid; c_p2 uuid; c_py uuid; c_pasada text; c_esp_y text; c_conf text; c_comp text; c_otro text; c_clinica_y text; c_promo_y text; c_serv_y text;
  n_cancel bigint; n_conf bigint; n_comp bigint; n_repro bigint; e_borrar text; n_citas_cli bigint; c_nearest uuid; creada timestamptz; hab text;
  est_cli1 text; est_cli2 text; saldo0 bigint; saldo1 bigint; saldo2 bigint; saldo3 bigint; saldo4 bigint; n_adm_cli bigint; n_ay_citas bigint; n_ay_upd bigint; n_pac_adm bigint; n_pac_ay bigint;
  jc jsonb; k uuid; est_k1 text; est_k2 text; n_upd_canje bigint; e_upd_canje text; n_ledger_canje bigint;
  e_ref_ok text; e_ref_rec text; e_ref_otro text; e_ref_ya text; n_ref_cli bigint; n_mov_ref bigint; cod1 text; cod2 text; e_cod2 text;
  e_trat_ok text; e_trat_otro text; n_trat_cli bigint; n_trat_adm bigint; n_trat_ay bigint;
  e_foto_ok text; e_foto_otro text; e_foto_clinica text; n_foto_u2 bigint; n_foto_adm bigint; n_foto_ay bigint;
  n_perf_ok bigint; e_rol text; e_clin text; e_sup text; n_perf_otro bigint; rol_final text; clin_final uuid;
  n_items_y bigint; jp jsonb; n_pagos0 bigint; n_pagos1 bigint; n_mov0 bigint; n_mov1 bigint; est_ped text; met_ped text; e_ped_comp text; e_ped_dir text; jp_y jsonb; n_mis_promos bigint; e_promo_cli text;
  v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;

  select id, clinica_id into v_adm, v_z from perfiles where rol = 'admin' and not es_super_admin limit 1;
  select id, clinica_id into v_sup, v_y from perfiles where es_super_admin limit 1;
  insert into auth.users (id, email, raw_user_meta_data) values (u1, 'zz-c1@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Cliente 1'));
  insert into auth.users (id, email, raw_user_meta_data) values (u2, 'zz-c2@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Cliente 2'));
  insert into auth.users (id, email, raw_user_meta_data) values (uy, 'zz-cy@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Cliente Y'));
  insert into auth.users (id, email, raw_user_meta_data) values (uay, 'zz-ay@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Admin Y'));
  update perfiles set rol = 'admin' where id = uay;
  select id into p1 from pacientes where perfil_id = u1;
  select id into p2 from pacientes where perfil_id = u2;
  select id into py from pacientes where perfil_id = uy;
  insert into especialistas (clinica_id, nombre, especialidad, activo) values (v_z, 'ZZ Esp Z', 'x', true) returning id into esp_z;
  insert into especialistas (clinica_id, nombre, especialidad, activo) values (v_y, 'ZZ Esp Y', 'x', true) returning id into esp_y;
  insert into servicios (clinica_id, nombre, precio, puntos_otorga) values (v_z, 'ZZ Servicio Z', 500, 100) returning id into sv_z;
  insert into servicios (clinica_id, nombre, precio) values (v_y, 'ZZ Servicio Y', 500) returning id into sv_y;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'ZZ Promo Z', 10, 'todos', current_date - 1, current_date + 20, 'activa') returning id into pr_z;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_y, 'ZZ Promo Y', 10, 'todos', current_date - 1, current_date + 20, 'activa') returning id into pr_y;
  insert into recompensas (clinica_id, nombre, costo_puntos, valor_descuento) values (v_z, 'ZZ L100', 300, 100) returning id into r300;
  insert into productos (clinica_id, nombre, categoria, precio, puntos_otorga) values (v_z, 'ZZ Crema', 'cremas', 250, 10) returning id into prod_z;
  insert into productos (clinica_id, nombre, categoria, precio) values (v_y, 'ZZ Crema Y', 'cremas', 100) returning id into prod_y;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo) values (v_z, p1, 'acumulacion', 2000, 'fixture');
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (v_z, p2, now() + interval '4 days', 'pendiente', 'ZZ cita de p2') returning id into c_p2;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (v_y, py, now() + interval '4 days', 'pendiente', 'ZZ cita de py') returning id into c_py;
  insert into referidos (clinica_id, paciente_referidor_id, telefono_referido, estado, codigo) values (v_z, p2, '+504 1111-1111', 'invitado', 'ZZ-P2');
  insert into tratamientos_paciente (clinica_id, paciente_id, procedimiento) values (v_z, p2, 'ZZ progreso de p2');
  insert into storage.objects (bucket_id, name, owner) values ('fotos-tratamientos', v_z::text || '/' || p2::text || '/ajena.jpg', u2);
  select coalesce(sum(puntos), 0) into saldo0 from puntos_movimientos where paciente_id = p1;
  select count(*) into n_pagos0 from pagos where clinica_id = v_z;
  select count(*) into n_mov0 from puntos_movimientos where paciente_id = p1;

  -- ================= CLIENTE 1: solicitar citas =================
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  insert into citas (clinica_id, paciente_id, especialista_id, servicio_id, fecha_hora, estado, tratamiento) values (v_z, p1, esp_z, sv_z, now() + interval '3 days', 'pendiente', 'ZZ Servicio Z') returning id, creada_at into c_ok, creada;
  insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p1, esp_z, now() + interval '9 days', 'pendiente') returning id into c_far;
  insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p1, esp_z, now() + interval '1 day', 'pendiente') returning id into c_prox;
  insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado, promocion_id) values (v_z, p1, esp_z, now() + interval '6 days', 'pendiente', pr_z) returning id into c_promo;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p1, esp_z, now() - interval '2 hours', 'pendiente'); c_pasada := 'PERMITIDO'; exception when others then c_pasada := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p1, esp_y, now() + interval '2 days', 'pendiente'); c_esp_y := 'PERMITIDO'; exception when others then c_esp_y := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p1, esp_z, now() + interval '2 days', 'confirmada'); c_conf := 'PERMITIDO'; exception when others then c_conf := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p1, esp_z, now() + interval '2 days', 'completada'); c_comp := 'PERMITIDO'; exception when others then c_comp := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado) values (v_z, p2, esp_z, now() + interval '2 days', 'pendiente'); c_otro := 'PERMITIDO'; exception when others then c_otro := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, fecha_hora, estado) values (v_y, p1, now() + interval '2 days', 'pendiente'); c_clinica_y := 'PERMITIDO'; exception when others then c_clinica_y := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado, promocion_id) values (v_z, p1, esp_z, now() + interval '7 days', 'pendiente', pr_y); c_promo_y := 'PERMITIDO'; exception when others then c_promo_y := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, especialista_id, fecha_hora, estado, servicio_id) values (v_z, p1, esp_z, now() + interval '7 days', 'pendiente', sv_y); c_serv_y := 'PERMITIDO'; exception when others then c_serv_y := sqlstate; end;
  update citas set estado = 'cancelada' where id = c_ok; get diagnostics n_cancel = row_count;
  update citas set estado = 'confirmada' where id = c_ok; get diagnostics n_conf = row_count;
  update citas set estado = 'completada' where id = c_ok; get diagnostics n_comp = row_count;
  update citas set fecha_hora = now() + interval '20 days' where id = c_ok; get diagnostics n_repro = row_count;
  begin delete from citas where id = c_ok; e_borrar := 'sin error'; exception when others then e_borrar := sqlstate; end;
  select count(*) into n_citas_cli from citas;
  select id into c_nearest from citas where paciente_id = p1 and estado in ('pendiente', 'confirmada') and fecha_hora >= now() order by fecha_hora asc limit 1;
  select estado into est_cli1 from citas where id = c_ok;
  reset role;

  -- ================= NEGOCIO: confirma y completa; el cliente lo ve =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select count(*) into n_adm_cli from citas where paciente_id = p1;
  update citas set estado = 'confirmada' where id = c_ok;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  select estado into est_cli2 from citas where id = c_ok;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  update citas set estado = 'completada' where id = c_ok;
  select count(*) into n_pac_adm from pacientes where id = p1;
  reset role;
  select coalesce(sum(puntos), 0) into saldo1 from puntos_movimientos where paciente_id = p1;
  select estado into hab from citas where id = c_ok;

  -- ================= OTRA CLÍNICA: no ve ni toca citas ajenas; el QR de un cliente no se resuelve =================
  perform set_config('request.jwt.claims', json_build_object('sub', uay, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uay::text, true);
  set local role authenticated;
  select count(*) into n_ay_citas from citas where clinica_id = v_z;
  update citas set estado = 'cancelada' where id = c_p2; get diagnostics n_ay_upd = row_count;
  select count(*) into n_pac_ay from pacientes where id = p1;
  select count(*) into n_trat_ay from tratamientos_paciente where clinica_id = v_z;
  select count(*) into n_foto_ay from storage.objects where bucket_id = 'fotos-tratamientos' and name like v_z::text || '/%';
  reset role;

  -- ================= CLIENTE 1: canje y su cancelación =================
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  jc := public.solicitar_canje(r300); k := (jc->>'canje_id')::uuid;
  select coalesce(sum(puntos), 0) into saldo2 from puntos_movimientos where paciente_id = p1;
  select estado into est_k1 from canjes where id = k;
  select count(*) into n_ledger_canje from puntos_movimientos where canje_id = k and puntos = -300;
  begin update canjes set estado = 'aplicado' where id = k; get diagnostics n_upd_canje = row_count; e_upd_canje := 'sin error'; exception when others then n_upd_canje := 0; e_upd_canje := sqlstate; end;
  perform public.cancelar_canje(k);
  select coalesce(sum(puntos), 0) into saldo3 from puntos_movimientos where paciente_id = p1;
  select estado into est_k2 from canjes where id = k;
  reset role;

  -- ================= CLIENTE 1: referidos =================
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  cod1 := public.generar_codigo_referido(p1);
  begin insert into referidos (clinica_id, paciente_referidor_id, telefono_referido, codigo, estado) values (v_z, p1, '+504 2222-2222', cod1, 'invitado'); e_ref_ok := 'ok'; exception when others then e_ref_ok := sqlstate; end;
  begin insert into referidos (clinica_id, paciente_referidor_id, telefono_referido, codigo, estado) values (v_z, p1, '+504 3333-3333', cod1, 'recompensado'); e_ref_rec := 'PERMITIDO'; exception when others then e_ref_rec := sqlstate; end;
  begin insert into referidos (clinica_id, paciente_referidor_id, telefono_referido, codigo, estado) values (v_z, p2, '+504 4444-4444', 'X', 'invitado'); e_ref_otro := 'PERMITIDO'; exception when others then e_ref_otro := sqlstate; end;
  begin insert into referidos (clinica_id, paciente_referidor_id, telefono_referido, codigo, estado, paciente_referido_id) values (v_z, p1, '+504 5555-5555', cod1, 'invitado', p2); e_ref_ya := 'PERMITIDO'; exception when others then e_ref_ya := sqlstate; end;
  select count(*) into n_ref_cli from referidos;
  begin cod2 := public.generar_codigo_referido(p2); e_cod2 := 'devolvió ' || coalesce(cod2, 'null'); exception when others then e_cod2 := 'error ' || sqlstate; end;
  reset role;
  select count(*) into n_mov_ref from puntos_movimientos where paciente_id = p1 and (origen_tipo = 'referido' or motivo ilike '%referid%');

  -- ================= CLIENTE 1: historial / progreso y fotos =================
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  begin insert into tratamientos_paciente (clinica_id, paciente_id, procedimiento) values (v_z, p1, 'Registro de progreso'); e_trat_ok := 'ok'; exception when others then e_trat_ok := sqlstate; end;
  begin insert into tratamientos_paciente (clinica_id, paciente_id, procedimiento) values (v_z, p2, 'hack'); e_trat_otro := 'PERMITIDO'; exception when others then e_trat_otro := sqlstate; end;
  select count(*) into n_trat_cli from tratamientos_paciente;
  begin insert into storage.objects (bucket_id, name, owner) values ('fotos-tratamientos', v_z::text || '/' || p1::text || '/propia.jpg', u1); e_foto_ok := 'ok'; exception when others then e_foto_ok := sqlstate; end;
  begin insert into storage.objects (bucket_id, name, owner) values ('fotos-tratamientos', v_z::text || '/' || p2::text || '/hack.jpg', u1); e_foto_otro := 'PERMITIDO'; exception when others then e_foto_otro := sqlstate; end;
  begin insert into storage.objects (bucket_id, name, owner) values ('fotos-tratamientos', v_y::text || '/' || py::text || '/hack.jpg', u1); e_foto_clinica := 'PERMITIDO'; exception when others then e_foto_clinica := sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u2::text, true);
  set local role authenticated;
  select count(*) into n_foto_u2 from storage.objects where bucket_id = 'fotos-tratamientos' and name like '%/' || p1::text || '/%';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select count(*) into n_foto_adm from storage.objects where bucket_id = 'fotos-tratamientos' and name like '%/' || p1::text || '/%';
  select count(*) into n_trat_adm from tratamientos_paciente where paciente_id = p1;
  reset role;

  -- ================= CLIENTE 1: perfil y preferencias =================
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  update perfiles set promociones_ofertas = false, recordatorios_citas = false, compartir_fotos_progreso = true where id = u1; get diagnostics n_perf_ok = row_count;
  begin update perfiles set rol = 'admin' where id = u1; e_rol := 'sin error'; exception when others then e_rol := sqlstate; end;
  begin update perfiles set clinica_id = v_y where id = u1; e_clin := 'sin error'; exception when others then e_clin := sqlstate; end;
  begin update perfiles set es_super_admin = true where id = u1; e_sup := 'sin error'; exception when others then e_sup := sqlstate; end;
  update perfiles set nombre = 'hack' where id = u2; get diagnostics n_perf_otro = row_count;
  select count(*) into n_mis_promos from public.mis_promociones();
  begin perform public.promociones_resumen(); e_promo_cli := 'PERMITIDO'; exception when others then e_promo_cli := sqlerrm; end;
  reset role;
  select rol, clinica_id into rol_final, clin_final from perfiles where id = u1;

  -- ================= CLIENTE 1: tienda =================
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;
  jp := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', prod_z, 'cantidad', 2)), 'domicilio');
  select estado, metodo_pago into est_ped, met_ped from pedidos where id = (jp->>'pedido_id')::uuid;
  begin perform public.completar_pedido((jp->>'pedido_id')::uuid); e_ped_comp := 'PERMITIDO'; exception when others then e_ped_comp := sqlerrm; end;
  begin insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado) values (v_z, p1, 1, 'wallet', 'domicilio', 'entregado'); e_ped_dir := 'PERMITIDO'; exception when others then e_ped_dir := sqlstate; end;
  begin jp_y := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', prod_y, 'cantidad', 1)), 'domicilio'); exception when others then jp_y := jsonb_build_object('error', sqlerrm); end;
  reset role;
  select count(*) into n_pagos1 from pagos where clinica_id = v_z;
  select count(*) into n_items_y from pedido_items where producto_id = prod_y;
  select count(*) into n_mov1 from puntos_movimientos where paciente_id = p1 and (origen_tipo = 'pedido');

  v_out := E'--- SOLICITAR UNA CITA ---\n';
  v_out := v_out || pg_temp.chk('el cliente SOLICITA: queda PENDIENTE, a su nombre y en su clínica, con la fecha de creación fijada por el servidor', c_ok is not null and est_cli1 = 'pendiente' and creada > now() - interval '1 minute');
  v_out := v_out || pg_temp.chk('NO puede solicitar una fecha pasada (antes sí podía)', c_pasada = '42501', c_pasada);
  v_out := v_out || pg_temp.chk('NO puede apuntar la cita a un especialista de OTRA clínica (antes sí podía)', c_esp_y = '42501', c_esp_y);
  v_out := v_out || pg_temp.chk('NO puede crear una cita ya confirmada ni completada', c_conf = '42501' and c_comp = '42501', c_conf || '/' || c_comp);
  v_out := v_out || pg_temp.chk('NO puede solicitar a nombre de otra persona ni en otra clínica', c_otro = '42501' and c_clinica_y = '42501', c_otro || '/' || c_clinica_y);
  v_out := v_out || pg_temp.chk('promoción → reserva: acepta la promoción de su negocio y rechaza la de otra clínica; igual con el servicio', c_promo is not null and c_promo_y = '23503' and c_serv_y = '23503', c_promo_y || '/' || c_serv_y);
  v_out := v_out || E'--- ESTADOS: el cliente solicita; el negocio confirma y completa ---\n';
  v_out := v_out || pg_temp.chk('el cliente NO puede cancelar, confirmar, completar ni reprogramar (0 filas) ni borrar su cita', n_cancel = 0 and n_conf = 0 and n_comp = 0 and n_repro = 0 and e_borrar in ('42501', 'sin error') and est_cli1 = 'pendiente', n_cancel || '/' || n_conf || '/' || n_comp || '/' || n_repro || '/' || e_borrar);
  v_out := v_out || pg_temp.chk('el negocio ve las 4 solicitudes del cliente y las confirma; el cliente ve «confirmada»', n_adm_cli = 4 and est_cli2 = 'confirmada', n_adm_cli || '/' || est_cli2);
  v_out := v_out || pg_temp.chk('el negocio la completa: el cliente ve «completada» y recibe los puntos del servicio (+100)', hab = 'completada' and saldo1 = saldo0 + 100, hab || ' · ' || saldo0 || ' → ' || saldo1);
  v_out := v_out || pg_temp.chk('Home: la próxima cita es la más cercana entre pendientes y confirmadas', c_nearest = c_prox);
  v_out := v_out || pg_temp.chk('el cliente ve solo SUS 4 citas (no las de otro cliente ni de otra clínica)', n_citas_cli = 4, n_citas_cli::text);
  v_out := v_out || E'--- AISLAMIENTO ENTRE CLÍNICAS ---\n';
  v_out := v_out || pg_temp.chk('un admin de OTRA clínica no ve ni cambia citas ajenas, ni resuelve el QR (cliente) de otro negocio', n_ay_citas = 0 and n_ay_upd = 0 and n_pac_ay = 0 and n_pac_adm = 1, n_ay_citas || '/' || n_ay_upd || '/' || n_pac_ay || '/' || n_pac_adm);
  v_out := v_out || E'--- PUNTOS, CANJE y CANCELACIÓN ---\n';
  v_out := v_out || pg_temp.chk('solicitar canje: queda PENDIENTE y reserva los puntos con un movimiento ligado al canje (−300)', est_k1 = 'pendiente' and saldo2 = saldo1 - 300 and n_ledger_canje = 1, saldo1 || ' → ' || saldo2);
  v_out := v_out || pg_temp.chk('el cliente NO puede aprobar su propio canje', n_upd_canje = 0, n_upd_canje || '/' || e_upd_canje);
  v_out := v_out || pg_temp.chk('cancelar el canje devuelve los puntos y el estado pasa a «cancelado»', est_k2 = 'cancelado' and saldo3 = saldo1, saldo2 || ' → ' || saldo3);
  v_out := v_out || E'--- REFERIDOS ---\n';
  v_out := v_out || pg_temp.chk('el cliente registra su invitación («invitado») y ve solo las suyas', e_ref_ok = 'ok' and n_ref_cli = 1, e_ref_ok || '/' || n_ref_cli);
  v_out := v_out || pg_temp.chk('NO puede registrarse como «recompensado», ni invitar a nombre de otro, ni marcar un referido ya registrado', e_ref_rec = '42501' and e_ref_otro = '42501' and e_ref_ya = '42501', e_ref_rec || '/' || e_ref_otro || '/' || e_ref_ya);
  v_out := v_out || pg_temp.chk('el servidor NO otorga puntos por referidos (por eso la app ya no promete 500 puntos, 20 % ni limpieza gratis)', n_mov_ref = 0);
  v_out := v_out || pg_temp.chk('el código de referido de OTRA persona no se genera para el cliente', e_cod2 not like 'devolvió %' or cod2 is null, e_cod2);
  v_out := v_out || E'--- HISTORIAL / PROGRESO y FOTOS ---\n';
  v_out := v_out || pg_temp.chk('el cliente agrega su progreso y ve solo el suyo; no puede escribir en el de otra persona', e_trat_ok = 'ok' and e_trat_otro = '42501' and n_trat_cli = 1, e_trat_ok || '/' || e_trat_otro || '/' || n_trat_cli);
  v_out := v_out || pg_temp.chk('el negocio ve el progreso del cliente; el de otra clínica no', n_trat_adm = 1 and n_trat_ay = 0, n_trat_adm || '/' || n_trat_ay);
  v_out := v_out || pg_temp.chk('fotos privadas: sube en SU carpeta; no en la de otra persona ni en la de otra clínica', e_foto_ok = 'ok' and e_foto_otro = '42501' and e_foto_clinica = '42501', e_foto_ok || '/' || e_foto_otro || '/' || e_foto_clinica);
  v_out := v_out || pg_temp.chk('fotos privadas: otro cliente no ve las del primero; el negocio sí; otra clínica no ve ninguna', n_foto_u2 = 0 and n_foto_adm = 1 and n_foto_ay = 0, n_foto_u2 || '/' || n_foto_adm || '/' || n_foto_ay);
  v_out := v_out || E'--- PERFIL / PREFERENCIAS ---\n';
  v_out := v_out || pg_temp.chk('el cliente cambia sus 3 preferencias (1 fila)', n_perf_ok = 1);
  v_out := v_out || pg_temp.chk('NO puede darse rol de administrador, cambiarse de clínica ni hacerse super admin; ni editar a otra persona', rol_final = 'paciente' and clin_final = v_z and n_perf_otro = 0, rol_final || ' · ' || e_rol || '/' || e_clin || '/' || e_sup);
  v_out := v_out || pg_temp.chk('promociones: el cliente consulta las suyas y no ve la gestión del negocio', n_mis_promos >= 1 and e_promo_cli = 'No autorizado', n_mis_promos || '/' || e_promo_cli);
  v_out := v_out || E'--- TIENDA ---\n';
  v_out := v_out || pg_temp.chk('el pedido nace PENDIENTE (no confirmado), sin cobro: no crea pagos ni otorga puntos', est_ped = 'pendiente' and n_pagos1 = n_pagos0 and n_mov1 = 0, est_ped || ' · pagos ' || n_pagos0 || '→' || n_pagos1);
  v_out := v_out || pg_temp.chk('el cliente NO puede entregar su pedido ni crear pedidos «entregados» a mano', e_ped_comp = 'No autorizado' and e_ped_dir = '42501', e_ped_comp || '/' || e_ped_dir);
  v_out := v_out || pg_temp.chk('no puede pedir productos de otra clínica', n_items_y = 0, coalesce(jp_y::text, 'null'));

  raise exception E'RESULTADOS CICLO CLIENTE (todo se revierte)\n%', v_out;
end $$;
