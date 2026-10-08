-- Ciclo cliente: la política con la que el cliente SOLICITA una cita ahora también exige que
--   1) la fecha sea futura (no se puede solicitar una cita en el pasado), y
--   2) el especialista pertenezca a su misma clínica (antes se podía apuntar a un especialista de otro negocio).
-- Se mantiene la regla existente: el cliente solo solicita (estado 'pendiente', a su nombre y en su clínica);
-- confirmar, completar o cancelar corresponde al negocio. Los administradores no se ven afectados.
drop policy if exists cliente_solicita_cita on public.citas;
create policy cliente_solicita_cita on public.citas
  for insert to authenticated
  with check (
    clinica_id = clinica_actual()
    and paciente_id = paciente_actual()
    and estado = 'pendiente'
    and fecha_hora > now()
    and (especialista_id is null
         or exists (select 1 from public.especialistas e where e.id = especialista_id and e.clinica_id = clinica_actual()))
  );
