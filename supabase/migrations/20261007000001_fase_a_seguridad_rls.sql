-- ============================================================
-- MELISSA 1.0 · FASE A · Seguridad y fuente de verdad
-- (aplicada en Supabase como "fase_a_seguridad_rls_y_fuente_de_verdad")
-- Hallazgos comprobados con pruebas de explotación (revertidas):
--   * un cliente podía ponerse rol admin, es_super_admin y otra clinica_id
--   * un cliente podía insertarse puntos, bajar precios, crear citas completadas
--   * servicios/productos/especialistas/membresias: escritura sin exigir admin
--   * admin no veía productos/servicios ocultos (no podía reactivarlos)
-- ============================================================

-- 1. PERFILES: solo datos personales y preferencias son editables
revoke update on perfiles from anon, authenticated;
grant update (nombre, telefono, pais, recordatorios_citas, promociones_ofertas, compartir_fotos_progreso)
  on perfiles to authenticated;
drop policy if exists usuario_inserta_su_perfil on perfiles;
revoke insert, delete on perfiles from anon, authenticated;
drop policy if exists usuario_edita_su_perfil on perfiles;
create policy usuario_edita_su_perfil on perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 2. PACIENTES: columnas editables acotadas; alta de clientes solo por admin
revoke update on pacientes from anon, authenticated;
grant update (nombre, telefono, fecha_nacimiento, tipo_piel, pais) on pacientes to authenticated;
drop policy if exists sistema_crea_pacientes on pacientes;
drop policy if exists paciente_edita_lo_suyo on pacientes;
create policy admin_crea_pacientes on pacientes for insert to authenticated
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy paciente_edita_lo_suyo on pacientes for update to authenticated
  using (clinica_id = clinica_actual() and (perfil_id = (select auth.uid()) or es_admin_clinica()))
  with check (clinica_id = clinica_actual() and (perfil_id = (select auth.uid()) or es_admin_clinica()));

-- 3. CLINICAS: solo el super admin cambia plan, estado, slug y dominio
create or replace function public.proteger_campos_clinica()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is not null and not coalesce(es_super_admin_global(), false) then
    if new.id is distinct from old.id
       or new.plan is distinct from old.plan
       or new.activa is distinct from old.activa
       or new.slug is distinct from old.slug
       or new.dominio_propio is distinct from old.dominio_propio then
      raise exception 'Solo Melissa puede modificar el plan, el estado o el slug del negocio';
    end if;
  end if;
  return new;
end $fn$;
drop trigger if exists proteger_campos_clinica on clinicas;
create trigger proteger_campos_clinica before update on clinicas
  for each row execute function public.proteger_campos_clinica();

-- 4. CATALOGOS: escribir exige ser admin (y el admin ve también lo oculto)
drop policy if exists admin_escribe_servicios on servicios;
drop policy if exists admin_actualiza_servicios on servicios;
drop policy if exists admin_elimina_servicios on servicios;
create policy admin_gestiona_servicios on servicios for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());

drop policy if exists admin_escribe_productos on productos;
drop policy if exists admin_actualiza_productos on productos;
drop policy if exists admin_elimina_productos on productos;
create policy admin_gestiona_productos on productos for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());

drop policy if exists admin_escribe_especialistas on especialistas;
drop policy if exists admin_actualiza_especialistas on especialistas;
drop policy if exists admin_elimina_especialistas on especialistas;
create policy admin_gestiona_especialistas on especialistas for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());

drop policy if exists admin_escribe_membresias on membresias;
drop policy if exists admin_actualiza_membresias on membresias;
drop policy if exists admin_elimina_membresias on membresias;
create policy admin_gestiona_membresias on membresias for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());

-- 5. CITAS: el cliente solo solicita (pendiente); el resto lo gestiona el admin
drop policy if exists citas_propias_o_admin on citas;
create policy admin_gestiona_citas on citas for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy cliente_ve_sus_citas on citas for select to authenticated
  using (clinica_id = clinica_actual() and paciente_id = paciente_actual());
create policy cliente_solicita_cita on citas for insert to authenticated
  with check (clinica_id = clinica_actual() and paciente_id = paciente_actual() and estado = 'pendiente');

-- 6. TRATAMIENTOS: el cliente ve y agrega los suyos, no los edita ni borra
drop policy if exists tratamientos_propios_o_admin on tratamientos_paciente;
create policy admin_gestiona_tratamientos on tratamientos_paciente for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy cliente_ve_sus_tratamientos on tratamientos_paciente for select to authenticated
  using (clinica_id = clinica_actual() and paciente_id = paciente_actual());
