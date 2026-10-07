-- Corrige la política del aviso: UN solo aviso por ventana de frecuencia para el cliente, sea cual sea la
-- promoción. Con la regla por promoción, refrescar mostraba otra promoción distinta cada vez (varios avisos
-- seguidos). Las demás promociones siguen visibles en la lista "Tus beneficios", sin aviso.
create or replace function public.promocion_para_banner()
returns table (id uuid, titulo text, descripcion text, descuento_porcentaje numeric, fin date,
               servicio_id uuid, servicio_nombre text, estado text)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_dias integer;
  v_quiere boolean;
  v_elegida record;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select coalesce(promociones_ofertas, true) into v_quiere from perfiles where id = auth.uid();
  if not coalesce(v_quiere, true) then return; end if;
  select promo_frecuencia_dias into v_dias from clinicas where id = v_clinica;

  -- ya se le mostró algún aviso dentro de la ventana: no se le muestra otro
  if exists (select 1 from promocion_clientes pc
             where pc.paciente_id = v_pac and pc.ultima_vez_mostrada >= now() - make_interval(days => v_dias)) then
    return;
  end if;

  select m.* into v_elegida
  from mis_promociones() m
  where m.estado = 'disponible'
  order by m.fin limit 1;
  if v_elegida.id is null then return; end if;

  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, veces_mostrada, ultima_vez_mostrada)
  values (v_elegida.id, v_clinica, v_pac, 1, now())
  on conflict (promocion_id, paciente_id) do update
    set veces_mostrada = promocion_clientes.veces_mostrada + 1, ultima_vez_mostrada = now();

  id := v_elegida.id; titulo := v_elegida.titulo; descripcion := v_elegida.descripcion;
  descuento_porcentaje := v_elegida.descuento_porcentaje; fin := v_elegida.fin;
  servicio_id := v_elegida.servicio_id; servicio_nombre := v_elegida.servicio_nombre; estado := v_elegida.estado;
  return next;
end $fn$;
