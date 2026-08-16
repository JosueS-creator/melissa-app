import { supabase } from './supabaseClient'

/**
 * Calcula el Beauty Score (0-100) de un paciente a partir de su actividad
 * real: constancia en citas, qué tan reciente fue su última visita, compras
 * en tienda y puntos acumulados. No es una medida clínica de la piel — es
 * una métrica de compromiso/constancia con su cuidado, pensada para dar
 * una razón de volver a abrir la app aunque no tenga cita pronto.
 *
 * Composición (máx. 100):
 *  - Citas completadas:   hasta 40 pts (8 pts por cita, tope 5 citas)
 *  - Recencia de visita:  hasta 25 pts (decrece mientras más tiempo pasa)
 *  - Compras en tienda:   hasta 20 pts (5 pts por pedido, tope 4 pedidos)
 *  - Puntos acumulados:   hasta 15 pts (1 pt por cada 50 puntos, tope 15)
 */
export async function calcularBeautyScore(pacienteId) {
  const [{ data: citas }, { data: pedidos }, { data: movimientos }] = await Promise.all([
    supabase.from('citas').select('estado, fecha_hora').eq('paciente_id', pacienteId),
    supabase.from('pedidos').select('id').eq('paciente_id', pacienteId),
    supabase.from('puntos_movimientos').select('puntos').eq('paciente_id', pacienteId),
  ])

  const citasCompletadas = (citas || []).filter((c) => c.estado === 'completada')
  const puntosComponenteCitas = Math.min(citasCompletadas.length * 8, 40)

  let puntosComponenteRecencia = 0
  const fechasCitas = (citas || [])
    .filter((c) => c.estado === 'completada')
    .map((c) => new Date(c.fecha_hora).getTime())
  if (fechasCitas.length > 0) {
    const diasDesdeUltima = (Date.now() - Math.max(...fechasCitas)) / (1000 * 60 * 60 * 24)
    if (diasDesdeUltima <= 30) puntosComponenteRecencia = 25
    else if (diasDesdeUltima <= 60) puntosComponenteRecencia = 15
    else if (diasDesdeUltima <= 90) puntosComponenteRecencia = 8
    else puntosComponenteRecencia = 2
  }

  const puntosComponenteCompras = Math.min((pedidos || []).length * 5, 20)

  const totalPuntos = (movimientos || []).reduce((sum, m) => sum + m.puntos, 0)
  const puntosComponentePuntos = Math.min(Math.floor(Math.max(totalPuntos, 0) / 50), 15)

  const total = puntosComponenteCitas + puntosComponenteRecencia + puntosComponenteCompras + puntosComponentePuntos
  return Math.min(Math.round(total), 100)
}
