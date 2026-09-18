import { supabase } from './supabaseClient'

const TABLAS = [
  'perfiles', 'especialistas', 'pacientes', 'citas', 'tratamientos_paciente',
  'membresias', 'paciente_membresias', 'puntos_movimientos', 'productos',
  'pedidos', 'wallet_movimientos', 'referidos', 'servicios', 'pagos',
]

/** Descarga TODA la información de una clínica (pacientes, citas, historial,
 * puntos, ventas, etc.) como un único archivo JSON — la clínica es dueña de
 * los datos de sus propios clientes, no Melissa. */
export async function descargarDatosClinica(clinicaId, nombreClinica) {
  const resultado = {}

  for (const tabla of TABLAS) {
    const { data } = await supabase.from(tabla).select('*').eq('clinica_id', clinicaId)
    resultado[tabla] = data || []
  }

  // pedido_items no tiene clinica_id propio, se filtra vía los pedidos ya obtenidos.
  const idsPedidos = (resultado.pedidos || []).map((p) => p.id)
  if (idsPedidos.length > 0) {
    const { data: items } = await supabase.from('pedido_items').select('*').in('pedido_id', idsPedidos)
    resultado.pedido_items = items || []
  } else {
    resultado.pedido_items = []
  }

  const blob = new Blob([JSON.stringify(resultado, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `melissa-datos-${(nombreClinica || 'clinica').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`
  enlace.click()
  URL.revokeObjectURL(url)
}
