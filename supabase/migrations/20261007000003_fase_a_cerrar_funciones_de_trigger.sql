-- (aplicada como "fase_a_cerrar_funciones_de_trigger")
revoke all on function public.proteger_campos_clinica() from public, anon, authenticated;
revoke all on function public.validar_saldo_puntos() from public, anon, authenticated;
