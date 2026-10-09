-- PRUEBAS · soporte de datos del rediseño de Inicio (servicios.imagen_url y token puntos_gradiente). Se revierte sola.
do $$
declare
  v_s uuid; v_clinica uuid; u uuid := gen_random_uuid();
  e_js text; e_data text; e_http text; ok_ruta text; ok_https text; ok_null text; leido text; tok text; cols text; v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;
  select id, clinica_id into v_s, v_clinica from servicios limit 1;
  begin update servicios set imagen_url = 'javascript:alert(1)' where id = v_s; e_js := 'PERMITIDO'; exception when check_violation then e_js := 'rechazado'; end;
  begin update servicios set imagen_url = 'data:image/png;base64,AAAA' where id = v_s; e_data := 'PERMITIDO'; exception when check_violation then e_data := 'rechazado'; end;
  begin update servicios set imagen_url = 'http://sitio.test/a.jpg' where id = v_s; e_http := 'PERMITIDO'; exception when check_violation then e_http := 'rechazado'; end;
  begin update servicios set imagen_url = '/muestras/limpieza-facial.jpg' where id = v_s; ok_ruta := 'aceptado'; exception when others then ok_ruta := 'RECHAZADO'; end;
  begin update servicios set imagen_url = 'https://cdn.sitio.test/a.jpg' where id = v_s; ok_https := 'aceptado'; exception when others then ok_https := 'RECHAZADO'; end;
  begin update servicios set imagen_url = null where id = v_s; ok_null := 'aceptado'; exception when others then ok_null := 'RECHAZADO'; end;
  update servicios set imagen_url = '/muestras/x.jpg' where id = v_s;
  insert into auth.users (id, email, raw_user_meta_data) values (u, 'zz-img@x.test', jsonb_build_object('clinica_id', v_clinica, 'nombre', 'ZZ'));
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  select imagen_url into leido from servicios where id = v_s;
  reset role;
  select tokens->>'puntos_gradiente' into tok from temas_base where nombre = 'Rosa y Oro';
  select string_agg(nombre, ', ') into cols from temas_base where tokens ? 'puntos_gradiente';
  v_out := v_out || pg_temp.chk('rechaza direcciones peligrosas o inseguras (javascript:, data:, http:)', e_js = 'rechazado' and e_data = 'rechazado' and e_http = 'rechazado', e_js || '/' || e_data || '/' || e_http);
  v_out := v_out || pg_temp.chk('acepta una ruta del propio app, una URL https y dejarla vacía', ok_ruta = 'aceptado' and ok_https = 'aceptado' and ok_null = 'aceptado');
  v_out := v_out || pg_temp.chk('el cliente de la clínica lee la foto del servicio (política de catálogo existente)', leido = '/muestras/x.jpg', coalesce(leido, 'null'));
  v_out := v_out || pg_temp.chk('solo el tema Rosa y Oro define el degradado de puntos; los demás temas conservan su fondo oscuro', tok like 'linear-gradient(135deg,#8E2255%' and cols = 'Rosa y Oro', coalesce(cols, 'ninguno'));
  raise exception E'RESULTADOS REDISEÑO DE INICIO (todo se revierte)\n%', v_out;
end $$;