create policy cliente_agrega_su_progreso on tratamientos_paciente for insert to authenticated
  with check (clinica_id = clinica_actual() and paciente_id = paciente_actual());

-- 7. PUNTOS: libro mayor de solo-anexar, coherente y sin saldo negativo
drop policy if exists puntos_propios_o_admin on puntos_movimientos;
create policy admin_ve_puntos on puntos_movimientos for select to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica());
create policy admin_registra_puntos on puntos_movimientos for insert to authenticated
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy cliente_ve_sus_puntos on puntos_movimientos for select to authenticated
  using (clinica_id = clinica_actual() and paciente_id = paciente_actual());
revoke update, delete on puntos_movimientos from anon, authenticated;
alter table puntos_movimientos add constraint puntos_signo_coherente
  check ((tipo = 'acumulacion' and puntos > 0) or (tipo = 'canje' and puntos < 0) or tipo = 'ajuste');

create or replace function public.validar_saldo_puntos()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_saldo bigint;
begin
  if new.puntos < 0 then
    perform 1 from pacientes where id = new.paciente_id for update;
    select coalesce(sum(puntos), 0) into v_saldo from puntos_movimientos where paciente_id = new.paciente_id;
    if v_saldo + new.puntos < 0 then
      raise exception 'Saldo de puntos insuficiente';
    end if;
  end if;
  return new;
end $fn$;
drop trigger if exists puntos_saldo_no_negativo on puntos_movimientos;
create trigger puntos_saldo_no_negativo before insert on puntos_movimientos
  for each row execute function public.validar_saldo_puntos();

-- 8. RECOMPENSAS: el costo vive en el servidor, no en el navegador
create table if not exists recompensas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references clinicas(id) on delete cascade,
  nombre text not null,
  costo_puntos integer not null check (costo_puntos > 0),
  activa boolean not null default true,
  orden integer not null default 0
);
create index if not exists idx_recompensas_clinica on recompensas(clinica_id);
alter table recompensas enable row level security;
create policy miembros_ven_recompensas on recompensas for select to authenticated
  using (clinica_id = clinica_actual() and (activa or es_admin_clinica()));
create policy admin_gestiona_recompensas on recompensas for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy super_admin_lee_recompensas on recompensas for select to authenticated
  using (es_super_admin_global());

insert into recompensas (clinica_id, nombre, costo_puntos, orden)
select c.id, r.nombre, r.costo, r.orden
from clinicas c
cross join (values ('L 100 de descuento', 300, 1), ('Limpieza facial gratis', 800, 2), ('Sesión de tratamiento gratis', 1500, 3)) as r(nombre, costo, orden)
where not exists (select 1 from recompensas x where x.clinica_id = c.id);

create or replace function public.canjear_recompensa(p_recompensa_id uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_rec recompensas%rowtype;
  v_saldo bigint;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select * into v_rec from recompensas where id = p_recompensa_id and clinica_id = v_clinica and activa;
  if not found then return 'no_disponible'; end if;
  perform 1 from pacientes where id = v_pac for update;
  select coalesce(sum(puntos), 0) into v_saldo from puntos_movimientos where paciente_id = v_pac;
  if v_saldo < v_rec.costo_puntos then return 'puntos_insuficientes'; end if;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo)
  values (v_clinica, v_pac, 'canje', -v_rec.costo_puntos, 'Canje: ' || v_rec.nombre);
  return 'ok';
end $fn$;

-- 9. PEDIDOS: el total y los precios los calcula el servidor
drop policy if exists pedidos_propios_o_admin on pedidos;
create policy cliente_ve_sus_pedidos on pedidos for select to authenticated
  using (clinica_id = clinica_actual() and (paciente_id = paciente_actual() or es_admin_clinica()));
drop policy if exists aislamiento_pedido_items on pedido_items;
create policy ver_items_de_pedidos_visibles on pedido_items for select to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id));
revoke insert, update, delete on pedidos, pedido_items from anon, authenticated;

