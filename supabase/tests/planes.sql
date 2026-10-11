-- ============================================================
-- PRUEBAS · PLANES Y FUNCIONES (starter / pro / clinic_plus). Crean negocios y usuarios de prueba y los REVIERTEN solos.
-- ============================================================
do $$
declare
  v_sup uuid; v_a uuid; v_b uuid; v_c uuid;
  adm_a uuid := gen_random_uuid(); cli_a uuid := gen_random_uuid(); adm_b uuid := gen_random_uuid(); cli_b uuid := gen_random_uuid(); adm_c uuid := gen_random_uuid();
  fa jsonb; fb jsonb; fc jsonb; r record; args text; msg text; bloqueadas int := 0; pasan int := 0; lista_fallos text := '';
  n_prod_cli_a bigint; n_prod_cli_b bigint; e_ins_prod_a text; e_ins_promo_a text; ok_ins_prod_b text; n_super_ve bigint; n_datos_a bigint;
  e_plan_admin text; plan_tras_admin text; ok_plan_super bigint; bloquea_antes boolean; abre_tras_subir boolean; cierra_tras_bajar boolean; datos_siguen bigint;
  n_pf_lee bigint; e_pf_ins text; n_pf_upd bigint; e_exigir text; ok_servicio_a text; n_serv_cli_a bigint; n_anon text;
  v_out text := '';
  funcs text[] := array['crear_pedido','completar_pedido','registrar_venta_producto','anular_pago','solicitar_canje','cancelar_canje','rechazar_canje','aplicar_canje',
    'mis_promociones','promocion_para_banner','marcar_promocion','promociones_resumen','promociones_aplicables','aplicar_promocion','reactivacion_oportunidades','reactivacion_resumen','registrar_contacto_reactivacion'];
  f text;
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;
  -- intenta llamar a una función con argumentos nulos del tipo correcto y devuelve el mensaje de error ('' si no falló)
  create function pg_temp.probar(fn text) returns text language plpgsql as $f$
    declare a text; begin
      select string_agg('null::' || format_type(t, null), ', ') into a from pg_proc p, unnest(p.proargtypes::oid[]) t where p.proname = fn and p.pronamespace = 'public'::regnamespace;
      execute format('select public.%I(%s)', fn, coalesce(a, ''));
      return '';
    exception when others then return sqlerrm; end $f$;

  select id into v_sup from perfiles where es_super_admin limit 1;
  insert into clinicas (nombre, pais, slug, moneda, plan) values ('ZZ Starter', 'HN', 'zz-s-' || substr(gen_random_uuid()::text, 1, 6), 'HNL', 'starter') returning id into v_a;
  insert into clinicas (nombre, pais, slug, moneda, plan) values ('ZZ Pro', 'HN', 'zz-p-' || substr(gen_random_uuid()::text, 1, 6), 'HNL', 'pro') returning id into v_b;
  insert into clinicas (nombre, pais, slug, moneda, plan) values ('ZZ ClinicPlus', 'HN', 'zz-c-' || substr(gen_random_uuid()::text, 1, 6), 'HNL', 'clinic_plus') returning id into v_c;
  insert into auth.users (id, email, raw_user_meta_data) values (adm_a, 'zz-pa@x.test', jsonb_build_object('clinica_id', v_a, 'nombre', 'ZZ Admin A'));
  insert into auth.users (id, email, raw_user_meta_data) values (cli_a, 'zz-ca@x.test', jsonb_build_object('clinica_id', v_a, 'nombre', 'ZZ Cliente A'));
  insert into auth.users (id, email, raw_user_meta_data) values (adm_b, 'zz-pb@x.test', jsonb_build_object('clinica_id', v_b, 'nombre', 'ZZ Admin B'));
  insert into auth.users (id, email, raw_user_meta_data) values (cli_b, 'zz-cb@x.test', jsonb_build_object('clinica_id', v_b, 'nombre', 'ZZ Cliente B'));
  insert into auth.users (id, email, raw_user_meta_data) values (adm_c, 'zz-pc@x.test', jsonb_build_object('clinica_id', v_c, 'nombre', 'ZZ Admin C'));
  update perfiles set rol = 'admin' where id in (adm_a, adm_b, adm_c);
  insert into productos (clinica_id, nombre, categoria, precio) values (v_a, 'ZZ Crema A', 'cremas', 100), (v_b, 'ZZ Crema B', 'cremas', 100);

  -- ===== lo que ve el app: el plan de cada negocio y sus funciones =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm_a, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', adm_a::text, true);
  set local role authenticated;
  fa := public.funciones_de_mi_clinica();
  foreach f in array funcs loop
    msg := pg_temp.probar(f);
    if msg = 'Tu plan no incluye esta función' then bloqueadas := bloqueadas + 1; else lista_fallos := lista_fallos || f || ' → ' || left(msg, 40) || ' | '; end if;
  end loop;
  -- tablas con plan starter: el admin no escribe y el cliente no ve
  begin insert into productos (clinica_id, nombre, categoria, precio) values (v_a, 'ZZ nuevo', 'cremas', 1); e_ins_prod_a := 'PERMITIDO'; exception when others then e_ins_prod_a := sqlstate; end;
  begin insert into promociones (clinica_id, titulo, descuento_porcentaje, segmento, inicio, fin, estado) values (v_a, 'ZZ promo', 10, 'todos', current_date, current_date + 5, 'activa'); e_ins_promo_a := 'PERMITIDO'; exception when others then e_ins_promo_a := sqlstate; end;
  -- lo básico del plan starter sigue funcionando
  begin insert into servicios (clinica_id, nombre, precio) values (v_a, 'ZZ Servicio A', 100); ok_servicio_a := 'ok'; exception when others then ok_servicio_a := sqlstate; end;
  -- un admin NO puede cambiar su propio plan
  begin update clinicas set plan = 'clinic_plus' where id = v_a; e_plan_admin := 'sin error'; exception when others then e_plan_admin := sqlstate; end;
  reset role;
  select plan into plan_tras_admin from clinicas where id = v_a;

  perform set_config('request.jwt.claims', json_build_object('sub', cli_a, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', cli_a::text, true);
  set local role authenticated;
  select count(*) into n_prod_cli_a from productos;
  select count(*) into n_serv_cli_a from servicios where clinica_id = v_a;
  select count(*) into n_pf_lee from plan_funciones;
  begin insert into plan_funciones (plan, funcion) values ('starter', 'tienda'); e_pf_ins := 'PERMITIDO'; exception when others then e_pf_ins := sqlstate; end;
  begin update plan_funciones set funcion = 'x' where plan = 'starter'; get diagnostics n_pf_upd = row_count; exception when others then n_pf_upd := -1; end;
  begin perform public.exigir_funcion('tienda'); e_exigir := 'PERMITIDO'; exception when others then e_exigir := sqlstate; end;
  reset role;

  -- ===== plan pro: las 17 funciones pasan la guardia; las tablas se abren =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm_b, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', adm_b::text, true);
  set local role authenticated;
  fb := public.funciones_de_mi_clinica();
  foreach f in array funcs loop
    msg := pg_temp.probar(f);
    if msg <> 'Tu plan no incluye esta función' then pasan := pasan + 1; end if;
  end loop;
  begin insert into productos (clinica_id, nombre, categoria, precio) values (v_b, 'ZZ nuevo B', 'cremas', 1); ok_ins_prod_b := 'ok'; exception when others then ok_ins_prod_b := sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', cli_b, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', cli_b::text, true);
  set local role authenticated; select count(*) into n_prod_cli_b from productos; reset role;

  -- ===== clinic_plus =====
  perform set_config('request.jwt.claims', json_build_object('sub', adm_c, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', adm_c::text, true);
  set local role authenticated; fc := public.funciones_de_mi_clinica(); reset role;

  -- ===== super admin: ve todo, cambia el plan; subir abre y bajar cierra sin borrar datos =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated;
  select count(*) into n_super_ve from productos where clinica_id = v_a;
  update clinicas set plan = 'pro' where id = v_a; get diagnostics ok_plan_super = row_count;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm_a, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', adm_a::text, true);
  set local role authenticated; abre_tras_subir := pg_temp.probar('reactivacion_resumen') <> 'Tu plan no incluye esta función'; reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated; update clinicas set plan = 'starter' where id = v_a; reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm_a, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', adm_a::text, true);
  set local role authenticated; cierra_tras_bajar := pg_temp.probar('reactivacion_resumen') = 'Tu plan no incluye esta función'; reset role;
  select count(*) into datos_siguen from productos where clinica_id = v_a;

  -- anónimo
  set local role anon;
  begin perform public.funciones_de_mi_clinica(); n_anon := 'PERMITIDO'; exception when others then n_anon := sqlstate; end;
  reset role;

  v_out := E'--- QUÉ INCLUYE CADA PLAN ---\n';
  v_out := v_out || pg_temp.chk('starter: agenda, clientes, historial y fidelización; NO tienda, caja, promociones ni reactivación',
    fa->>'plan' = 'starter' and fa->'funciones' ? 'agenda' and fa->'funciones' ? 'clientes' and fa->'funciones' ? 'historial' and fa->'funciones' ? 'fidelizacion'
    and not (fa->'funciones' ? 'tienda') and not (fa->'funciones' ? 'caja') and not (fa->'funciones' ? 'promociones') and not (fa->'funciones' ? 'reactivacion'), fa->>'funciones');
  v_out := v_out || pg_temp.chk('pro: todo lo de starter MÁS tienda, membresías, canjes, referidos, caja, promociones y reactivación; sin sucursales',
    fb->>'plan' = 'pro' and fb->'funciones' ? 'agenda' and fb->'funciones' ? 'tienda' and fb->'funciones' ? 'membresias' and fb->'funciones' ? 'canjes' and fb->'funciones' ? 'referidos'
    and fb->'funciones' ? 'caja' and fb->'funciones' ? 'promociones' and fb->'funciones' ? 'reactivacion' and not (fb->'funciones' ? 'sucursales'));
  v_out := v_out || pg_temp.chk('clinic_plus: todo lo de pro MÁS sucursales y soporte prioritario', fc->>'plan' = 'clinic_plus' and fc->'funciones' ? 'tienda' and fc->'funciones' ? 'sucursales' and fc->'funciones' ? 'soporte_prioritario');
  v_out := v_out || pg_temp.chk('el app recibe también el cuadro de los 3 planes (para decir «disponible en Pro»)', (select count(*) from jsonb_object_keys(fa->'planes')) = 3);
  v_out := v_out || E'--- EL SERVIDOR BLOQUEA ---\n';
  v_out := v_out || pg_temp.chk('starter: las 17 funciones del servidor de los módulos Pro cortan con «Tu plan no incluye esta función»', bloqueadas = 17, bloqueadas || '/17 ' || lista_fallos);
  v_out := v_out || pg_temp.chk('pro: las 17 funciones pasan la guardia de plan (pueden fallar por otros motivos, p. ej. datos nulos)', pasan = 17, pasan || '/17');
  v_out := v_out || pg_temp.chk('starter: el admin NO puede crear productos ni promociones (el servidor lo rechaza)', e_ins_prod_a = '42501' and e_ins_promo_a = '42501', e_ins_prod_a || '/' || e_ins_promo_a);
  v_out := v_out || pg_temp.chk('starter: el cliente no ve los productos del negocio; en pro sí', n_prod_cli_a = 0 and n_prod_cli_b >= 1, n_prod_cli_a || '/' || n_prod_cli_b);
  v_out := v_out || pg_temp.chk('pro: el admin sí crea productos', ok_ins_prod_b = 'ok', ok_ins_prod_b);
  v_out := v_out || pg_temp.chk('starter conserva lo básico: el admin crea servicios y el cliente los ve', ok_servicio_a = 'ok' and n_serv_cli_a >= 1, ok_servicio_a || '/' || n_serv_cli_a);
  v_out := v_out || pg_temp.chk('el super admin no queda bloqueado: ve los productos de un negocio starter', n_super_ve >= 1, n_super_ve::text);
  v_out := v_out || E'--- CAMBIAR DE PLAN ---\n';
  v_out := v_out || pg_temp.chk('el admin del negocio NO puede cambiar su propio plan', plan_tras_admin = 'starter', e_plan_admin || ' · plan sigue ' || plan_tras_admin);
  v_out := v_out || pg_temp.chk('el super admin sí: subir a pro abre los módulos; bajar a starter los vuelve a cerrar', ok_plan_super = 1 and abre_tras_subir and cierra_tras_bajar, abre_tras_subir::text || '/' || cierra_tras_bajar::text);
  v_out := v_out || pg_temp.chk('al bajar de plan los datos se conservan (solo quedan bloqueados)', datos_siguen >= 1, datos_siguen::text);
  v_out := v_out || E'--- PERMISOS ---\n';
  v_out := v_out || pg_temp.chk('el cuadro de planes se puede leer, pero nadie con sesión lo puede modificar', n_pf_lee > 0 and e_pf_ins = '42501' and n_pf_upd <= 0, n_pf_lee || '/' || e_pf_ins || '/' || n_pf_upd);
  v_out := v_out || pg_temp.chk('la guardia interna no se puede llamar desde fuera (42501); un anónimo tampoco consulta el plan', e_exigir = '42501' and n_anon = '42501', e_exigir || '/' || n_anon);

  raise exception E'RESULTADOS PLANES Y FUNCIONES (todo se revierte)\n%', v_out;
end $$;
