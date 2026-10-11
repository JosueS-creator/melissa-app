-- Planes de suscripción (starter / pro / clinic_plus) y qué función desbloquea cada uno.
-- Fuente de verdad: la tabla plan_funciones (datos editables). El servidor BLOQUEA lo que el plan no incluye;
-- el app solo refleja ese resultado. Aditiva: no cambia columnas ni datos de negocios existentes.

-- 1) Qué incluye cada plan ("minimo" = plan más bajo que lo incluye; cada plan incluye lo de los anteriores).
create table if not exists public.plan_funciones (
  plan text not null check (plan in ('starter', 'pro', 'clinic_plus')),
  funcion text not null,
  primary key (plan, funcion)
);
alter table public.plan_funciones enable row level security;
create policy plan_funciones_lectura on public.plan_funciones for select to authenticated using (true);
revoke all on public.plan_funciones from public, anon;
grant select on public.plan_funciones to authenticated;

insert into public.plan_funciones (plan, funcion)
select p.plan, f.funcion
from (values ('starter', 1), ('pro', 2), ('clinic_plus', 3)) as p(plan, nivel)
join (values
  ('agenda', 1), ('clientes', 1), ('empleados', 1), ('servicios', 1), ('historial', 1), ('fidelizacion', 1), ('marca', 1),
  ('tienda', 2), ('membresias', 2), ('canjes', 2), ('referidos', 2), ('caja', 2), ('promociones', 2), ('reactivacion', 2),
  ('sucursales', 3), ('soporte_prioritario', 3)
) as f(funcion, minimo) on p.nivel >= f.minimo
on conflict do nothing;

-- 2) ¿Esa clínica tiene esa función? (según su plan)
create or replace function public.clinica_tiene_funcion(p_clinica uuid, p_funcion text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.clinicas c join public.plan_funciones pf on pf.plan = c.plan
    where c.id = p_clinica and pf.funcion = p_funcion);
$fn$;
revoke all on function public.clinica_tiene_funcion(uuid, text) from public, anon;
grant execute on function public.clinica_tiene_funcion(uuid, text) to authenticated;

-- 3) Lo que ve el app: el plan de MI clínica, sus funciones y el cuadro de planes (para decir "disponible en Pro").
create or replace function public.funciones_de_mi_clinica()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_clinica uuid := public.clinica_actual(); v_plan text;
begin
  if v_clinica is null then return null; end if;
  select c.plan into v_plan from public.clinicas c where c.id = v_clinica;
  return jsonb_build_object(
    'plan', v_plan,
    'funciones', coalesce((select jsonb_agg(pf.funcion order by pf.funcion) from public.plan_funciones pf where pf.plan = v_plan), '[]'::jsonb),
    'planes', (select jsonb_object_agg(s.plan, s.funs) from (select pf.plan, jsonb_agg(pf.funcion order by pf.funcion) as funs from public.plan_funciones pf group by pf.plan) s));
end $fn$;
revoke all on function public.funciones_de_mi_clinica() from public, anon;
grant execute on function public.funciones_de_mi_clinica() to authenticated;

-- 4) Guardia para las funciones del servidor: corta si el plan de quien llama no incluye la función.
create or replace function public.exigir_funcion(p_funcion text)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.clinica_tiene_funcion(public.clinica_actual(), p_funcion) then
    raise exception 'Tu plan no incluye esta función' using errcode = 'P0001', hint = p_funcion;
  end if;
end $fn$;
revoke all on function public.exigir_funcion(text) from public, anon, authenticated;

-- 5) Tablas de cada módulo: política RESTRICTIVA (se suma a las existentes). El super admin queda fuera del bloqueo.
do $$
declare r record;
begin
  for r in select * from (values
    ('productos', 'tienda'), ('pedidos', 'tienda'),
    ('referidos', 'referidos'),
    ('promociones', 'promociones'), ('promocion_clientes', 'promociones'),
    ('recompensas', 'canjes'), ('canjes', 'canjes'),
    ('crm_reactivaciones', 'reactivacion'),
    ('pagos', 'caja'), ('claves_supervisor', 'caja'),
    ('membresias', 'membresias'), ('paciente_membresias', 'membresias')
  ) as t(tabla, funcion) loop
    execute format('drop policy if exists %I on public.%I', 'plan_' || r.funcion, r.tabla);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.es_super_admin_global() or public.clinica_tiene_funcion(clinica_id, %L)) with check (public.es_super_admin_global() or public.clinica_tiene_funcion(clinica_id, %L))',
      'plan_' || r.funcion, r.tabla, r.funcion, r.funcion);
  end loop;
end $$;

-- 6) Funciones del servidor de cada módulo: se les agrega la guardia justo al empezar (el resto del cuerpo no cambia).
do $$
declare r record; v_def text;
begin
  for r in select * from (values
    ('crear_pedido', 'tienda'), ('completar_pedido', 'tienda'),
    ('registrar_venta_producto', 'caja'), ('anular_pago', 'caja'),
    ('solicitar_canje', 'canjes'), ('cancelar_canje', 'canjes'), ('rechazar_canje', 'canjes'), ('aplicar_canje', 'canjes'),
    ('mis_promociones', 'promociones'), ('promocion_para_banner', 'promociones'), ('marcar_promocion', 'promociones'),
    ('promociones_resumen', 'promociones'), ('promociones_aplicables', 'promociones'), ('aplicar_promocion', 'promociones'),
    ('reactivacion_oportunidades', 'reactivacion'), ('reactivacion_resumen', 'reactivacion'), ('registrar_contacto_reactivacion', 'reactivacion')
  ) as t(fn, funcion) loop
    for v_def in select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn loop
      continue when v_def like '%exigir_funcion%';
      execute regexp_replace(v_def, '(\mbegin\M)', E'\\1\n  perform public.exigir_funcion(''' || r.funcion || ''');', 'i');
    end loop;
  end loop;
end $$;
