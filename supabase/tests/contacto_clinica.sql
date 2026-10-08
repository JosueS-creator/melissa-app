-- ============================================================
-- PRUEBAS · DATOS DE CONTACTO DE LA CLÍNICA (administrados solo por Super Administración)
-- Crean negocios, usuarios y datos de prueba y los REVIERTEN solos (error forzado final). Cada línea: OK o FALLA.
-- ============================================================
do $$
declare
  v_sup uuid; v_za uuid; v_zb uuid; v_zc uuid; ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); aa uuid := gen_random_uuid();
  j_a jsonb; j_b jsonb; j_a_null jsonb; j_adm jsonb; j_super_prop jsonb;
  e_s1 text; e_s2 text; e_tel_letras text; e_tel_corto text; e_tel_mas text; e_wa_corto text; e_wa_hn_1 text; e_wa_letras text; e_wa_ok_plus text; e_wa_es_local text;
  r_vacio record; n_cascada bigint; ts1 timestamptz; ts2 timestamptz; quien uuid; filas_antes bigint;
  n_adm_sel bigint; e_adm_ins text; n_adm_upd bigint; n_adm_del bigint; n_cli_sel bigint; e_cli_ins text; n_cli_upd bigint; n_cli_del bigint; n_uy_sel bigint;
  e_anon_rpc text; e_anon_sel text; claves_clinica text; args text; n_cols_contacto bigint; fila_clinica_cliente jsonb; n_otras_clinicas bigint; hay_numeros_ajenos boolean; e_adm_clinicas text;
  v_out text := '';