create or replace function public.crear_pedido(p_items jsonb, p_entrega text default 'domicilio')
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_total numeric := 0;
  v_pedido uuid;
  v_item jsonb;
  v_prod productos%rowtype;
  v_cant int;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  if p_entrega not in ('domicilio', 'recoger_clinica') then raise exception 'Entrega inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Pedido vacío'; end if;

  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado)
  values (v_clinica, v_pac, 0, 'wallet', p_entrega, 'pendiente') returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::int;
    if v_cant is null or v_cant < 1 or v_cant > 100 then raise exception 'Cantidad inválida'; end if;
    select * into v_prod from productos
      where id = (v_item->>'producto_id')::uuid and clinica_id = v_clinica and activo;
    if not found then raise exception 'Producto no disponible'; end if;
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
    values (v_pedido, v_prod.id, v_cant, v_prod.precio);
    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update pedidos set total = v_total where id = v_pedido;
  return jsonb_build_object('pedido_id', v_pedido, 'total', v_total);
end $fn$;

-- 10. REFERIDOS: el cliente solo puede invitar; no puede marcarse recompensado
drop policy if exists referidos_propios_o_admin on referidos;
create policy admin_gestiona_referidos on referidos for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy cliente_ve_sus_referidos on referidos for select to authenticated
  using (clinica_id = clinica_actual() and paciente_referidor_id = paciente_actual());
create policy cliente_invita on referidos for insert to authenticated
  with check (clinica_id = clinica_actual() and paciente_referidor_id = paciente_actual()
              and estado = 'invitado' and paciente_referido_id is null);

-- 11. MEMBRESIAS DE CLIENTE y WALLET: el cliente solo lee
drop policy if exists membresia_propia_o_admin on paciente_membresias;
create policy admin_gestiona_paciente_membresias on paciente_membresias for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy cliente_ve_sus_membresias on paciente_membresias for select to authenticated
  using (clinica_id = clinica_actual() and paciente_id = paciente_actual());

drop policy if exists wallet_propio_o_admin on wallet_movimientos;
create policy admin_gestiona_wallet on wallet_movimientos for all to authenticated
  using (clinica_id = clinica_actual() and es_admin_clinica())
  with check (clinica_id = clinica_actual() and es_admin_clinica());
create policy cliente_ve_su_wallet on wallet_movimientos for select to authenticated
  using (clinica_id = clinica_actual() and paciente_id = paciente_actual());

-- 12. REGISTRO: sin negocio no hay cuenta (se elimina el relleno con 'demo')
create or replace function public.crear_perfil_y_paciente()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_clinica_id uuid;
  v_nombre text;
  v_telefono text;
  v_pais text;
  v_rol text := 'paciente';
  v_codigo_invitacion text;
  v_invitacion_id uuid;
begin
  v_nombre := coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1));
  v_telefono := new.raw_user_meta_data->>'telefono';
  v_pais := new.raw_user_meta_data->>'pais';
  v_codigo_invitacion := new.raw_user_meta_data->>'invitacion_codigo';

  if v_codigo_invitacion is not null then
    select id, clinica_id into v_invitacion_id, v_clinica_id from invitaciones_admin
      where codigo = v_codigo_invitacion and usado = false for update;
    if v_invitacion_id is not null then v_rol := 'admin'; end if;
  end if;

  if v_clinica_id is null then
    v_clinica_id := (new.raw_user_meta_data->>'clinica_id')::uuid;
    if v_clinica_id is null then
      raise exception 'Registro sin negocio: usa el link o el QR de tu negocio';
    end if;
    if not exists (select 1 from clinicas where id = v_clinica_id and activa) then
      raise exception 'Este negocio no está disponible';
    end if;
  end if;

  insert into perfiles (id, clinica_id, nombre, telefono, pais, rol)
  values (new.id, v_clinica_id, v_nombre, v_telefono, v_pais, v_rol)
  on conflict (id) do nothing;

  if v_rol = 'admin' then
    update invitaciones_admin set usado = true, usado_por = new.id where id = v_invitacion_id;
  end if;

  if v_rol = 'paciente' then
    insert into pacientes (clinica_id, perfil_id, nombre, telefono, pais)
    values (v_clinica_id, new.id, v_nombre, v_telefono, v_pais)
    on conflict do nothing;
  end if;

  return new;
end $fn$;

-- 13. FUNCIONES: cerrar el acceso por defecto (PUBLIC) que seguía abierto
revoke all on function public.generar_invitacion_admin(uuid) from public, anon;
grant execute on function public.generar_invitacion_admin(uuid) to authenticated;
revoke all on function public.canjear_recompensa(uuid) from public, anon;
grant execute on function public.canjear_recompensa(uuid) to authenticated;
revoke all on function public.crear_pedido(jsonb, text) from public, anon;
grant execute on function public.crear_pedido(jsonb, text) to authenticated;
