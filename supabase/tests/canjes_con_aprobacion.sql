-- ============================================================
-- PRUEBAS · CANJES CON APROBACIÓN Y DESCUENTO EN CAJA
-- Crean datos de prueba y los REVIERTEN solos (error forzado final). Cada línea: OK o FALLA.
-- ============================================================
do $$
declare
  v_adm uuid; v_z uuid; v_sup uuid; v_y uuid; v_u1 uuid := gen_random_uuid(); v_u2 uuid := gen_random_uuid();
  v_pac1 uuid; v_pac2 uuid; r300 uuid; r800 uuid; rinact uuid; rotra uuid; k_otra uuid;
  j jsonb; jb jsonb; saldo0 bigint; saldo1 bigint; saldo2 bigint; saldo3 bigint; saldo4 bigint; saldo5 bigint;
  k1 uuid; k2 uuid; k3 uuid; k4 uuid; k5 uuid; cod1 text; cod2 text; fila1 canjes%rowtype; filak2 canjes%rowtype; pg pagos%rowtype;
  jap jsonb; jgratis jsonb; jrech jsonb; e_chk text;
  e1 text; e2 text; e3 text; e4 text; e5 text; e6 text; e7 text; e8 text; e9 text; e10 text; e_anon text;
  n_ve_cli int; n_pend_adm int; n_otra_adm int; n_ledger int; n_ref int; j360 jsonb;
  suma_monto numeric; suma_desc numeric; n_mov_cancel int; n_mov_rech int;
  v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;

  -- ---------- actores y datos de prueba ----------
  -- Clínica y admin de prueba propios (nunca un negocio real); se revierten con el resto.
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Clínica Prueba', 'HN', 'zz-prueba-' || substr(gen_random_uuid()::text, 1, 8), 'HNL') returning id into v_z;
  v_adm := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (v_adm, 'zz-adm-z@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Admin Z'));
  update perfiles set rol = 'admin' where id = v_adm;
  select id, clinica_id into v_sup, v_y from perfiles where es_super_admin limit 1;   -- admin de OTRA clínica (y super admin)
  insert into auth.users (id, email, raw_user_meta_data) values (v_u1, 'zz-c1@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Cliente 1'));
  insert into auth.users (id, email, raw_user_meta_data) values (v_u2, 'zz-c2@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Cliente 2'));
  select id into v_pac1 from pacientes where perfil_id = v_u1;
  select id into v_pac2 from pacientes where perfil_id = v_u2;
  insert into recompensas (clinica_id, nombre, costo_puntos, valor_descuento) values (v_z, 'ZZ L100', 300, 100) returning id into r300;
  insert into recompensas (clinica_id, nombre, costo_puntos) values (v_z, 'ZZ Servicio gratis', 800) returning id into r800;
  insert into recompensas (clinica_id, nombre, costo_puntos, activa) values (v_z, 'ZZ Inactiva', 100, false) returning id into rinact;
  insert into recompensas (clinica_id, nombre, costo_puntos) values (v_y, 'ZZ De otra clínica', 100) returning id into rotra;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo) values (v_z, v_pac1, 'acumulacion', 2000, 'fixture');
  select coalesce(sum(puntos), 0) into saldo0 from puntos_movimientos where paciente_id = v_pac1;

  -- ================= CLIENTE 1 =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  set local role authenticated;
  j := public.solicitar_canje(r300);                       -- K1
  k1 := (j->>'canje_id')::uuid; cod1 := j->>'codigo';
  select coalesce(sum(puntos), 0) into saldo1 from puntos_movimientos where paciente_id = v_pac1;
  select * into fila1 from canjes where id = k1;
  select count(*) into n_ledger from puntos_movimientos where canje_id = k1 and tipo = 'canje' and puntos = -300;
  jb := public.solicitar_canje(r300); k2 := (jb->>'canje_id')::uuid; cod2 := jb->>'codigo';   -- K2 (se aprobará)
  jb := public.solicitar_canje(r300); k3 := (jb->>'canje_id')::uuid;                          -- K3 (validaciones y servicio gratis)
  jb := public.solicitar_canje(r300); k4 := (jb->>'canje_id')::uuid;                          -- K4 (se rechazará)
  jb := public.solicitar_canje(r300); k5 := (jb->>'canje_id')::uuid;                          -- K5 (prueba otra clínica)
  select coalesce(sum(puntos), 0) into saldo2 from puntos_movimientos where paciente_id = v_pac1;   -- 2000 - 5*300 = 500
  j := public.solicitar_canje(r800);                       -- 500 < 800
  e1 := j->>'resultado';
  j := public.solicitar_canje(rinact);  e2 := j->>'resultado';
  j := public.solicitar_canje(rotra);   e3 := j->>'resultado';
  begin insert into canjes (clinica_id, paciente_id, recompensa_nombre, puntos, codigo) values (v_z, v_pac1, 'x', 1, 'HACK1'); e4 := 'PERMITIDO'; exception when others then e4 := sqlstate; end;
  begin update canjes set estado = 'aplicado', fecha_resolucion = now() where id = k2; e5 := 'PERMITIDO'; exception when others then e5 := sqlstate; end;
  begin perform public.rechazar_canje(k2, 'x'); e6 := 'PERMITIDO'; exception when others then e6 := sqlerrm; end;
  begin perform public.aplicar_canje(k2, 100, 50, 'servicio', 'efectivo', 'x'); e7 := 'PERMITIDO'; exception when others then e7 := sqlerrm; end;
  select count(*) into n_ve_cli from canjes;                       -- solo los suyos (5), no los de otra clínica
  j := public.cancelar_canje(k1);                          -- cancela K1: devuelve 300
  select coalesce(sum(puntos), 0) into saldo3 from puntos_movimientos where paciente_id = v_pac1;
  select count(*) into n_mov_cancel from puntos_movimientos where canje_id = k1 and tipo = 'ajuste' and puntos = 300;
  jb := public.cancelar_canje(k1); e8 := jb->>'resultado';  -- segunda vez
  reset role;

  -- ---------- cliente 2 intenta cancelar el canje de otro ----------
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  set local role authenticated;
  jb := public.cancelar_canje(k2); e9 := jb->>'resultado';
  reset role;

  -- ---------- un canje pendiente en OTRA clínica (fixture) ----------
  insert into canjes (clinica_id, paciente_id, recompensa_nombre, puntos, codigo)
    select v_y, id, 'ZZ otra', 100, 'OTRA1' from pacientes where clinica_id = v_y limit 1 returning id into k_otra;

  -- ================= ADMIN (su clínica) =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select count(*) into n_pend_adm from canjes where estado = 'pendiente' and recompensa_nombre like 'ZZ%' and clinica_id = v_z;
  select count(*) into n_otra_adm from canjes where id = k_otra;
  jap := public.aplicar_canje(k2, 400, 100, 'servicio', 'efectivo', 'Limpieza facial');    -- aprueba K2
  select * into filak2 from canjes where id = k2;
  select * into pg from pagos where canje_id = k2;
  jb := public.aplicar_canje(k2, 400, 100, 'servicio', 'efectivo', 'Limpieza facial'); e10 := jb->>'resultado';   -- ya resuelto
  -- validaciones sobre K3 (debe seguir pendiente)
  perform set_config('app.v1', (public.aplicar_canje(k3, 400, 150, 'servicio', 'efectivo', 'Peeling'))->>'resultado', true);   -- excede recompensa (100)
  perform set_config('app.v2', (public.aplicar_canje(k3, 50, 60, 'servicio', 'efectivo', 'Peeling'))->>'resultado', true);     -- descuento > bruto
  perform set_config('app.v3', (public.aplicar_canje(k3, 400, 0, 'servicio', 'efectivo', 'Peeling'))->>'resultado', true);     -- descuento 0
  perform set_config('app.v4', (public.aplicar_canje(k3, 0, 10, 'servicio', 'efectivo', 'Peeling'))->>'resultado', true);      -- bruto 0
  perform set_config('app.v5', (public.aplicar_canje(k3, 400, 100, 'servicio', 'efectivo', '   '))->>'resultado', true);       -- sin concepto
  perform set_config('app.v6', (public.aplicar_canje(k3, 400, 100, 'servicio', 'bitcoin', 'Peeling'))->>'resultado', true);    -- método inválido
  -- servicio 100 % canjeado: bruto = descuento → se cobra 0
  jgratis := public.aplicar_canje(k3, 100, 100, 'servicio', 'efectivo', 'Mini facial');
  -- rechazar
  perform set_config('app.r1', (public.rechazar_canje(k4, '   '))->>'resultado', true);                                           -- sin motivo
  jrech := public.rechazar_canje(k4, 'Cliente no se presentó');
  select coalesce(sum(puntos), 0) into saldo4 from puntos_movimientos where paciente_id = v_pac1;
  select count(*) into n_mov_rech from puntos_movimientos where canje_id = k4 and tipo = 'ajuste' and puntos = 300 and motivo like '%Cliente no se presentó%';
  perform set_config('app.r2', (public.rechazar_canje(k4, 'otra vez'))->>'resultado', true);                                     -- ya resuelto
  -- Caja: cobro manual normal sigue funcionando; descuento directo NO
  begin insert into pagos (clinica_id, concepto, tipo, monto, metodo_pago, direccion, registrado_por) values (v_z, 'ZZ cobro manual', 'servicio', 50, 'efectivo', 'ingreso', v_adm); perform set_config('app.m1', 'OK', true);
  exception when others then perform set_config('app.m1', sqlerrm, true); end;
  begin insert into pagos (clinica_id, concepto, tipo, monto, metodo_pago, direccion, registrado_por, descuento) values (v_z, 'ZZ hack', 'servicio', 50, 'efectivo', 'ingreso', v_adm, 40); perform set_config('app.m2', 'PERMITIDO', true);
  exception when others then perform set_config('app.m2', sqlstate, true); end;
  begin insert into pagos (clinica_id, concepto, tipo, monto, metodo_pago, direccion, registrado_por, canje_id) values (v_z, 'ZZ hack2', 'servicio', 50, 'efectivo', 'ingreso', v_adm, k5); perform set_config('app.m3', 'PERMITIDO', true);
  exception when others then perform set_config('app.m3', sqlstate, true); end;
  select coalesce(sum(monto), 0), coalesce(sum(descuento), 0) into suma_monto, suma_desc
    from pagos where clinica_id = v_z and canje_id in (k2, k3) and direccion = 'ingreso' and anulado_at is null;
  j360 := public.crm_cliente_360(v_pac1);
  reset role;

  -- ================= ADMIN DE OTRA CLÍNICA (aunque sea super admin) =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated;
  perform set_config('app.o1', (public.aplicar_canje(k5, 400, 100, 'servicio', 'efectivo', 'x'))->>'resultado', true);
  perform set_config('app.o2', (public.rechazar_canje(k5, 'x'))->>'resultado', true);
  reset role;

  -- ================= ANÓNIMO =================
  set local role anon;
  begin perform public.solicitar_canje(r300); e_anon := 'PERMITIDO'; exception when others then e_anon := sqlstate; end;
  reset role;
  begin insert into pagos (clinica_id, concepto, tipo, monto, metodo_pago, direccion, descuento) values (v_z, 'ZZ sin canje', 'servicio', 10, 'efectivo', 'ingreso', 5); e_chk := 'PERMITIDO';
  exception when check_violation then e_chk := 'bloqueado'; end;
  select coalesce(sum(puntos), 0) into saldo5 from puntos_movimientos where paciente_id = v_pac1;

  -- ================= EVALUACIÓN =================
  v_out := E'--- CLIENTE: solicitar y cancelar ---\n';
  v_out := v_out || pg_temp.chk('solicitar: queda PENDIENTE con código de 5 caracteres', fila1.estado = 'pendiente' and fila1.puntos = 300 and fila1.valor_descuento = 100 and cod1 ~ '^[A-HJ-NP-Z2-9]{5}$', cod1);
  v_out := v_out || pg_temp.chk('solicitar: los puntos se reservan (2000 → 1700) y queda un movimiento ligado al canje', saldo1 = saldo0 - 300 and n_ledger = 1, saldo1::text);
  v_out := v_out || pg_temp.chk('5 solicitudes seguidas reservan 1500 (saldo 500)', saldo2 = 500, saldo2::text);
  v_out := v_out || pg_temp.chk('sin puntos suficientes (500 < 800): puntos_insuficientes', e1 = 'puntos_insuficientes', coalesce(e1, 'null'));
  v_out := v_out || pg_temp.chk('recompensa inactiva o de otra clínica: no_disponible', e2 = 'no_disponible' and e3 = 'no_disponible');
  v_out := v_out || pg_temp.chk('el cliente NO puede insertar ni modificar canjes directamente', e4 = '42501' and e5 = '42501', e4 || '/' || e5);
  v_out := v_out || pg_temp.chk('el cliente NO puede rechazar ni aprobar canjes', e6 = 'No autorizado' and e7 = 'No autorizado', e6 || '/' || e7);
  v_out := v_out || pg_temp.chk('el cliente ve solo sus 5 canjes', n_ve_cli = 5, n_ve_cli::text);
  v_out := v_out || pg_temp.chk('cancelar: devuelve los 300 puntos con un movimiento ligado al canje', saldo3 = saldo2 + 300 and n_mov_cancel = 1, saldo3::text);
  v_out := v_out || pg_temp.chk('cancelar dos veces: ya_resuelto', e8 = 'ya_resuelto');
  v_out := v_out || pg_temp.chk('otro cliente NO puede cancelar un canje ajeno', e9 = 'no_encontrado', e9);
  v_out := v_out || E'--- NEGOCIO: aprobar y aplicar en Caja ---\n';
  v_out := v_out || pg_temp.chk('el admin ve las solicitudes pendientes de su clínica (4) y ninguna de otra clínica', n_pend_adm = 4 and n_otra_adm = 0, n_pend_adm || '/' || n_otra_adm);
  v_out := v_out || pg_temp.chk('aprobar: ok y cobra bruto − descuento (400 − 100 = 300)', jap->>'resultado' = 'ok' and (jap->>'cobrado')::numeric = 300, jap::text);
  v_out := v_out || pg_temp.chk('el cobro queda con monto 300, descuento 100, ligado al canje y con el código en el concepto', pg.monto = 300 and pg.descuento = 100 and pg.canje_id = k2 and pg.concepto like '%Limpieza facial%' and pg.concepto like '%' || cod2 || '%', pg.concepto);
  v_out := v_out || pg_temp.chk('el canje queda APLICADO, con quién lo resolvió, cuándo y su cobro', filak2.estado = 'aplicado' and filak2.resuelto_por = v_adm and filak2.fecha_resolucion is not null and filak2.pago_id = pg.id and filak2.descuento_aplicado = 100);
  v_out := v_out || pg_temp.chk('aprobar dos veces: ya_resuelto (no duplica el cobro)', e10 = 'ya_resuelto');
  v_out := v_out || pg_temp.chk('descuento mayor al valor de la recompensa: rechazado', current_setting('app.v1') = 'descuento_excede_recompensa', current_setting('app.v1'));
  v_out := v_out || pg_temp.chk('descuento mayor al monto, descuento 0, monto 0: rechazados', current_setting('app.v2') = 'descuento_invalido' and current_setting('app.v3') = 'descuento_invalido' and current_setting('app.v4') = 'monto_invalido');
  v_out := v_out || pg_temp.chk('sin concepto (justificación) o con método de pago inválido: rechazados', current_setting('app.v5') = 'concepto_requerido' and current_setting('app.v6') = 'datos_invalidos');
  v_out := v_out || pg_temp.chk('servicio 100 % canjeado: se cobra 0', jgratis->>'resultado' = 'ok' and (jgratis->>'cobrado')::numeric = 0, jgratis::text);
  v_out := v_out || pg_temp.chk('rechazar exige motivo', current_setting('app.r1') = 'motivo_requerido');
  v_out := v_out || pg_temp.chk('rechazar: devuelve los 300 puntos (800 → 1100) con un movimiento que incluye el motivo', jrech->>'resultado' = 'ok' and (jrech->>'puntos_devueltos')::int = 300 and n_mov_rech = 1 and saldo4 = saldo3 + 300, saldo3 || ' → ' || saldo4);
  v_out := v_out || pg_temp.chk('rechazar dos veces: ya_resuelto', current_setting('app.r2') = 'ya_resuelto');
  v_out := v_out || E'--- CAJA: el descuento no se puede inventar y la matemática cuadra ---\n';
  v_out := v_out || pg_temp.chk('el cobro manual normal de Caja sigue funcionando', current_setting('app.m1') = 'OK', current_setting('app.m1'));
  v_out := v_out || pg_temp.chk('el admin NO puede escribir un descuento directo en pagos', current_setting('app.m2') = '42501', current_setting('app.m2'));
  v_out := v_out || pg_temp.chk('el admin NO puede ligar un cobro a un canje por su cuenta', current_setting('app.m3') = '42501', current_setting('app.m3'));
  v_out := v_out || pg_temp.chk('la base rechaza un descuento sin canje (restricción)', e_chk = 'bloqueado', e_chk);
  v_out := v_out || pg_temp.chk('Caja: suma de lo cobrado = 300 + 0 y descuentos = 100 + 100', suma_monto = 300 and suma_desc = 200, suma_monto || '/' || suma_desc);
  v_out := v_out || E'--- CLIENTE 360 y SEGURIDAD ---\n';
  v_out := v_out || pg_temp.chk('360: recompensas canjeadas = 2 aplicadas (600 pts); cancelado, rechazado y pendiente no cuentan', (j360->'fidelidad'->'canjes'->>'cantidad')::int = 2 and (j360->'fidelidad'->'canjes'->>'puntos')::int = 600, (j360->'fidelidad'->'canjes')::text);
  v_out := v_out || pg_temp.chk('360: 1 canje pendiente (K5) mostrado aparte', (j360->'fidelidad'->'canjes'->>'pendientes')::int = 1);
  v_out := v_out || pg_temp.chk('admin de OTRA clínica (aunque sea super admin) NO puede aprobar ni rechazar canjes ajenos', current_setting('app.o1') = 'no_encontrado' and current_setting('app.o2') = 'no_encontrado');
  v_out := v_out || pg_temp.chk('anónimo NO puede solicitar canjes (42501)', e_anon = '42501', e_anon);
  v_out := v_out || pg_temp.chk('la vía antigua canjear_recompensa() ya no existe', to_regprocedure('public.canjear_recompensa(uuid)') is null);
  v_out := v_out || pg_temp.chk('saldo final coherente: 2000 − 300 (K2 aplicado) − 300 (K3 aplicado) − 300 (K5 pendiente, reservado) = 1100', saldo5 = 1100, saldo5::text);

  raise exception E'RESULTADOS CANJES (todo se revierte)\n%', v_out;
end $$;
