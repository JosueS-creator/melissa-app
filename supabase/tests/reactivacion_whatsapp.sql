-- ============================================================
-- PRUEBAS · FASE C · REACTIVACIÓN ASISTIDA POR WHATSAPP
-- Crean datos de prueba y los REVIERTEN solos (error forzado final). Cada línea: OK o FALLA.
-- ============================================================
do $$
declare
  v_adm uuid; v_z uuid; v_sup uuid; v_y uuid;
  u_ad2 uuid := gen_random_uuid(); u_ay uuid := gen_random_uuid(); u_pref uuid := gen_random_uuid();
  pc_alta uuid; pc_media uuid; pc_baja1 uuid; pc_baja2 uuid; pc_futura uuid; pc_sinhist uuid; pc_reciente uuid; pc_sintel uuid; pc_telmalo uuid;
  pc_painulo uuid; pc_pref uuid; pc_pausa uuid; pc_vencida uuid; pc_sincuenta uuid; pc_usada uuid; pc_y uuid;
  r_retro uuid; n_ev_lecturas bigint; vol text; r_rec uuid; r_antes uuid; r_sinaccion uuid; r_dup uuid; r_pend uuid; r_fuera uuid; r_doble uuid; r_promo uuid; r_promo_antes uuid; r_filler uuid;
  pr_inac uuid; pr_exp uuid; pr_y uuid; pr_usada_para uuid;
  opps0 jsonb; opps1 jsonb; res0 jsonb; res1 jsonb; res2 jsonb; res3 jsonb; res4 jsonb; res_y jsonb;
  g1 jsonb; g2 jsonb; g3 jsonb; g4 jsonb; g5 jsonb; g6 jsonb; g7 jsonb; g8 jsonb; g9 jsonb; g10 jsonb; g11 jsonb; g12 jsonb; g13 jsonb;
  puntajes int[]; n_opps int; n_ev_alta bigint; ev record; n_24h bigint; n_filler int; n_y_opps bigint; e_y_reg text; n_cli_ev bigint; n_y_ev_z bigint; e_ins text; e_cli1 text; e_cli2 text; e_cli3 text; e_anon1 text; e_anon2 text;
  e_ins_ev text; tl_desc text; telefonos text[]; def text; e_evento text; lim int; cool int; vent int; n_cli_op bigint;
  v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;
  create function pg_temp.nuevo(p_clinica uuid, p_nombre text, p_tel text, p_pais text, p_visitas int, p_dias int, p_pagado numeric default 0) returns uuid language plpgsql as $f$
    declare v_id uuid; i int;
    begin
      insert into pacientes (clinica_id, nombre, telefono, pais, fecha_registro) values (p_clinica, p_nombre, p_tel, p_pais, now() - interval '300 days') returning id into v_id;
      for i in 0 .. p_visitas - 1 loop
        insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (p_clinica, v_id, now() - make_interval(days => p_dias + i * 20), 'completada', 'Limpieza');
      end loop;
      update citas set creada_at = null where paciente_id = v_id;
      if p_pagado > 0 then
        insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, metodo_pago, direccion) values (p_clinica, v_id, 'Cobro', 'servicio', p_pagado, 'efectivo', 'ingreso');
      end if;
      return v_id;
    end $f$;

  -- ---------- actores ----------
  -- Clínica y admin de prueba propios (nunca un negocio real); se revierten con el resto.
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Clínica Prueba', 'HN', 'zz-prueba-' || substr(gen_random_uuid()::text, 1, 8), 'HNL') returning id into v_z;
  v_adm := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (v_adm, 'zz-adm-z@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Admin Z'));
  update perfiles set rol = 'admin' where id = v_adm;
  select id, clinica_id into v_sup, v_y from perfiles where es_super_admin limit 1;
  insert into auth.users (id, email, raw_user_meta_data) values (u_ad2, 'zz-ad2@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Admin 2'));
  insert into auth.users (id, email, raw_user_meta_data) values (u_ay, 'zz-ay@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Admin Y'));
  insert into auth.users (id, email, raw_user_meta_data) values (u_pref, 'zz-pref@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ-PrefOff', 'telefono', '87401299', 'pais', 'HN'));
  update perfiles set rol = 'admin' where id in (u_ad2, u_ay);
  update perfiles set promociones_ofertas = false where id = u_pref;
  select id into pc_pref from pacientes where perfil_id = u_pref;
  update pacientes set fecha_registro = now() - interval '300 days' where id = pc_pref;
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (v_z, pc_pref, now() - interval '70 days', 'completada', 'Limpieza'), (v_z, pc_pref, now() - interval '90 days', 'completada', 'Limpieza');

  -- ---------- clientes de prueba (clínica Z) ----------
  pc_alta := pg_temp.nuevo(v_z, 'ZZ-Alta', '8740-1299', 'HN', 4, 100, 300);          -- 4 visitas · 100 días · con consumo
  pc_media := pg_temp.nuevo(v_z, 'ZZ-Media', '+504 9999-0000', null, 3, 50);         -- 3 visitas · 50 días
  pc_baja1 := pg_temp.nuevo(v_z, 'ZZ-Baja1', '3282 5189', 'HN', 1, 50);              -- 1 sola visita
  pc_baja2 := pg_temp.nuevo(v_z, 'ZZ-Baja2', '631691601', 'ES', 2, 50);
  pc_futura := pg_temp.nuevo(v_z, 'ZZ-Futura', '87783942', 'HN', 3, 100);            -- inactivo… pero con cita futura
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (v_z, pc_futura, now() + interval '5 days', 'confirmada', 'Limpieza');
  pc_sinhist := pg_temp.nuevo(v_z, 'ZZ-SinHist', '87783942', 'HN', 0, 0);            -- nunca vino
  pc_reciente := pg_temp.nuevo(v_z, 'ZZ-Reciente', '87783942', 'HN', 2, 10);         -- vino hace 10 días
  pc_sintel := pg_temp.nuevo(v_z, 'ZZ-SinTel', null, 'HN', 2, 60);
  pc_telmalo := pg_temp.nuevo(v_z, 'ZZ-TelMalo', 'abc', 'HN', 2, 60);
  pc_painulo := pg_temp.nuevo(v_z, 'ZZ-PaisNulo', '87401299', null, 2, 60);          -- local sin país: NO se adivina
  pc_pausa := pg_temp.nuevo(v_z, 'ZZ-EnPausa', '87783942', 'HN', 3, 70);
  pc_vencida := pg_temp.nuevo(v_z, 'ZZ-PausaVencida', '33514891', 'HN', 2, 70);
  pc_sincuenta := pg_temp.nuevo(v_z, 'ZZ-SinCuenta', '+34 612 345 678', null, 1, 60);
  pc_usada := pg_temp.nuevo(v_z, 'ZZ-Usada', '32825189', 'HN', 2, 60);
  pc_y := pg_temp.nuevo(v_y, 'ZZ-Y', '87783942', 'HN', 2, 60);                        -- de OTRA clínica
  insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas, created_at)
    values (v_z, pc_pausa, 'sin_promocion', 'media', now() - interval '80 days', 80, 3, now() - interval '10 days'),
           (v_z, pc_vencida, 'sin_promocion', 'baja', now() - interval '110 days', 110, 2, now() - interval '31 days');

  -- ================= ADMIN Z: oportunidades SIN promociones =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select jsonb_object_agg(o.nombre, to_jsonb(o)), count(*), array_agg(o.puntaje order by ord) into opps0, n_opps, puntajes
    from (select o2.*, row_number() over () as ord from public.reactivacion_oportunidades() o2) o;
  res0 := public.reactivacion_resumen();
  reset role;

  -- promociones: una de inactivos (15 %), una vencida, una de otra clínica y una ya usada por ZZ-Usada
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Te extrañamos', 15, 'inactivos', current_date - 1, current_date + 20, 'activa') returning id into pr_inac;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Vencida', 30, 'inactivos', current_date - 10, current_date - 1, 'activa') returning id into pr_exp;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_y, 'De otra clínica', 40, 'todos', current_date - 1, current_date + 20, 'activa') returning id into pr_y;
  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado, utilizada_at) values (pr_inac, v_z, pc_usada, 'utilizada', now());

  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select jsonb_object_agg(o.nombre, to_jsonb(o)) into opps1 from public.reactivacion_oportunidades() o;
  res1 := public.reactivacion_resumen();
  select count(*) into n_ev_lecturas from crm_reactivaciones where clinica_id = v_z;      -- tras abrir la pantalla varias veces: solo los 2 contactos de prueba

  -- ================= registrar contactos =================
  g1 := public.registrar_contacto_reactivacion(pc_alta, null, 'sin_promocion');                 -- ok
  g2 := public.registrar_contacto_reactivacion(pc_alta, null, 'sin_promocion');                 -- cooldown
  g3 := public.registrar_contacto_reactivacion(pc_media, pr_inac, 'con_promocion');             -- ok con promoción
  g4 := public.registrar_contacto_reactivacion(pc_baja1, pr_exp, 'con_promocion');              -- promoción vencida
  g5 := public.registrar_contacto_reactivacion(pc_baja1, pr_y, 'con_promocion');                -- promoción de otra clínica
  g6 := public.registrar_contacto_reactivacion(pc_baja1, null, 'inventada');                    -- plantilla inválida
  g7 := public.registrar_contacto_reactivacion(pc_reciente, null, 'sin_promocion');             -- no es oportunidad (vino hace poco)
  g8 := public.registrar_contacto_reactivacion(pc_futura, null, 'sin_promocion');               -- tiene cita futura
  g9 := public.registrar_contacto_reactivacion(pc_sintel, null, 'sin_promocion');               -- sin teléfono
  g10 := public.registrar_contacto_reactivacion(pc_pref, null, 'sin_promocion');                -- no desea promociones
  g11 := public.registrar_contacto_reactivacion(pc_pausa, null, 'sin_promocion');               -- contactado hace 10 días
  g12 := public.registrar_contacto_reactivacion(pc_y, null, 'sin_promocion');                   -- cliente de OTRA clínica
  g13 := public.registrar_contacto_reactivacion(pc_vencida, null, 'sin_promocion');             -- cooldown vencido: sí se puede
  res2 := public.reactivacion_resumen();
  select count(*) into n_ev_alta from crm_reactivaciones where paciente_id = pc_alta;
  select * into ev from crm_reactivaciones where paciente_id = pc_media and created_at > now() - interval '1 hour';
  select descripcion into tl_desc from public.crm_cliente_timeline(pc_alta) t where t.tipo = 'reactivacion' limit 1;
  reset role;

  -- ================= límite diario, varios administradores y reinicio =================
  select count(*) into n_24h from crm_reactivaciones where clinica_id = v_z and created_at > now() - interval '24 hours';
  n_filler := 29 - n_24h::int;
  insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas, created_at)
    select v_z, pc_reciente, 'sin_promocion', 'baja', now() - interval '60 days', 60, 2, now() - interval '2 hours' from generate_series(1, n_filler);
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  perform set_config('app.l1', (public.registrar_contacto_reactivacion(pc_baja2, null, 'sin_promocion'))::text, true);      -- el contacto 30: permitido
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_ad2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_ad2::text, true);
  set local role authenticated;
  perform set_config('app.l2', (public.registrar_contacto_reactivacion(pc_sincuenta, null, 'sin_promocion'))::text, true); -- otro administrador: el 31 NO
  res3 := public.reactivacion_resumen();
  reset role;
  select count(*) into n_24h from crm_reactivaciones where clinica_id = v_z and created_at > now() - interval '24 hours';
  update crm_reactivaciones set created_at = created_at - interval '25 hours' where clinica_id = v_z and created_at > now() - interval '24 hours';   -- pasan 24 horas
  perform set_config('request.jwt.claims', json_build_object('sub', u_ad2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_ad2::text, true);
  set local role authenticated;
  perform set_config('app.l3', (public.registrar_contacto_reactivacion(pc_sincuenta, null, 'sin_promocion'))::text, true); -- tras 24 h: permitido de nuevo
  res4 := public.reactivacion_resumen();
  reset role;

  -- ================= recuperación (medición) =================
  r_rec := pg_temp.nuevo(v_z, 'ZZ-Rec', '87783942', 'HN', 1, 200);          -- acción hace 20 días → cita creada después y completada
  r_antes := pg_temp.nuevo(v_z, 'ZZ-Antes', '87783942', 'HN', 1, 200);      -- su cita completada se creó ANTES de la acción
  r_sinaccion := pg_temp.nuevo(v_z, 'ZZ-SinAccion', '87783942', 'HN', 1, 200);
  r_dup := pg_temp.nuevo(v_z, 'ZZ-Dup', '87783942', 'HN', 1, 200);
  r_pend := pg_temp.nuevo(v_z, 'ZZ-Pend', '87783942', 'HN', 1, 200);
  r_fuera := pg_temp.nuevo(v_z, 'ZZ-Fuera', '87783942', 'HN', 1, 200);
  r_doble := pg_temp.nuevo(v_z, 'ZZ-Doble', '87783942', 'HN', 1, 200);
  r_promo := pg_temp.nuevo(v_z, 'ZZ-PromoOk', '87783942', 'HN', 1, 200);
  r_promo_antes := pg_temp.nuevo(v_z, 'ZZ-PromoAntes', '87783942', 'HN', 1, 200);
  r_retro := pg_temp.nuevo(v_z, 'ZZ-Retro', '87783942', 'HN', 1, 200);      -- visita de hace 30 días (antes del contacto) registrada hace 10 (después)
  delete from crm_reactivaciones where clinica_id = v_z;                   -- se mide solo lo de esta sección
  insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, promocion_id, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas, created_at) values
    (v_z, r_rec, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days'),
    (v_z, r_antes, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days'),
    (v_z, r_dup, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days'),
    (v_z, r_pend, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days'),
    (v_z, r_fuera, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '100 days'),
    (v_z, r_doble, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '100 days'),
    (v_z, r_doble, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '40 days'),
    (v_z, r_promo, 'con_promocion', pr_inac, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days'),
    (v_z, r_promo_antes, 'con_promocion', pr_inac, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days'),
    (v_z, r_retro, 'sin_promocion', null, 'media', now() - interval '200 days', 200, 1, now() - interval '20 days');
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values
    (v_z, r_rec, now() - interval '9 days', 'completada', 'Vuelta'), (v_z, r_antes, now() - interval '9 days', 'completada', 'Vuelta'),
    (v_z, r_sinaccion, now() - interval '9 days', 'completada', 'Vuelta'), (v_z, r_dup, now() - interval '9 days', 'completada', 'Vuelta'),
    (v_z, r_dup, now() - interval '5 days', 'completada', 'Vuelta 2'), (v_z, r_pend, now() - interval '9 days', 'pendiente', 'Vuelta'),
    (v_z, r_fuera, now() - interval '9 days', 'completada', 'Vuelta'), (v_z, r_doble, now() - interval '9 days', 'completada', 'Vuelta'),
    (v_z, r_retro, now() - interval '30 days', 'completada', 'Vuelta');
  update citas set creada_at = now() - interval '10 days' where tratamiento in ('Vuelta', 'Vuelta 2') and clinica_id = v_z and paciente_id <> r_antes;
  update citas set creada_at = now() - interval '30 days' where tratamiento = 'Vuelta' and paciente_id = r_antes;     -- creada ANTES de la acción
  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado, utilizada_at) values
    (pr_inac, v_z, r_promo, 'utilizada', now() - interval '10 days'), (pr_inac, v_z, r_promo_antes, 'utilizada', now() - interval '30 days');   -- usada después / antes de la acción
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  res_y := public.reactivacion_resumen();
  reset role;

  -- ================= SEGURIDAD =================
  perform set_config('request.jwt.claims', json_build_object('sub', u_ay, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_ay::text, true);
  set local role authenticated;
  select count(*) into n_y_opps from public.reactivacion_oportunidades();
  e_y_reg := (public.registrar_contacto_reactivacion(pc_alta, null, 'sin_promocion'))->>'resultado';       -- cliente de Z, siendo admin de Y
  select count(*) into n_y_ev_z from crm_reactivaciones where clinica_id = v_z;
  begin insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas) values (v_y, pc_y, 'sin_promocion', 'baja', now(), 1, 1); e_ins := 'PERMITIDO'; exception when others then e_ins := sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_pref, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_pref::text, true);
  set local role authenticated;
  begin perform public.reactivacion_oportunidades(); e_cli1 := 'PERMITIDO'; exception when others then e_cli1 := sqlerrm; end;
  begin perform public.reactivacion_resumen(); e_cli2 := 'PERMITIDO'; exception when others then e_cli2 := sqlerrm; end;
  begin perform public.registrar_contacto_reactivacion(pc_alta, null, 'sin_promocion'); e_cli3 := 'PERMITIDO'; exception when others then e_cli3 := sqlerrm; end;
  select count(*) into n_cli_ev from crm_reactivaciones;
  begin insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas) values (v_z, pc_pref, 'sin_promocion', 'baja', now(), 1, 1); e_ins_ev := 'PERMITIDO'; exception when others then e_ins_ev := sqlstate; end;
  reset role;
  set local role anon;
  begin perform public.reactivacion_oportunidades(); e_anon1 := 'PERMITIDO'; exception when others then e_anon1 := sqlstate; end;
  begin perform public.registrar_contacto_reactivacion(pc_alta, null, 'sin_promocion'); e_anon2 := 'PERMITIDO'; exception when others then e_anon2 := sqlstate; end;
  reset role;
  begin insert into crm_reactivaciones (clinica_id, paciente_id, evento, plantilla, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas) values (v_z, pc_alta, 'mensaje_enviado', 'sin_promocion', 'baja', now(), 1, 1); e_evento := 'PERMITIDO';
  exception when check_violation then e_evento := 'bloqueado'; end;
  select array_agg(public.telefono_whatsapp(t.tel, t.pais) order by t.ord) into telefonos from (values
    (1, '+504 8740-1299', null), (2, '87401299', 'HN'), (3, '8740-1299', 'hn'), (4, '(504) 8740-1299', null), (5, '00504 87401299', null),
    (6, '50487401299', 'HN'), (7, '631691601', 'ES'), (8, '+34 612 345 678', null), (9, '87401299', null), (10, '87401299', 'ES'),
    (11, 'abc', 'HN'), (12, '', 'HN'), (13, null, 'HN'), (14, '1234', 'HN'), (15, '+1234567890123456', null), (16, '12345678', 'HN')) as t(ord, tel, pais);
  select pg_get_functiondef('public.registrar_contacto_reactivacion(uuid, uuid, text)'::regprocedure) into def;
  select provolatile::text into vol from pg_proc where proname = 'registrar_contacto_reactivacion';
  lim := public.reactivacion_limite_diario(); cool := public.reactivacion_cooldown_dias(); vent := public.reactivacion_ventana_regreso_dias();

  -- ================= EVALUACIÓN =================
  v_out := E'--- OPORTUNIDADES: quién aparece y quién no ---\n';
  v_out := v_out || pg_temp.chk('aparecen los inactivos con historial (7 con teléfono + 3 sin teléfono utilizable)', n_opps = 10 and opps0 ?& array['ZZ-Alta','ZZ-Media','ZZ-Baja1','ZZ-Baja2','ZZ-SinCuenta','ZZ-PausaVencida','ZZ-Usada','ZZ-SinTel','ZZ-TelMalo','ZZ-PaisNulo'], n_opps::text);
  v_out := v_out || pg_temp.chk('NO aparecen: cita futura, sin historial, visita reciente, de otra clínica', not (opps0 ? 'ZZ-Futura') and not (opps0 ? 'ZZ-SinHist') and not (opps0 ? 'ZZ-Reciente') and not (opps0 ? 'ZZ-Y'));
  v_out := v_out || pg_temp.chk('NO aparecen: contactado hace 10 días (en pausa) ni quien NO desea promociones; sí quien terminó su pausa de 30 días', not (opps0 ? 'ZZ-EnPausa') and not (opps0 ? 'ZZ-PrefOff') and (opps0 ? 'ZZ-PausaVencida'));
  v_out := v_out || pg_temp.chk('el cliente sin cuenta (sin preferencia guardada) sí aparece', (opps0 ? 'ZZ-SinCuenta'));
  v_out := v_out || E'--- PRIORIDAD (sencilla y explicable) ---\n';
  v_out := v_out || pg_temp.chk('ALTA: 4 visitas + consumo + 100 días (4 puntos)', opps0->'ZZ-Alta'->>'prioridad' = 'alta' and (opps0->'ZZ-Alta'->>'puntaje')::int = 4, opps0->'ZZ-Alta'->>'puntaje');
  v_out := v_out || pg_temp.chk('MEDIA: 3 visitas, 50 días, sin consumo (2 puntos)', opps0->'ZZ-Media'->>'prioridad' = 'media' and (opps0->'ZZ-Media'->>'puntaje')::int = 2);
  v_out := v_out || pg_temp.chk('BAJA: una sola visita (0) y dos visitas sin más señales (1)', opps0->'ZZ-Baja1'->>'prioridad' = 'baja' and (opps0->'ZZ-Baja1'->>'puntaje')::int = 0 and opps0->'ZZ-Baja2'->>'prioridad' = 'baja' and (opps0->'ZZ-Baja2'->>'puntaje')::int = 1);
  v_out := v_out || pg_temp.chk('la lista viene ordenada de mayor a menor prioridad', puntajes = (select array_agg(x order by x desc) from unnest(puntajes) x), array_to_string(puntajes, ','));
  v_out := v_out || pg_temp.chk('cada oportunidad explica el motivo (sin cita, visitas, días, consumo)',
    (opps0->'ZZ-Alta'->'motivos') @> '["No ha regresado y no tiene próxima cita","4 visitas anteriores","Tiene historial de consumo registrado","Lleva 100 días sin volver"]'::jsonb and (opps0->'ZZ-Baja1'->'motivos') @> '["Solo 1 visita anterior"]'::jsonb, (opps0->'ZZ-Alta'->'motivos')::text);
  v_out := v_out || E'--- PROMOCIONES (opcionales) ---\n';
  v_out := v_out || pg_temp.chk('sin promociones: no se recomienda ninguna (y no se crea ninguna sola)', opps0->'ZZ-Alta'->>'promocion_id' is null and opps0->'ZZ-Media'->>'promocion_id' is null);
  v_out := v_out || pg_temp.chk('con una promoción vigente: se recomienda a quien le corresponde y sube un punto su prioridad (media → alta)', opps1->'ZZ-Media'->>'promocion_id' = pr_inac::text and opps1->'ZZ-Media'->>'prioridad' = 'alta' and (opps1->'ZZ-Media'->>'puntaje')::int = 3 and (opps1->'ZZ-Media'->>'promocion_descuento')::numeric = 15);
  v_out := v_out || pg_temp.chk('NO se recomienda la vencida (30 %), ni la de otra clínica (40 %), ni una que el cliente ya usó', opps1->'ZZ-Baja1'->>'promocion_id' = pr_inac::text and opps1->'ZZ-Usada'->>'promocion_id' is null);
  v_out := v_out || E'--- TELÉFONOS (no se adivina) ---\n';
  v_out := v_out || pg_temp.chk('con "+", "00" o país conocido se normaliza; sin país (incluido "(504) 8740-1299") o inválido devuelve nulo: no se adivina',
    telefonos = array['50487401299','50487401299','50487401299',null,'50487401299','50487401299','34631691601','34612345678',null,null,null,null,null,null,null,null], array_to_string(telefonos, ' | ', '·'));
  v_out := v_out || pg_temp.chk('teléfonos de las oportunidades: local+HN, "+504", local+ES, "+34"; sin teléfono / inválido / sin país → sin botón',
    opps0->'ZZ-Alta'->>'telefono_wa' = '50487401299' and opps0->'ZZ-Media'->>'telefono_wa' = '50499990000' and opps0->'ZZ-Baja2'->>'telefono_wa' = '34631691601' and opps0->'ZZ-SinCuenta'->>'telefono_wa' = '34612345678'
    and opps0->'ZZ-SinTel'->>'telefono_wa' is null and opps0->'ZZ-TelMalo'->>'telefono_wa' is null and opps0->'ZZ-PaisNulo'->>'telefono_wa' is null);
  v_out := v_out || E'--- REGISTRO HONESTO y ANTI-SPAM ---\n';
  v_out := v_out || pg_temp.chk('registrar un contacto: ok, devuelve el teléfono validado y guarda el contexto (prioridad, días, visitas), no el mensaje', g1->>'resultado' = 'ok' and g1->>'telefono_wa' = '50487401299' and n_ev_alta = 1);
  v_out := v_out || pg_temp.chk('el evento se llama "contacto_iniciado" (no "enviado"): la base no admite eventos que no puede saber', e_evento = 'bloqueado' and ev.evento = 'contacto_iniciado');
  v_out := v_out || pg_temp.chk('cooldown de 30 días: el mismo cliente no se puede volver a contactar', g2->>'resultado' = 'en_cooldown' and g2->>'disponible_desde' is not null);
  v_out := v_out || pg_temp.chk('con promoción vigente: se guarda con la promoción y la plantilla', g3->>'resultado' = 'ok' and ev.promocion_id = pr_inac and ev.plantilla = 'con_promocion' and ev.prioridad = 'alta');
  v_out := v_out || pg_temp.chk('promoción vencida o de otra clínica: rechazada', g4->>'resultado' = 'promocion_no_aplicable' and g5->>'resultado' = 'promocion_no_aplicable' and g6->>'resultado' = 'plantilla_invalida');
  v_out := v_out || pg_temp.chk('no se puede registrar a quien no es oportunidad: visita reciente, cita futura, sin teléfono, no desea promociones', g7->>'resultado' = 'no_oportunidad' and g8->>'resultado' = 'no_oportunidad' and g9->>'resultado' = 'no_oportunidad' and g10->>'resultado' = 'no_oportunidad');
  v_out := v_out || pg_temp.chk('en pausa → en_cooldown; cliente de otra clínica → cliente_invalido; pausa terminada (31 días) → ok', g11->>'resultado' = 'en_cooldown' and g12->>'resultado' = 'cliente_invalido' and g13->>'resultado' = 'ok');
  v_out := v_out || pg_temp.chk('quien ya fue contactado sale de la lista y se cuenta "en pausa"; las oportunidades bajan', (res1->>'oportunidades')::int - (res2->>'oportunidades')::int = 3 and (res2->>'en_pausa')::int = (res1->>'en_pausa')::int + 3, (res1->>'oportunidades') || '→' || (res2->>'oportunidades') || ' · pausa ' || (res1->>'en_pausa') || '→' || (res2->>'en_pausa'));
  v_out := v_out || pg_temp.chk('límite diario: el contacto 30 se permite (quedan 0)', (current_setting('app.l1')::jsonb)->>'resultado' = 'ok' and (current_setting('app.l1')::jsonb->>'restantes')::int = 0, current_setting('app.l1'));
  v_out := v_out || pg_temp.chk('límite diario: OTRO administrador intenta el 31 → limite_diario con la hora en que se libera; nunca pasa de 30', (current_setting('app.l2')::jsonb)->>'resultado' = 'limite_diario' and (current_setting('app.l2')::jsonb)->>'libre_desde' is not null and n_24h = 30, n_24h::text);
  v_out := v_out || pg_temp.chk('el resumen muestra 30 de 30 usados y 0 restantes', (res3->>'contactos_24h')::int = 30 and (res3->>'restantes')::int = 0 and (res3->>'limite_diario')::int = 30 and res3->>'libre_desde' is not null);
  v_out := v_out || pg_temp.chk('pasadas 24 horas el contador se reinicia y se permite de nuevo', (current_setting('app.l3')::jsonb)->>'resultado' = 'ok' and (res4->>'contactos_24h')::int = 1 and (res4->>'restantes')::int = 29, current_setting('app.l3'));
  v_out := v_out || pg_temp.chk('abrir la pantalla (listas y resumen, varias veces) NO crea ningún contacto', n_ev_lecturas = 2, n_ev_lecturas::text);
  v_out := v_out || pg_temp.chk('concurrencia: registrar es VOLATILE y toma el bloqueo por clínica ANTES de validar el cooldown y el límite', vol = 'v' and position('pg_advisory_xact_lock' in def) < position('select max(r.created_at)' in def) and position('select max(r.created_at)' in def) < position('crm_reactivaciones (clinica_id' in def));
  v_out := v_out || pg_temp.chk('el resumen informa el criterio de inactividad del negocio (para explicar el estado vacío)', (res0->>'dias_inactividad')::int = (select dias_inactividad from clinicas where id = v_z), res0->>'dias_inactividad');
  v_out := v_out || pg_temp.chk('el límite, el cooldown y la validación viven en el servidor: la función bloquea por clínica y usa las constantes (30 · 30 días · 60 días)',
    def like '%pg_advisory_xact_lock%' and def like '%reactivacion_limite_diario%' and def like '%reactivacion_cooldown_dias%' and lim = 30 and cool = 30 and vent = 60);
  v_out := v_out || E'--- RECUPERACIÓN (solo "regresó después de la acción", sin atribuir ingresos) ---\n';
  v_out := v_out || pg_temp.chk('regresaron = 3 (Rec, Dup, Doble): cita creada DESPUÉS de la acción y COMPLETADA, dentro de 60 días', (res_y->>'regresaron')::int = 3, res_y->>'regresaron');
  v_out := v_out || pg_temp.chk('NO cuentan: cita creada antes de la acción, sin acción, solo pendiente, fuera de la ventana de 60 días', (res_y->>'regresaron')::int = 3 and (res_y->>'citas_posteriores')::int = 4, (res_y->>'citas_posteriores'));
  v_out := v_out || pg_temp.chk('visita ocurrida ANTES del contacto pero registrada después (retroactiva): NO cuenta como regreso ni como cita posterior', (res_y->>'regresaron')::int = 3 and (res_y->>'citas_posteriores')::int = 4);
  v_out := v_out || pg_temp.chk('no se duplica: dos citas completadas tras una acción, o dos acciones para un cliente, cuentan UNA vez', (res_y->>'regresaron')::int = 3);
  v_out := v_out || pg_temp.chk('promociones usadas tras la acción = 1 (la usada ANTES de la acción no cuenta)', (res_y->>'promos_usadas')::int = 1 and (res_y->>'acciones_con_promocion')::int = 2, (res_y->>'promos_usadas'));
  v_out := v_out || pg_temp.chk('la medición informa desde cuándo existe y cuántas acciones hay', res_y->>'medicion_desde' is not null and (res_y->>'acciones_total')::int = 10);
  v_out := v_out || pg_temp.chk('el contacto aparece en la línea de tiempo del Cliente 360 SIN afirmar que se envió', tl_desc like '%Se inició un contacto por WhatsApp%' and tl_desc like '%no se sabe si se envió%', coalesce(tl_desc, 'sin evento'));
  v_out := v_out || E'--- SEGURIDAD MULTI-CLÍNICA ---\n';
  v_out := v_out || pg_temp.chk('el admin de OTRA clínica solo ve las oportunidades de la suya (1) y no puede contactar a clientes ajenos', n_y_opps = 1 and e_y_reg = 'cliente_invalido', n_y_opps || '/' || e_y_reg);
  v_out := v_out || pg_temp.chk('el admin de OTRA clínica no ve los eventos de contacto ajenos y no puede escribirlos (42501)', n_y_ev_z = 0 and e_ins = '42501', n_y_ev_z || '/' || e_ins);
  v_out := v_out || pg_temp.chk('un CLIENTE no puede ver oportunidades, resumen ni registrar contactos; no lee ni escribe la tabla (42501)', e_cli1 = 'No autorizado' and e_cli2 = 'No autorizado' and e_cli3 = 'No autorizado' and n_cli_ev = 0 and e_ins_ev = '42501', e_cli1 || '/' || e_cli2 || '/' || e_cli3 || '/' || n_cli_ev || '/' || e_ins_ev);
  v_out := v_out || pg_temp.chk('anónimo NO puede consultar ni registrar (42501)', e_anon1 = '42501' and e_anon2 = '42501', e_anon1 || '/' || e_anon2);
  v_out := v_out || pg_temp.chk('el resumen inicial es coherente: 7 con teléfono (1 alta · 1 media · 5 baja), 3 sin teléfono, 1 en pausa, 1 no desea', (res0->>'oportunidades')::int = 7 and (res0->>'alta')::int = 1 and (res0->>'media')::int = 1 and (res0->>'baja')::int = 5 and (res0->>'sin_telefono')::int = 3 and (res0->>'en_pausa')::int = 1 and (res0->>'no_desean')::int = 1, res0::text);

  raise exception E'RESULTADOS FASE C (todo se revierte)\n%', v_out;
end $$;
