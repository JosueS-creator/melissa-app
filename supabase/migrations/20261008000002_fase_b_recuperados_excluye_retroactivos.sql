-- Corrige la métrica "clientes recuperados": una visita registrada DESPUÉS de
-- ocurrir (creada_at posterior al día de la cita, p. ej. al importar historial)
-- no es una reserva que haya hecho volver al cliente y no debe contarse.
create or replace function public.crm_resumen(p_clinica_id uuid default null)
returns jsonb language plpgsql stable set search_path = public as $fn$
declare
  v_clinica uuid := coalesce(p_clinica_id, clinica_actual());
  v_dias integer;
  v_out jsonb;
  v_desde timestamptz;
  v_recuperados integer;
begin
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  if v_dias is null then raise exception 'Negocio no encontrado'; end if;

  select jsonb_build_object(
    'total', count(*),
    'nuevos_30d', count(*) filter (where es_nuevo),
    'recurrentes', count(*) filter (where visitas_completadas >= 2),
    'inactivos', count(*) filter (where es_inactivo),
    'sin_proxima_cita', count(*) filter (where sin_proxima_cita),
    'dias_inactividad', v_dias)
  into v_out from crm_clientes(v_clinica);

  -- Recuperado: cita COMPLETADA que se reservó cuando el cliente ya llevaba
  -- `dias_inactividad` días sin visitar, y se reservó antes o el mismo día de la visita.
  select min(c.creada_at) into v_desde from citas c where c.clinica_id = v_clinica and c.creada_at is not null;
  with comp as (
    select c.paciente_id, c.creada_at, c.fecha_hora,
      lag(c.fecha_hora) over (partition by c.paciente_id order by c.fecha_hora) as previa
    from citas c where c.clinica_id = v_clinica and c.estado = 'completada')
  select count(distinct comp.paciente_id)::integer into v_recuperados from comp
  where comp.previa is not null and comp.creada_at is not null
    and comp.creada_at >= comp.previa + make_interval(days => v_dias)
    and comp.creada_at::date <= comp.fecha_hora::date;

  return v_out || jsonb_build_object('recuperados', v_recuperados, 'recuperados_desde', v_desde);
end $fn$;
