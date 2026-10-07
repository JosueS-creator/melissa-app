-- (aplicada como "fase_a_clinicas_visibles_bloqueo_funcional")
-- El super admin ve TODAS las clínicas (también las bloqueadas) y los miembros
-- de un negocio siempre pueden leer el suyo, aunque esté bloqueado: sin esto,
-- bloquear era imposible y la pantalla "Acceso suspendido" nunca se mostraba.
create policy super_admin_lee_clinicas on clinicas for select to authenticated
  using (es_super_admin_global());
create policy miembros_ven_su_clinica on clinicas for select to authenticated
  using (id = clinica_actual());
