import { supabase } from './supabaseClient'

/** Todas las consultas del CRM son funciones de la base (crm_*): una sola
 * llamada por pantalla, sin consultas por cliente, y la autorización vive
 * en la base (solo admin del negocio o super admin). */
async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) throw new Error(error.message)
  return data
}

export const obtenerClientesCrm = () => rpc('crm_clientes')
export const obtenerResumenCrm = () => rpc('crm_resumen')
export const obtenerCliente360 = (pacienteId) => rpc('crm_cliente_360', { p_paciente_id: pacienteId })
export const obtenerTimeline = (pacienteId, limite = 30) =>
  rpc('crm_cliente_timeline', { p_paciente_id: pacienteId, p_limite: limite })

/** Segmentos: SQL decide quién pertenece (indicadores es_*); aquí solo se
 * eligen. "Con paquete activo" llega con la Fase E (aún no existen paquetes). */
export const SEGMENTOS = [
  { id: 'todos', etiqueta: 'Todos', ayuda: () => 'Todos los clientes de tu negocio.', filtro: () => true },
  { id: 'nuevos', etiqueta: 'Nuevos', ayuda: () => 'Se registraron en los últimos 30 días.', filtro: (c) => c.es_nuevo },
  { id: 'frecuentes', etiqueta: 'Frecuentes', ayuda: () => '3 o más visitas completadas en los últimos 90 días.', filtro: (c) => c.es_frecuente },
  { id: 'vip', etiqueta: 'VIP', ayuda: () => 'Nivel Oro o Platino.', filtro: (c) => c.es_vip },
  {
    id: 'inactivos',
    etiqueta: 'Inactivos',
    ayuda: (dias) => `Más de ${dias} días sin visitar y sin cita pendiente o confirmada.`,
    filtro: (c) => c.es_inactivo,
  },
  {
    id: 'sin_proxima',
    etiqueta: 'Sin próxima cita',
    ayuda: () => 'Ya vinieron antes, pero no tienen una cita pendiente o confirmada.',
    filtro: (c) => c.sin_proxima_cita,
  },
  {
    id: 'cumple',
    etiqueta: 'Cumpleaños del mes',
    ayuda: () => 'Cumplen años este mes (solo clientes que registraron su fecha).',
    filtro: (c) => c.cumple_este_mes,
  },
  { id: 'membresia', etiqueta: 'Membresía activa', ayuda: () => 'Tienen una membresía vigente.', filtro: (c) => c.membresia_activa },
]

const SIMBOLOS = { HNL: 'L', EUR: '€', USD: '$' }
export const simboloMoneda = (moneda) => SIMBOLOS[moneda] || ''
export const formatearMonto = (valor, moneda) =>
  `${simboloMoneda(moneda)} ${Number(valor || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()

export function formatearFecha(valor, conHora = false) {
  if (!valor) return ''
  // Las fechas sin hora (date) llegan como "YYYY-MM-DD": se leen como locales para evitar el desfase de zona horaria.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00`) : new Date(valor)
  return fecha.toLocaleDateString('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(conHora ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export const textoDias = (dias) => (dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`)

export function ordenarClientes(lista, orden) {
  const copia = [...lista]
  const nulosAlFinal = (a, b, f) => (f(a) == null ? 1 : f(b) == null ? -1 : 0)
  if (orden === 'visita') {
    return copia.sort((a, b) => nulosAlFinal(a, b, (c) => c.ultima_visita) || new Date(b.ultima_visita) - new Date(a.ultima_visita))
  }
  if (orden === 'inactividad') {
    return copia.sort((a, b) => nulosAlFinal(a, b, (c) => c.dias_inactivo) || b.dias_inactivo - a.dias_inactivo)
  }
  if (orden === 'puntos') return copia.sort((a, b) => Number(b.puntos) - Number(a.puntos))
  return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
