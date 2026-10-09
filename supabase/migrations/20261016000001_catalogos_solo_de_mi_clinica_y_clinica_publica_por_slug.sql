-- ============================================================
-- Privacidad entre negocios (licencias): nadie fuera de un negocio ve su catálogo,
-- y antes de iniciar sesión solo se puede consultar UN negocio conociendo su slug.
--
-- Antes: servicios, productos, especialistas y membresías activos eran legibles por
-- CUALQUIERA (incluso sin cuenta) de TODOS los negocios: precios, catálogo y nombres
-- del personal de cada cliente de Melissa. La app solo los consulta con sesión iniciada
-- y filtrando por su propia clínica, así que la lectura abierta no era necesaria.
--
-- Ahora:
--   * Catálogo: lo leen solo los usuarios autenticados de ESA clínica (cliente o admin).
--     El admin conserva su política de gestión y el super admin la suya de lectura.
--   * clinica_publica_por_slug(slug): devuelve solo los datos de marca de UN negocio activo
--     (lo que la pantalla de entrada necesita para mostrar su tema) sin plan, umbrales ni
--     configuración interna. Paso previo para cerrar la lectura pública de `clinicas`
--     (migración siguiente, cuando la app ya use esta función).
-- ============================================================

drop policy if exists catalogo_publico_servicios on public.servicios;
drop policy if exists catalogo_publico_productos on public.productos;
drop policy if exists catalogo_publico_especialistas on public.especialistas;
drop policy if exists catalogo_publico_membresias on public.membresias;

create policy catalogo_de_mi_clinica_servicios on public.servicios
  for select to authenticated using (activo = true and clinica_id = clinica_actual());
create policy catalogo_de_mi_clinica_productos on public.productos
  for select to authenticated using (activo = true and clinica_id = clinica_actual());
create policy catalogo_de_mi_clinica_especialistas on public.especialistas
  for select to authenticated using (activo = true and clinica_id = clinica_actual());
create policy catalogo_de_mi_clinica_membresias on public.membresias
  for select to authenticated using (activa = true and clinica_id = clinica_actual());

create or replace function public.clinica_publica_por_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'activa', c.activa,
    'pais', c.pais, 'moneda', c.moneda, 'ciudad', c.ciudad, 'tipo_negocio', c.tipo_negocio,
    'logo_url', c.logo_url, 'fuente', c.fuente,
    'color_primario', c.color_primario, 'color_secundario', c.color_secundario, 'color_acento', c.color_acento,
    'tema_base_id', c.tema_base_id,
    'temas_base', to_jsonb(t))
  from clinicas c
  left join temas_base t on t.id = c.tema_base_id
  where c.slug = lower(trim(p_slug)) and c.activa = true
  limit 1
$$;

revoke all on function public.clinica_publica_por_slug(text) from public;
grant execute on function public.clinica_publica_por_slug(text) to anon, authenticated;
