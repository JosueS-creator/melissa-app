-- Cierre de la Fase C: corrige la definición de "regresó después del contacto".
-- Antes solo se exigía que la cita se hubiera CREADO después del contacto; una visita ocurrida ANTES del contacto
-- pero registrada después (registro retroactivo) contaba como regreso. Ahora una cita cuenta solo si:
--   1) es NUEVA: se creó en Melissa después del contacto (no existía antes);
--   2) la VISITA ocurrió después del contacto (fecha_hora ≥ momento del contacto);
--   3) para "regresaron": está COMPLETADA y la visita ocurrió dentro de la ventana inicial de medición (60 días).
-- La ventana de 60 días es una decisión INICIAL de medición, no una verdad sobre cuánto tarda un cliente en volver:
-- se revisará con datos reales. Un cliente cuenta una sola vez. No se atribuyen ingresos ni causalidad.
-- También devuelve dias_inactividad para explicar el criterio en el estado vacío.
create or replace function public.reactivacion_resumen()
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_clinica uuid := clinica_actual();
  v_limite integer := reactivacion_limite_diario();
  v_cool integer := reactivacion_cooldown_dias();
  v_vent integer := reactivacion_ventana_regreso_dias();
  v_dias integer;
  v_usadas integer;
  v_out jsonb;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  select count(*) into v_usadas from crm_reactivaciones r where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours';

  select jsonb_build_object(
    'oportunidades', count(*) filter (where o.telefono_wa is not null),
    'alta', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'alta'),
    'media', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'media'),
    'baja', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'baja'),
    'sin_telefono', count(*) filter (where o.telefono_wa is null))
  into v_out from reactivacion_oportunidades() o;

  v_out := v_out || (select jsonb_build_object(
      'en_pausa', count(*) filter (where b.exclusion = 'en_pausa'),
      'no_desean', count(*) filter (where b.exclusion = 'no_desea'))
    from reactivacion_base(v_clinica) b);

  return v_out || jsonb_build_object(
    'dias_inactividad', v_dias,
    'contactos_24h', v_usadas, 'limite_diario', v_limite, 'restantes', greatest(v_limite - v_usadas, 0),
    'libre_desde', case when v_usadas >= v_limite then
      (select r.created_at + interval '24 hours' from crm_reactivaciones r
        where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours'
        order by r.created_at offset (v_usadas - v_limite) limit 1) end,
    'cooldown_dias', v_cool, 'ventana_dias', v_vent,
    'medicion_desde', (select min(r.created_at) from crm_reactivaciones r where r.clinica_id = v_clinica),
    'acciones_total', (select count(*) from crm_reactivaciones r where r.clinica_id = v_clinica),
    'acciones_con_promocion', (select count(*) from crm_reactivaciones r where r.clinica_id = v_clinica and r.promocion_id is not null),
    'citas_posteriores', (select count(distinct c.paciente_id) from citas c
        join crm_reactivaciones a on a.paciente_id = c.paciente_id and a.clinica_id = v_clinica
         and c.creada_at >= a.created_at and c.creada_at <= a.created_at + make_interval(days => v_vent)
         and c.fecha_hora >= a.created_at
       where c.clinica_id = v_clinica and c.estado <> 'cancelada'),
    'regresaron', (select count(distinct c.paciente_id) from citas c
        join crm_reactivaciones a on a.paciente_id = c.paciente_id and a.clinica_id = v_clinica
         and c.creada_at >= a.created_at
         and c.fecha_hora >= a.created_at and c.fecha_hora <= a.created_at + make_interval(days => v_vent)
       where c.clinica_id = v_clinica and c.estado = 'completada'),
    'promos_usadas', (select count(*) from crm_reactivaciones a
        join promocion_clientes pc on pc.promocion_id = a.promocion_id and pc.paciente_id = a.paciente_id and pc.estado = 'utilizada'
         and pc.utilizada_at >= a.created_at and pc.utilizada_at <= a.created_at + make_interval(days => v_vent)
       where a.clinica_id = v_clinica and a.promocion_id is not null));
end $fn$;
