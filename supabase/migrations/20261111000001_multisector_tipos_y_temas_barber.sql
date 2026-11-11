-- Melissa multisector: ampliar tipos y registrar temas Barber.
-- Migración incremental; no altera registros existentes ni políticas RLS.

alter table public.clinicas
  drop constraint if exists clinicas_tipo_negocio_check;

alter table public.clinicas
  add constraint clinicas_tipo_negocio_check
  check (tipo_negocio = any (array[
    'clinica_estetica',
    'salon_belleza',
    'salon_unas',
    'spa',
    'barberia',
    'veterinaria',
    'clinica_medica',
    'otro'
  ]::text[]));

insert into public.temas_base
  (id, nombre, color_primario_default, color_secundario_default, color_acento_default, descripcion)
values
  ('barber_grafito', 'Barber · Grafito y acero', '#263238', '#FFFFFF', '#E8EDF0', 'Paleta sobria para barberías'),
  ('barber_azul_noche', 'Barber · Azul noche y plata', '#172554', '#FFFFFF', '#E8EDF5', 'Paleta azul profunda para barberías')
on conflict (id) do update set
  nombre = excluded.nombre,
  color_primario_default = excluded.color_primario_default,
  color_secundario_default = excluded.color_secundario_default,
  color_acento_default = excluded.color_acento_default,
  descripcion = excluded.descripcion;
