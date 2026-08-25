import { supabase } from './supabaseClient'

/**
 * Resuelve la clínica activa (por slug de subdominio, por ahora recibido
 * como parámetro) e inyecta sus colores como variables CSS en :root.
 * Si la clínica no definió un color propio, usa el default de su tema_base.
 *
 * Temas simples (3 colores) siguen funcionando igual. Temas con tokens
 * extendidos (ej. "Rosa y Oro": fondo oscuro, dorado, tipografías propias)
 * inyectan variables adicionales; los temas que no las definen usan los
 * valores por defecto de index.css sin romperse.
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
  const tokens = tema?.tokens || {}
  const root = document.documentElement

  root.style.setProperty('--color-primary', clinica.color_primario || tema?.color_primario_default)
  root.style.setProperty('--color-secondary', clinica.color_secundario || tema?.color_secundario_default)
  root.style.setProperty('--color-accent', clinica.color_acento || tema?.color_acento_default)

  // Tokens extendidos (opcionales): si el tema no los trae, no se tocan
  // y quedan los defaults de index.css (look "Elegante Dorado" clásico).
  if (tokens.fondo_app) root.style.setProperty('--color-fondo-app', tokens.fondo_app)
  if (tokens.fondo_oscuro) root.style.setProperty('--color-fondo-oscuro', tokens.fondo_oscuro)
  if (tokens.fondo_oscuro_gradiente) root.style.setProperty('--gradiente-fondo-oscuro', tokens.fondo_oscuro_gradiente)
  if (tokens.primario_gradiente) root.style.setProperty('--gradiente-primario', tokens.primario_gradiente)
  if (tokens.dorado) root.style.setProperty('--color-dorado', tokens.dorado)
  if (tokens.dorado_claro) root.style.setProperty('--color-dorado-claro', tokens.dorado_claro)
  if (tokens.dorado_gradiente) root.style.setProperty('--gradiente-dorado', tokens.dorado_gradiente)
  if (tokens.texto_principal) root.style.setProperty('--color-ink', tokens.texto_principal)
  if (tokens.texto_secundario) root.style.setProperty('--color-texto-secundario', tokens.texto_secundario)
  if (tokens.texto_terciario) root.style.setProperty('--color-texto-terciario', tokens.texto_terciario)
  if (tokens.borde_tarjeta) root.style.setProperty('--color-borde-tarjeta', tokens.borde_tarjeta)
  if (tokens.fuente_titulo) root.style.setProperty('--font-display', `'${tokens.fuente_titulo}', serif`)
  if (tokens.fuente_cuerpo) root.style.setProperty('--font-body', `'${tokens.fuente_cuerpo}', sans-serif`)

  return clinica
}
