-- Endurecimiento: las funciones auxiliares puras (sin acceso a tablas) fijan un search_path vacío, como
-- recomienda el asesor de seguridad de Supabase. Solo usan funciones y operadores de pg_catalog.
alter function public.telefono_whatsapp(text, text) set search_path = '';
alter function public.promo_aplica_segmento(text, boolean, boolean, boolean, boolean, boolean, boolean, boolean) set search_path = '';
alter function public.reactivacion_limite_diario() set search_path = '';
alter function public.reactivacion_cooldown_dias() set search_path = '';
alter function public.reactivacion_ventana_regreso_dias() set search_path = '';