begin
  create function pg_temp.chk(n text, ok boolean, extra text default '') returns text language sql as
    $f$ select case when coalesce(ok,false) then 'OK    ' else 'FALLA ' end || n || case when extra <> '' then '   [' || extra || ']' else '' end || E'\n' $f$;

  select id into v_sup from perfiles where es_super_admin limit 1;
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Negocio A', 'HN', 'zz-a-' || substr(gen_random_uuid()::text, 1, 6), 'HNL') returning id into v_za;
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Negocio B', 'ES', 'zz-b-' || substr(gen_random_uuid()::text, 1, 6), 'EUR') returning id into v_zb;
  insert into clinicas (nombre, pais, slug, moneda) values ('ZZ Negocio C (sin usuarios)', 'HN', 'zz-c-' || substr(gen_random_uuid()::text, 1, 6), 'HNL') returning id into v_zc;
  insert into auth.users (id, email, raw_user_meta_data) values (ua, 'zz-ca@x.test', jsonb_build_object('clinica_id', v_za, 'nombre', 'ZZ Cliente A'));
  insert into auth.users (id, email, raw_user_meta_data) values (ub, 'zz-cb@x.test', jsonb_build_object('clinica_id', v_zb, 'nombre', 'ZZ Cliente B'));
  insert into auth.users (id, email, raw_user_meta_data) values (aa, 'zz-aa@x.test', jsonb_build_object('clinica_id', v_za, 'nombre', 'ZZ Admin A'));
  update perfiles set rol = 'admin' where id = aa;

  -- ================= SUPER ADMINISTRACIÓN =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated;
  insert into clinica_contacto (clinica_id, telefono_contacto, whatsapp_contacto) values (v_za, '+504 2222-3333', '9999-0000');          -- teléfono y WhatsApp (local de Honduras)
  insert into clinica_contacto (clinica_id, telefono_contacto, whatsapp_contacto) values (v_zc, '2233-4455', null);                         -- solo teléfono
  insert into clinica_contacto (clinica_id, telefono_contacto, whatsapp_contacto) values (v_zb, '91 234 56 78', '612 345 678');           -- España: local de 9 dígitos
  select actualizado_at, actualizado_por into ts1, quien from clinica_contacto where clinica_id = v_za;
  begin insert into clinica_contacto (clinica_id, telefono_contacto, whatsapp_contacto) values (gen_random_uuid(), '2222-3333', null); e_s1 := 'PERMITIDO'; exception when others then e_s1 := sqlstate; end;   -- negocio inexistente
  -- validaciones (sobre una fila existente, con savepoint por intento)
  begin update clinica_contacto set telefono_contacto = 'abc' where clinica_id = v_za; e_tel_letras := 'PERMITIDO'; exception when others then e_tel_letras := sqlstate; end;
  begin update clinica_contacto set telefono_contacto = '123' where clinica_id = v_za; e_tel_corto := 'PERMITIDO'; exception when others then e_tel_corto := sqlstate; end;
  begin update clinica_contacto set telefono_contacto = '12+3456789' where clinica_id = v_za; e_tel_mas := 'PERMITIDO'; exception when others then e_tel_mas := sqlstate; end;
  begin update clinica_contacto set whatsapp_contacto = '1234' where clinica_id = v_za; e_wa_corto := 'PERMITIDO'; exception when others then e_wa_corto := sqlstate; end;
  begin update clinica_contacto set whatsapp_contacto = '12345678' where clinica_id = v_za; e_wa_hn_1 := 'PERMITIDO'; exception when others then e_wa_hn_1 := sqlstate; end;   -- local HN que no empieza por 2,3,7,8,9
  begin update clinica_contacto set whatsapp_contacto = 'llamar al 9999' where clinica_id = v_za; e_wa_letras := 'PERMITIDO'; exception when others then e_wa_letras := sqlstate; end;
  begin update clinica_contacto set whatsapp_contacto = '+1 (555) 123-4567' where clinica_id = v_za; e_wa_ok_plus := 'ok'; exception when others then e_wa_ok_plus := sqlstate; end;   -- código de país escrito: se respeta
  begin update clinica_contacto set whatsapp_contacto = '9999-0000' where clinica_id = v_za; exception when others then null; end;                                                         -- vuelve al valor local
  begin update clinica_contacto set whatsapp_contacto = '999999999' where clinica_id = v_zb; e_wa_es_local := 'PERMITIDO'; exception when others then e_wa_es_local := sqlstate; end;      -- ES local no empieza por 6-9? sí (9): válido
  update clinica_contacto set whatsapp_contacto = '612 345 678' where clinica_id = v_zb;
  reset role;

  -- contacto de cada negocio, tal como lo recibe su cliente
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  j_a := public.contacto_de_mi_clinica();
  select count(*) into n_cli_sel from clinica_contacto;
  begin insert into clinica_contacto (clinica_id, telefono_contacto) values (v_za, '1111-1111'); e_cli_ins := 'PERMITIDO'; exception when others then e_cli_ins := sqlstate; end;
  update clinica_contacto set telefono_contacto = '0000-0000' where clinica_id = v_za; get diagnostics n_cli_upd = row_count;
  delete from clinica_contacto where clinica_id = v_za; get diagnostics n_cli_del = row_count;
  select to_jsonb(c) into fila_clinica_cliente from clinicas c where c.id = v_za;
  select count(*) into n_otras_clinicas from clinicas where id <> v_za;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  j_b := public.contacto_de_mi_clinica();
  select count(*) into n_uy_sel from clinica_contacto;
  reset role;

  -- ================= ADMINISTRADOR NORMAL del negocio A =================
  perform set_config('request.jwt.claims', json_build_object('sub', aa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', aa::text, true);
  set local role authenticated;
  select count(*) into n_adm_sel from clinica_contacto;
  begin insert into clinica_contacto (clinica_id, telefono_contacto) values (v_zb, '1111-1111'); e_adm_ins := 'PERMITIDO'; exception when others then e_adm_ins := sqlstate; end;
  update clinica_contacto set telefono_contacto = '0000-0000' where clinica_id = v_za; get diagnostics n_adm_upd = row_count;
  delete from clinica_contacto where clinica_id = v_za; get diagnostics n_adm_del = row_count;
  j_adm := public.contacto_de_mi_clinica();
  begin update clinicas set nombre = nombre where id = v_za; e_adm_clinicas := 'ok'; exception when others then e_adm_clinicas := sqlstate; end;
  reset role;

  -- ================= SIN DATOS: se quitan ambos y el cliente no recibe nada =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated;
  update clinica_contacto set telefono_contacto = '  ', whatsapp_contacto = '' where clinica_id = v_za;
  select telefono_contacto, whatsapp_contacto, actualizado_at into r_vacio from clinica_contacto where clinica_id = v_za;
  ts2 := r_vacio.actualizado_at;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  j_a_null := public.contacto_de_mi_clinica();
  reset role;

  -- ================= ANÓNIMO y ESTRUCTURA =================
  set local role anon;
  begin perform public.contacto_de_mi_clinica(); e_anon_rpc := 'PERMITIDO'; exception when others then e_anon_rpc := sqlstate; end;
  begin perform count(*) from clinica_contacto; e_anon_sel := 'PERMITIDO'; exception when others then e_anon_sel := sqlstate; end;
  reset role;
  select string_agg(column_name, ',') into claves_clinica from information_schema.columns where table_schema = 'public' and table_name = 'clinicas' and (column_name ilike '%tel%' or column_name ilike '%whats%' or column_name ilike '%contact%');
  select pg_get_function_arguments('public.contacto_de_mi_clinica()'::regprocedure) into args;
  delete from clinicas where id = v_zc;
  select count(*) into n_cascada from clinica_contacto where clinica_id = v_zc;
  hay_numeros_ajenos := (j_a::text like '%612%' or j_a::text like '%345 678%' or j_a::text like '%91 234%' or j_a::text like '%912345678%');

  v_out := E'--- SUPER ADMINISTRACIÓN ---\n';
  v_out := v_out || pg_temp.chk('crea el contacto con teléfono y WhatsApp (Honduras, local) y con ambos de España', j_a->>'telefono' = '+504 2222-3333' and j_a->>'whatsapp' = '9999-0000' and j_b->>'telefono' = '91 234 56 78', coalesce(j_a::text, 'null'));
  v_out := v_out || pg_temp.chk('queda registrado quién y cuándo lo cambió', quien = v_sup and ts1 is not null);
  v_out := v_out || pg_temp.chk('lo edita: acepta un WhatsApp con código de país escrito (+1 …) y vuelve al local', e_wa_ok_plus = 'ok');
  v_out := v_out || pg_temp.chk('puede dejar AMBOS vacíos: espacios y vacío se guardan como "sin dato"', r_vacio.telefono_contacto is null and r_vacio.whatsapp_contacto is null);
  v_out := v_out || pg_temp.chk('rechaza un negocio inexistente', e_s1 = '23503', e_s1);
  v_out := v_out || pg_temp.chk('rechaza teléfonos con letras, muy cortos o con "+" en medio', e_tel_letras = '23514' and e_tel_corto = '23514' and e_tel_mas = '23514', e_tel_letras || '/' || e_tel_corto || '/' || e_tel_mas);
  v_out := v_out || pg_temp.chk('rechaza un WhatsApp que no se pueda usar: muy corto, local de Honduras mal formado o con letras', e_wa_corto = '23514' and e_wa_hn_1 = '23514' and e_wa_letras = '23514', e_wa_corto || '/' || e_wa_hn_1 || '/' || e_wa_letras);
  v_out := v_out || pg_temp.chk('al borrar el negocio se borra su contacto (no quedan datos huérfanos)', n_cascada = 0, n_cascada::text);
  v_out := v_out || E'--- LO QUE RECIBE EL CLIENTE ---\n';
  v_out := v_out || pg_temp.chk('cliente de Honduras: teléfono listo para marcar y WhatsApp con código 504', j_a->>'telefono_marcar' = '+50422223333' and j_a->>'whatsapp_wa' = '50499990000', coalesce(j_a::text, 'null'));
  v_out := v_out || pg_temp.chk('cliente de España: WhatsApp local de 9 dígitos con código 34; el teléfono se marca tal como está escrito (no se adivina país)', j_b->>'whatsapp_wa' = '34612345678' and j_b->>'telefono_marcar' = '912345678', coalesce(j_b::text, 'null'));
  v_out := v_out || pg_temp.chk('sin datos configurados: el cliente recibe todo vacío (la app no muestra botones)', j_a_null->>'telefono' is null and j_a_null->>'telefono_marcar' is null and j_a_null->>'whatsapp' is null and j_a_null->>'whatsapp_wa' is null, coalesce(j_a_null::text, 'null'));
  v_out := v_out || E'--- MULTI-CLÍNICA Y PERMISOS ---\n';
  v_out := v_out || pg_temp.chk('el cliente del negocio A recibe SOLO su contacto: ningún dato del negocio B; y viceversa', not hay_numeros_ajenos and j_b::text not like '%2222-3333%' and j_b::text not like '%50499990000%', coalesce(j_a::text, 'null'));
  v_out := v_out || pg_temp.chk('la función no recibe parámetros: no hay forma de pedir el contacto de otra clínica', args = '', '"' || coalesce(args, 'null') || '"');
  v_out := v_out || pg_temp.chk('el cliente NO lee la tabla (0 filas) ni escribe: insertar 42501, actualizar y borrar 0 filas', n_cli_sel = 0 and n_uy_sel = 0 and e_cli_ins = '42501' and n_cli_upd = 0 and n_cli_del = 0, n_cli_sel || '/' || e_cli_ins || '/' || n_cli_upd || '/' || n_cli_del);
  v_out := v_out || pg_temp.chk('el administrador NORMAL del negocio NO lee la tabla ni la modifica (insertar 42501, actualizar y borrar 0 filas); solo consulta su contacto con la función',
    n_adm_sel = 0 and e_adm_ins = '42501' and n_adm_upd = 0 and n_adm_del = 0 and j_adm->>'telefono' = '+504 2222-3333', n_adm_sel || '/' || e_adm_ins || '/' || n_adm_upd || '/' || n_adm_del);
  v_out := v_out || pg_temp.chk('el administrador sigue pudiendo editar su propio negocio (la política existente no cambió)', e_adm_clinicas = 'ok', e_adm_clinicas);
  v_out := v_out || pg_temp.chk('anónimo: no puede consultar el contacto ni leer la tabla (42501)', e_anon_rpc = '42501' and e_anon_sel = '42501', e_anon_rpc || '/' || e_anon_sel);
  v_out := v_out || pg_temp.chk('la tabla clinicas (que cualquiera puede leer) NO ganó ninguna columna de contacto', claves_clinica is null and not (fila_clinica_cliente::text ~* 'telefono|whatsapp'), coalesce(claves_clinica, 'ninguna'));

  raise exception E'RESULTADOS CONTACTO DE LA CLÍNICA (todo se revierte)\n%', v_out;
end $$;
