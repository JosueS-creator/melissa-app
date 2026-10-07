-- ============================================================
-- PRUEBAS · PROMOCIONES DENTRO DE LA APP
-- Crean datos de prueba y los REVIERTEN solos (error forzado final). Cada línea: OK o FALLA.
-- ============================================================
do $$
declare
  v_adm uuid; v_z uuid; v_sup uuid; v_y uuid;
  u_inac uuid := gen_random_uuid(); u_nuevo uuid := gen_random_uuid(); u_vip uuid := gen_random_uuid();
  u_y uuid := gen_random_uuid(); u_ay uuid := gen_random_uuid();
  p_inac uuid; p_nuevo uuid; p_vip uuid; p_y uuid; svz uuid;
  pr_inac uuid; pr_nuevos uuid; pr_todos uuid; pr_vip uuid; pr_exp uuid; pr_fut uuid; pr_borr uuid; pr_paus uuid; pr_y uuid;
  l_inac uuid[]; l_nuevo uuid[]; l_vip uuid[]; l_y uuid[]; l_inac_tras uuid[]; l_nuevo_off uuid[];
  b1 uuid[]; b2 uuid[]; b3 uuid[]; b4 uuid[]; b_off uuid[]; b_vip uuid[]; ap_antes uuid[]; ap_despues uuid[];
  veces_b1 integer; estado_vista text; estado_desc text; e_val_pct0 text; e_val_pct101 text; e_val_fechas text; e_val_seg text; e_val_titulo text; e_otra_clinica text;
  e_acc text; e_nodisp text; e_nodisp_y text; n_prom_cli bigint; e_ins_prom text; e_ins_pc text; e_upd_pc text; e_apl_cli text; e_res_cli text; e_aplic_cli text; e_calc text; e_seg text;
  n_freq_cli bigint; e_cita_ok text; e_cita_y text; e_desc_util text;
  jx jsonb; jx2 jsonb; jx3 jsonb; r_nodo text[]; pg pagos%rowtype; n_pagos_clave bigint;
  e_pg1 text; e_pg2 text; e_dup text; e_chk text; e_borrar_usada text; n_borrar_sin_uso bigint; e_freq0 text;
  n_res_filas bigint; res_inac jsonb; res_todos jsonb; res_nuevos jsonb; n_crm_nuevos bigint; n_crm_todos bigint; n_crm_inac bigint;
  f1 record; f2 record; g1 record; g2 record; n_ay_prom bigint; n_ay_upd bigint; n_ay_del bigint; n_ay_res bigint; n_ay_aplic bigint; e_ay_apl text; n_ay_freq bigint; e_anon1 text; e_anon2 text;
  v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;

  -- ---------- actores y datos de prueba (como superusuario) ----------
  select id, clinica_id into v_adm, v_z from perfiles where rol = 'admin' and not es_super_admin limit 1;
  select id, clinica_id into v_sup, v_y from perfiles where es_super_admin limit 1;
  insert into auth.users (id, email, raw_user_meta_data) values (u_inac, 'zz-inac@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Inactiva'));
  insert into auth.users (id, email, raw_user_meta_data) values (u_nuevo, 'zz-nuevo@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Nueva'));
  insert into auth.users (id, email, raw_user_meta_data) values (u_vip, 'zz-vip@x.test', jsonb_build_object('clinica_id', v_z, 'nombre', 'ZZ Vip'));
  insert into auth.users (id, email, raw_user_meta_data) values (u_y, 'zz-y@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Cliente Y'));
  insert into auth.users (id, email, raw_user_meta_data) values (u_ay, 'zz-ay@x.test', jsonb_build_object('clinica_id', v_y, 'nombre', 'ZZ Admin Y'));
  update perfiles set rol = 'admin' where id = u_ay;
  select id into p_inac from pacientes where perfil_id = u_inac;
  select id into p_nuevo from pacientes where perfil_id = u_nuevo;
  select id into p_vip from pacientes where perfil_id = u_vip;
  select id into p_y from pacientes where perfil_id = u_y;
  update pacientes set fecha_registro = now() - interval '200 days' where id in (p_inac, p_vip);       -- ni "nuevas"
  insert into citas (clinica_id, paciente_id, fecha_hora, estado, tratamiento) values (v_z, p_inac, now() - interval '100 days', 'completada', 'Limpieza');   -- inactiva: 100 días sin volver
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo) values (v_z, p_vip, 'acumulacion', 900, 'prueba');                          -- nivel Oro → VIP
  insert into servicios (clinica_id, nombre, precio) values (v_z, 'ZZ Facial', 500) returning id into svz;

  -- ================= ADMIN: crea promociones (y se prueban las validaciones) =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  insert into promociones (clinica_id, titulo, descripcion, descuento_porcentaje, segmento, servicio_id, inicio, fin, estado)
    values (v_z, 'Te extrañamos', 'Vuelve con un beneficio', 15, 'inactivos', svz, current_date - 1, current_date + 10, 'activa') returning id into pr_inac;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Bienvenida', 10, 'nuevos', current_date - 1, current_date + 20, 'activa') returning id into pr_nuevos;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Para todos', 5, 'todos', current_date - 1, current_date + 30, 'activa') returning id into pr_todos;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Solo VIP', 20, 'vip', current_date - 1, current_date + 15, 'activa') returning id into pr_vip;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Expirada', 5, 'todos', current_date - 10, current_date - 1, 'activa') returning id into pr_exp;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Futura', 5, 'todos', current_date + 3, current_date + 20, 'activa') returning id into pr_fut;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Borrador', 5, 'todos', current_date - 1, current_date + 20, 'borrador') returning id into pr_borr;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_z, 'Pausada', 5, 'todos', current_date - 1, current_date + 20, 'pausada') returning id into pr_paus;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, fin) values (v_z, 'x', 0, 'todos', current_date + 5); e_val_pct0 := 'PERMITIDO'; exception when check_violation then e_val_pct0 := 'bloqueado'; end;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, fin) values (v_z, 'x', 101, 'todos', current_date + 5); e_val_pct101 := 'PERMITIDO'; exception when check_violation then e_val_pct101 := 'bloqueado'; end;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin) values (v_z, 'x', 10, 'todos', current_date + 5, current_date + 1); e_val_fechas := 'PERMITIDO'; exception when check_violation then e_val_fechas := 'bloqueado'; end;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, fin) values (v_z, 'x', 10, 'inventado', current_date + 5); e_val_seg := 'PERMITIDO'; exception when check_violation then e_val_seg := 'bloqueado'; end;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, fin) values (v_z, '   ', 10, 'todos', current_date + 5); e_val_titulo := 'PERMITIDO'; exception when check_violation then e_val_titulo := 'bloqueado'; end;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, fin) values (v_y, 'Ajena', 10, 'todos', current_date + 5); e_otra_clinica := 'PERMITIDO'; exception when others then e_otra_clinica := sqlstate; end;
  select array_agg(a.id order by a.id) into ap_antes from public.promociones_aplicables(p_inac) a;
  select count(*) filter (where es_nuevo), count(*), count(*) filter (where es_inactivo) into n_crm_nuevos, n_crm_todos, n_crm_inac from public.crm_clientes();
  begin update clinicas set promo_frecuencia_dias = 0 where id = v_z; e_freq0 := 'PERMITIDO'; exception when check_violation then e_freq0 := 'bloqueado'; end;
  reset role;
  insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_y, 'Promo de Y', 10, 'todos', current_date - 1, current_date + 10, 'activa') returning id into pr_y;

  -- ================= CLIENTE INACTIVA =================
  perform set_config('request.jwt.claims', json_build_object('sub', u_inac, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_inac::text, true);
  set local role authenticated;
  select array_agg(m.id order by m.id) into l_inac from public.mis_promociones() m;
  select array_agg(b.id) into b1 from public.promocion_para_banner() b;                    -- 1.er aviso: la que vence primero
  select array_agg(b.id) into b2 from public.promocion_para_banner() b;                    -- refresh inmediato: nada
  select count(*) into n_prom_cli from promociones;                                         -- el cliente no lee la tabla
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, fin) values (v_z, 'hack', 99, 'todos', current_date + 5); e_ins_prom := 'PERMITIDO'; exception when others then e_ins_prom := sqlstate; end;
  begin insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado) values (pr_vip, v_z, p_inac, 'utilizada'); e_ins_pc := 'PERMITIDO'; exception when others then e_ins_pc := sqlstate; end;
  begin update promocion_clientes set estado = 'utilizada'; e_upd_pc := 'PERMITIDO'; exception when others then e_upd_pc := sqlstate; end;
  begin perform public.aplicar_promocion(gen_random_uuid(), pr_inac, p_inac, 100, 'servicio', 'efectivo', 'x'); e_apl_cli := 'PERMITIDO'; exception when others then e_apl_cli := sqlerrm; end;
  begin perform public.promociones_resumen(); e_res_cli := 'PERMITIDO'; exception when others then e_res_cli := sqlerrm; end;
  begin perform public.promociones_aplicables(p_inac); e_aplic_cli := 'PERMITIDO'; exception when others then e_aplic_cli := sqlerrm; end;
  begin perform public.crm_calcular(v_z, p_inac); e_calc := 'PERMITIDO'; exception when others then e_calc := sqlstate; end;
  begin perform public.promo_aplica_segmento('todos', true, true, true, true, true, true, true); e_seg := 'PERMITIDO'; exception when others then e_seg := sqlstate; end;
  begin update clinicas set promo_frecuencia_dias = 1 where id = v_z; get diagnostics n_freq_cli = row_count; exception when others then n_freq_cli := -1; end;
  e_acc := (public.marcar_promocion(pr_inac, 'utilizada'))->>'resultado';                   -- no puede marcarla utilizada
  e_nodisp := (public.marcar_promocion(pr_vip, 'vista'))->>'resultado';                     -- no le corresponde (segmento VIP)
  e_nodisp_y := (public.marcar_promocion(pr_y, 'vista'))->>'resultado';                     -- de otra clínica
  reset role;
  select veces_mostrada into veces_b1 from promocion_clientes where promocion_id = pr_inac and paciente_id = p_inac;
  update promocion_clientes set ultima_vez_mostrada = now() - interval '4 days' where paciente_id = p_inac;   -- pasa la ventana de 3 días

  perform set_config('request.jwt.claims', json_build_object('sub', u_inac, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_inac::text, true);
  set local role authenticated;
  select array_agg(b.id) into b3 from public.promocion_para_banner() b;                    -- pasada la ventana y sin actuar: vuelve a avisar
  perform public.marcar_promocion(pr_inac, 'vista');                                       -- la abrió
  reset role;
  update promocion_clientes set ultima_vez_mostrada = now() - interval '4 days' where paciente_id = p_inac;
  perform set_config('request.jwt.claims', json_build_object('sub', u_inac, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_inac::text, true);
  set local role authenticated;
  select array_agg(b.id) into b4 from public.promocion_para_banner() b;                    -- la vista ya no es aviso: sigue la siguiente
  perform public.marcar_promocion(pr_todos, 'descartar');                                   -- dejar de verla
  select array_agg(m.id order by m.id) into l_inac_tras from public.mis_promociones() m;
  reset role;
  select estado into estado_vista from promocion_clientes where promocion_id = pr_inac and paciente_id = p_inac;
  select estado into estado_desc from promocion_clientes where promocion_id = pr_todos and paciente_id = p_inac;

  -- ================= CLIENTE NUEVA: con "Promociones y ofertas" apagado =================
  update perfiles set promociones_ofertas = false where id = u_nuevo;
  perform set_config('request.jwt.claims', json_build_object('sub', u_nuevo, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_nuevo::text, true);
  set local role authenticated;
  select array_agg(m.id order by m.id) into l_nuevo from public.mis_promociones() m;
  select array_agg(b.id) into b_off from public.promocion_para_banner() b;                 -- respeta su preferencia: sin aviso
  reset role;
  update perfiles set promociones_ofertas = true where id = u_nuevo;

  -- ================= CLIENTE VIP y CLIENTE DE OTRA CLÍNICA =================
  perform set_config('request.jwt.claims', json_build_object('sub', u_vip, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_vip::text, true);
  set local role authenticated;
  select array_agg(m.id order by m.id) into l_vip from public.mis_promociones() m;
  select array_agg(b.id) into b_vip from public.promocion_para_banner() b;
  begin insert into citas (clinica_id, paciente_id, fecha_hora, estado, promocion_id) values (v_z, p_vip, now() + interval '5 days', 'pendiente', pr_inac); e_cita_ok := 'OK'; exception when others then e_cita_ok := sqlstate; end;
  begin insert into citas (clinica_id, paciente_id, fecha_hora, estado, promocion_id) values (v_z, p_vip, now() + interval '6 days', 'pendiente', pr_y); e_cita_y := 'PERMITIDO'; exception when foreign_key_violation then e_cita_y := 'bloqueado'; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_y, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_y::text, true);
  set local role authenticated;
  select array_agg(m.id order by m.id) into l_y from public.mis_promociones() m;
  reset role;

  -- ================= ADMIN: aplica promociones =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  jx := public.aplicar_promocion('00000000-0000-0000-0000-0000000000b1', pr_inac, p_inac, 400, 'servicio', 'efectivo', 'Limpieza facial');   -- 15 % de 400 = 60
  select * into pg from pagos where promocion_id = pr_inac and paciente_id = p_inac;
  jx2 := public.aplicar_promocion('00000000-0000-0000-0000-0000000000b1', pr_inac, p_inac, 400, 'servicio', 'efectivo', 'Limpieza facial'); -- reintento (misma clave)
  select count(*) into n_pagos_clave from pagos where clave_operacion = '00000000-0000-0000-0000-0000000000b1';
  jx3 := public.aplicar_promocion(gen_random_uuid(), pr_inac, p_inac, 400, 'servicio', 'efectivo', 'Otra vez');                              -- otra clave: ya usada
  r_nodo := array[
    (public.aplicar_promocion(gen_random_uuid(), pr_vip, p_inac, 400, 'servicio', 'efectivo', 'x'))->>'resultado',     -- no es VIP
    (public.aplicar_promocion(gen_random_uuid(), pr_exp, p_inac, 400, 'servicio', 'efectivo', 'x'))->>'resultado',     -- expirada
    (public.aplicar_promocion(gen_random_uuid(), pr_fut, p_inac, 400, 'servicio', 'efectivo', 'x'))->>'resultado',     -- aún no empieza
    (public.aplicar_promocion(gen_random_uuid(), pr_borr, p_inac, 400, 'servicio', 'efectivo', 'x'))->>'resultado',    -- borrador
    (public.aplicar_promocion(gen_random_uuid(), pr_paus, p_inac, 400, 'servicio', 'efectivo', 'x'))->>'resultado',    -- pausada
    (public.aplicar_promocion(gen_random_uuid(), pr_y, p_inac, 400, 'servicio', 'efectivo', 'x'))->>'resultado',       -- de otra clínica
    (public.aplicar_promocion(gen_random_uuid(), pr_todos, p_y, 400, 'servicio', 'efectivo', 'x'))->>'resultado',      -- cliente de otra clínica
    (public.aplicar_promocion(gen_random_uuid(), pr_todos, p_vip, 400, 'otro_tipo', 'efectivo', 'x'))->>'resultado',   -- datos inválidos
    (public.aplicar_promocion(gen_random_uuid(), pr_todos, p_vip, 400, 'servicio', 'efectivo', '   '))->>'resultado',  -- sin concepto
    (public.aplicar_promocion(gen_random_uuid(), pr_todos, p_vip, 0, 'servicio', 'efectivo', 'x'))->>'resultado',      -- monto 0
    (public.aplicar_promocion(null, pr_todos, p_vip, 100, 'servicio', 'efectivo', 'x'))->>'resultado'];                -- sin clave
  select array_agg(a.id order by a.id) into ap_despues from public.promociones_aplicables(p_inac) a;
  begin insert into pagos (clinica_id, concepto, tipo, monto, metodo_pago, direccion, descuento) values (v_z, 'hack', 'servicio', 50, 'efectivo', 'ingreso', 40); e_pg1 := 'PERMITIDO'; exception when others then e_pg1 := sqlstate; end;
  begin insert into pagos (clinica_id, concepto, tipo, monto, metodo_pago, direccion, promocion_id) values (v_z, 'hack', 'servicio', 50, 'efectivo', 'ingreso', pr_vip); e_pg2 := 'PERMITIDO'; exception when others then e_pg2 := sqlstate; end;
  begin delete from promociones where id = pr_inac; e_borrar_usada := 'PERMITIDO'; exception when others then e_borrar_usada := sqlstate; end;   -- usada: no se puede borrar
  delete from promociones where id = pr_borr; get diagnostics n_borrar_sin_uso = row_count;                                                       -- sin uso: sí
  select count(*) into n_res_filas from public.promociones_resumen();
  select to_jsonb(r) into res_inac from public.promociones_resumen() r where r.promocion_id = pr_inac;
  select to_jsonb(r) into res_todos from public.promociones_resumen() r where r.promocion_id = pr_todos;
  select to_jsonb(r) into res_nuevos from public.promociones_resumen() r where r.promocion_id = pr_nuevos;
  reset role;

  -- ================= ADMIN DE OTRA CLÍNICA (no super) =================
  perform set_config('request.jwt.claims', json_build_object('sub', u_ay, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_ay::text, true);
  set local role authenticated;
  select count(*) into n_ay_prom from promociones where clinica_id = v_z;
  begin update promociones set estado = 'pausada' where id = pr_todos; get diagnostics n_ay_upd = row_count; exception when others then n_ay_upd := -1; end;
  begin delete from promociones where id = pr_todos; get diagnostics n_ay_del = row_count; exception when others then n_ay_del := -1; end;
  select count(*) into n_ay_res from public.promociones_resumen();
  select count(*) into n_ay_aplic from public.promociones_aplicables(p_inac);
  e_ay_apl := (public.aplicar_promocion(gen_random_uuid(), pr_todos, p_vip, 100, 'servicio', 'efectivo', 'x'))->>'resultado';
  begin update clinicas set promo_frecuencia_dias = 1 where id = v_z; get diagnostics n_ay_freq = row_count; exception when others then n_ay_freq := -1; end;
  reset role;

  -- ================= ANÓNIMO y DEFINICIONES EN LA BASE =================
  set local role anon;
  begin perform public.mis_promociones(); e_anon1 := 'PERMITIDO'; exception when others then e_anon1 := sqlstate; end;
  begin perform public.promocion_para_banner(); e_anon2 := 'PERMITIDO'; exception when others then e_anon2 := sqlstate; end;
  reset role;
  begin insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, descuento, metodo_pago, direccion, promocion_id) values (v_z, p_inac, 'dup', 'servicio', 10, 1, 'efectivo', 'ingreso', pr_inac); e_dup := 'PERMITIDO';
  exception when unique_violation then e_dup := 'bloqueado'; end;
  begin insert into pagos (clinica_id, concepto, tipo, monto, descuento, metodo_pago, direccion) values (v_z, 'sin origen', 'servicio', 10, 5, 'efectivo', 'ingreso'); e_chk := 'PERMITIDO';
  exception when check_violation then e_chk := 'bloqueado'; end;
  select * into f1 from public.crm_calcular(v_z, p_inac);
  select * into f2 from public.crm_calcular(v_z, p_vip);
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  set local role authenticated;
  select * into g1 from public.crm_clientes() c where c.paciente_id = p_inac;
  select * into g2 from public.crm_clientes() c where c.paciente_id = p_vip;
  reset role;

  -- ================= EVALUACIÓN =================
  v_out := E'--- PROMOCIONES: vigencia y elegibilidad ---\n';
  v_out := v_out || pg_temp.chk('cliente INACTIVA: ve su promo de inactivos y la de todos; NO ve nuevos, VIP, expirada, futura, borrador, pausada ni la de otra clínica', l_inac = (select array_agg(x order by x) from unnest(array[pr_inac, pr_todos]) x));
  v_out := v_out || pg_temp.chk('cliente NUEVA (con avisos apagados): ve la de nuevos y la de todos', l_nuevo = (select array_agg(x order by x) from unnest(array[pr_nuevos, pr_todos]) x));
  v_out := v_out || pg_temp.chk('cliente VIP: ve la de VIP y la de todos', l_vip = (select array_agg(x order by x) from unnest(array[pr_vip, pr_todos]) x));
  v_out := v_out || pg_temp.chk('cliente de OTRA clínica: solo ve la de su negocio', l_y = array[pr_y]);
  v_out := v_out || pg_temp.chk('el negocio ve que 2 promociones son aplicables a la inactiva (inactivos + todos)', ap_antes = (select array_agg(x order by x) from unnest(array[pr_inac, pr_todos]) x));
  v_out := v_out || E'--- AVISO CONTROLADO (no invasivo) ---\n';
  v_out := v_out || pg_temp.chk('primer aviso: la promoción que vence primero (la de inactivos)', b1 = array[pr_inac]);
  v_out := v_out || pg_temp.chk('refresh inmediato: NO se repite ni aparece otra promoción', b2 is null);
  v_out := v_out || pg_temp.chk('se registra cuántas veces se mostró (1)', veces_b1 = 1, veces_b1::text);
  v_out := v_out || pg_temp.chk('pasada la ventana de 3 días y sin actuar: se le vuelve a avisar de la misma', b3 = array[pr_inac]);
  v_out := v_out || pg_temp.chk('una promoción VISTA deja de ser aviso: sigue la siguiente', b4 = array[pr_todos] and estado_vista = 'vista', coalesce(estado_vista, 'null'));
  v_out := v_out || pg_temp.chk('DESCARTAR: desaparece de su lista y queda registrada como descartada', not (pr_todos = any(l_inac_tras)) and pr_inac = any(l_inac_tras) and estado_desc = 'descartada');
  v_out := v_out || pg_temp.chk('con "Promociones y ofertas" apagado no recibe avisos (la lista sigue disponible)', b_off is null and array_length(l_nuevo, 1) = 2);
  v_out := v_out || pg_temp.chk('cliente VIP: el aviso es su promoción VIP (vence primero que la de todos)', b_vip = array[pr_vip]);
  v_out := v_out || pg_temp.chk('el cliente NO puede marcar una promoción como utilizada, ni una que no le corresponde, ni una de otra clínica',
    e_acc = 'accion_invalida' and e_nodisp = 'no_disponible' and e_nodisp_y = 'no_disponible', e_acc || '/' || e_nodisp || '/' || e_nodisp_y);
  v_out := v_out || E'--- USO (aplicar en un cobro) ---\n';
  v_out := v_out || pg_temp.chk('15 % de L400 = L60 de descuento; el servidor lo calcula; se cobra L340', jx->>'resultado' = 'ok' and (jx->>'descuento')::numeric = 60 and (jx->>'cobrado')::numeric = 340, jx::text);
  v_out := v_out || pg_temp.chk('el cobro queda con monto 340, descuento 60, ligado a la promoción y con su título como justificación', pg.monto = 340 and pg.descuento = 60 and pg.promocion_id = pr_inac and pg.concepto like '%Promoción: Te extrañamos%', pg.concepto);
  v_out := v_out || pg_temp.chk('reintento con la misma clave: misma venta, sin duplicar el cobro', jx2->>'repetido' = 'true' and jx2->>'pago_id' = jx->>'pago_id' and n_pagos_clave = 1);
  v_out := v_out || pg_temp.chk('segundo uso con otra clave: ya_utilizada (una vez por cliente)', jx3->>'resultado' = 'ya_utilizada', jx3::text);
  v_out := v_out || pg_temp.chk('rechazos: no elegible, expirada, futura, borrador, pausada, de otra clínica, cliente de otra clínica',
    r_nodo[1] = 'no_elegible' and r_nodo[2] = 'no_vigente' and r_nodo[3] = 'no_vigente' and r_nodo[4] = 'no_vigente' and r_nodo[5] = 'no_vigente' and r_nodo[6] = 'no_encontrada' and r_nodo[7] = 'cliente_invalido', array_to_string(r_nodo[1:7], '/'));
  v_out := v_out || pg_temp.chk('validaciones: datos inválidos, sin concepto, monto 0, sin clave', r_nodo[8] = 'datos_invalidos' and r_nodo[9] = 'concepto_requerido' and r_nodo[10] = 'monto_invalido' and r_nodo[11] = 'clave_requerida', array_to_string(r_nodo[8:11], '/'));
  v_out := v_out || pg_temp.chk('tras usarla, ya no es aplicable a ese cliente (pero sí las demás)', ap_despues = array[pr_todos]);
  v_out := v_out || pg_temp.chk('el negocio NO puede escribir descuentos ni ligar promociones directo en pagos (42501)', e_pg1 = '42501' and e_pg2 = '42501', e_pg1 || '/' || e_pg2);
  v_out := v_out || pg_temp.chk('la base impide un segundo cobro con la misma promoción para el mismo cliente (índice único)', e_dup = 'bloqueado', e_dup);
  v_out := v_out || pg_temp.chk('la base rechaza un descuento sin canje ni promoción (restricción)', e_chk = 'bloqueado', e_chk);
  v_out := v_out || pg_temp.chk('una promoción ya usada no se puede borrar; una sin uso sí', e_borrar_usada = '23514' and n_borrar_sin_uso = 1, e_borrar_usada || '/' || n_borrar_sin_uso);
  v_out := v_out || E'--- VALIDACIONES AL CREAR ---\n';
  v_out := v_out || pg_temp.chk('descuento 0 % o 101 %, fechas invertidas, segmento inventado y título vacío: rechazados', e_val_pct0 = 'bloqueado' and e_val_pct101 = 'bloqueado' and e_val_fechas = 'bloqueado' and e_val_seg = 'bloqueado' and e_val_titulo = 'bloqueado');
  v_out := v_out || pg_temp.chk('un admin NO puede crear promociones para otra clínica', e_otra_clinica = '42501', e_otra_clinica);
  v_out := v_out || pg_temp.chk('la frecuencia debe ser de 1 a 365 días', e_freq0 = 'bloqueado');
  v_out := v_out || E'--- CONTADORES Y UNA SOLA DEFINICIÓN DE SEGMENTOS ---\n';
  v_out := v_out || pg_temp.chk('el resumen solo trae las 7 promociones de este negocio (8 − la borrada)', n_res_filas = 7, n_res_filas::text);
  v_out := v_out || pg_temp.chk('elegibles de "inactivos" = clientes inactivos de crm_clientes; "nuevos" = es_nuevo; "todos" = todos', (res_inac->>'elegibles')::int = n_crm_inac and (res_nuevos->>'elegibles')::int = n_crm_nuevos and (res_todos->>'elegibles')::int = n_crm_todos,
    (res_inac->>'elegibles') || '=' || n_crm_inac || ' · ' || (res_nuevos->>'elegibles') || '=' || n_crm_nuevos || ' · ' || (res_todos->>'elegibles') || '=' || n_crm_todos);
  v_out := v_out || pg_temp.chk('contadores de uso: inactivos → 1 vista y 1 utilizada; todos → 1 descartada', (res_inac->>'vistas')::int = 1 and (res_inac->>'utilizadas')::int = 1 and (res_todos->>'descartadas')::int = 1);
  v_out := v_out || pg_temp.chk('crm_calcular (un cliente) coincide con crm_clientes (lista) en todos los indicadores', f1.es_inactivo = g1.es_inactivo and f1.es_nuevo = g1.es_nuevo and f1.es_vip = g1.es_vip and f1.sin_proxima_cita = g1.sin_proxima_cita
    and f2.es_vip = g2.es_vip and f2.nivel = g2.nivel and f1.puntos = g1.puntos and f1.es_inactivo and f2.es_vip);
  v_out := v_out || E'--- SEGURIDAD ---\n';
  v_out := v_out || pg_temp.chk('el cliente NO lee la tabla de promociones ni puede crear, ni escribir estados (42501)', n_prom_cli = 0 and e_ins_prom = '42501' and e_ins_pc = '42501' and e_upd_pc = '42501', n_prom_cli || '/' || e_ins_prom || '/' || e_ins_pc || '/' || e_upd_pc);
  v_out := v_out || pg_temp.chk('el cliente NO puede aplicar promociones ni ver contadores ni la lista del negocio', e_apl_cli = 'No autorizado' and e_res_cli = 'No autorizado' and e_aplic_cli = 'No autorizado', e_apl_cli || '/' || e_res_cli || '/' || e_aplic_cli);
  v_out := v_out || pg_temp.chk('el cliente NO puede ejecutar el cálculo interno de segmentos (42501)', e_calc = '42501' and e_seg = '42501', e_calc || '/' || e_seg);
  v_out := v_out || pg_temp.chk('el cliente NO puede cambiar la frecuencia de avisos (0 filas)', n_freq_cli = 0, n_freq_cli::text);
  v_out := v_out || pg_temp.chk('la cita reservada desde una promoción de su negocio se guarda; con la de otra clínica se rechaza', e_cita_ok = 'OK' and e_cita_y = 'bloqueado', e_cita_ok || '/' || e_cita_y);
  v_out := v_out || pg_temp.chk('admin de OTRA clínica: no ve, no pausa y no borra promociones ajenas', n_ay_prom = 0 and n_ay_upd = 0 and n_ay_del = 0, n_ay_prom || '/' || n_ay_upd || '/' || n_ay_del);
  v_out := v_out || pg_temp.chk('admin de OTRA clínica: su resumen solo tiene la suya, no ve aplicables ajenas y no puede aplicar promociones ajenas', n_ay_res = 1 and n_ay_aplic = 0 and e_ay_apl = 'no_encontrada', n_ay_res || '/' || n_ay_aplic || '/' || e_ay_apl);
  v_out := v_out || pg_temp.chk('admin de OTRA clínica NO puede cambiar la frecuencia de avisos de este negocio (0 filas)', n_ay_freq = 0, n_ay_freq::text);
  v_out := v_out || pg_temp.chk('anónimo NO puede consultar promociones (42501)', e_anon1 = '42501' and e_anon2 = '42501', e_anon1 || '/' || e_anon2);

  raise exception E'RESULTADOS PROMOCIONES (todo se revierte)\n%', v_out;
end $$;
