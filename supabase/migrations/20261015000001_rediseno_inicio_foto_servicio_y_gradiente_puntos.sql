-- Soporte de datos del rediseño de Inicio (aditivo; no cambia políticas ni funciones).
-- 1) Foto por servicio. Opcional: una ruta del propio app ("/muestras/…") o una URL https. Cualquier otra cosa se rechaza
--    (evita "javascript:" o "data:" en un <img>). Las políticas de servicios no cambian.
alter table public.servicios add column if not exists imagen_url text;
alter table public.servicios add constraint servicios_imagen_url_valida
  check (imagen_url is null or imagen_url ~ '^(https://|/)');

-- 2) Degradado de la tarjeta de Beauty Points como variable del TEMA (igual que el resto de la marca).
--    Solo "Rosa y Oro" (identidad de Melissa) lo define; los demás temas siguen con su fondo oscuro de siempre,
--    porque un degradado claro (p. ej. dorado) con texto blanco no cumpliría el contraste.
update public.temas_base
   set tokens = tokens || jsonb_build_object('puntos_gradiente', 'linear-gradient(135deg,#8E2255 0%,#C93B79 100%)')
 where nombre = 'Rosa y Oro';
