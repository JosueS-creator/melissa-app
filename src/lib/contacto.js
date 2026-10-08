import { supabase } from './supabaseClient'

/** Contacto del negocio (teléfono y WhatsApp). Lo administra SOLO Super Administración; el cliente recibe únicamente el de
 * SU clínica mediante contacto_de_mi_clinica(). Sin caché en el navegador: otra sesión nunca ve datos de una anterior. */
export async function obtenerContactoNegocio() {
  const { data, error } = await supabase.rpc('contacto_de_mi_clinica')
  return error ? null : data
}

/** tel: con el número tal como lo escribió el negocio (solo dígitos y "+"): no se adivina el país. */
export const enlaceLlamada = (c) => (c?.telefono_marcar && /^\+?\d{7,15}$/.test(c.telefono_marcar) ? `tel:${c.telefono_marcar}` : null)

/** wa.me con el número que la base ya validó y completó con el código de país; sin texto y sin API. */
export const enlaceWhatsApp = (c) => (c?.whatsapp_wa && /^\d{8,15}$/.test(c.whatsapp_wa) ? `https://wa.me/${c.whatsapp_wa}` : null)

// ---- Validación del formulario de Super Administración (aviso temprano; la base de datos es la fuente de verdad) ----
const digitos = (t) => t.replace(/\D/g, '')
const FORMATO = /^\+?[0-9().\s-]+$/

export function validarTelefono(texto) {
  const t = (texto || '').trim()
  if (!t) return ''
  if (!FORMATO.test(t)) return 'El teléfono solo puede tener números, espacios, guiones, paréntesis y un + al inicio.'
  const n = digitos(t).length
  return n < 7 || n > 15 ? 'El teléfono debe tener entre 7 y 15 dígitos.' : ''
}

export function validarWhatsapp(texto, pais) {
  const t = (texto || '').trim()
  if (!t) return ''
  const formato = validarTelefono(t)
  if (formato) return formato.replace('teléfono', 'WhatsApp')
  const d = digitos(t)
  const largo = (s) => s.length >= 8 && s.length <= 15
  let usable = false
  if (t.startsWith('+')) usable = largo(d)
  else if (d.startsWith('00')) usable = largo(d.slice(2))
  else if (pais === 'HN') usable = (d.length === 8 && /^[23789]/.test(d)) || (d.length === 11 && d.startsWith('504'))
  else if (pais === 'ES') usable = (d.length === 9 && /^[6789]/.test(d)) || (d.length === 11 && d.startsWith('34'))
  return usable ? '' : 'El WhatsApp debe incluir el código de país (por ejemplo +504 9999-0000) o ser un número local válido del país del negocio.'
}
