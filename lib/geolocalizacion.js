/**
 * Detecta el país del visitante usando su IP (servicio gratuito, sin API key,
 * sin pedir permiso de ubicación al navegador — solo aproxima por IP).
 * Si falla (sin internet, servicio caído, bloqueado por el navegador),
 * devuelve null y el formulario simplemente no preselecciona nada.
 */
export async function detectarPaisPorIP() {
  try {
    const respuesta = await fetch('https://ipapi.co/json/')
    if (!respuesta.ok) return null
    const datos = await respuesta.json()
    return datos.country_code || null // ej. 'HN', 'ES', 'US'
  } catch {
    return null
  }
}

export const PAISES = [
  { codigo: 'HN', nombre: 'Honduras' },
  { codigo: 'ES', nombre: 'España' },
  { codigo: 'GT', nombre: 'Guatemala' },
  { codigo: 'SV', nombre: 'El Salvador' },
  { codigo: 'NI', nombre: 'Nicaragua' },
  { codigo: 'CR', nombre: 'Costa Rica' },
  { codigo: 'PA', nombre: 'Panamá' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'US', nombre: 'Estados Unidos' },
  { codigo: 'OTRO', nombre: 'Otro país' },
]
