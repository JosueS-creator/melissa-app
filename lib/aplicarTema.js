import { supabase } from './supabaseClient'

/**
 * Resuelve la clínica activa (por slug de subdominio, por ahora recibido
 * como parámetro) e inyecta sus colores como variables CSS en :root.
 * Si la clínica no definió un color propio, usa el default de su tema_base.
 */
export async function aplicarTemaDeClinica(slug) {
  const { data: clinica, error } = await supabase
    .from('clinicas')
    .select('*, temas_base(*)')
    .eq('slug', slug)
    .single()

  if (error || !clinica) {
    console.warn('No se pudo cargar la clínica, usando tema por defecto:', error)
    return null
  }

  const tema = clinica.temas_base
  const root = document.documentElement

  root.style.setProperty('--color-primary', clinica.color_primario || tema?.color_primario_default)
  root.style.setProperty('--color-secondary', clinica.color_secundario || tema?.color_secundario_default)
  root.style.setProperty('--color-accent', clinica.color_acento || tema?.color_acento_default)

  return clinica
}
