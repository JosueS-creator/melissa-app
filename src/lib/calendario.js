import { aIsoLocal, fechaLocal } from './citas.js'

export function sumarDias(fecha, cantidad) {
  const dia = new Date(fecha)
  dia.setDate(dia.getDate() + cantidad)
  return dia
}
export function semanaDe(diaIso) {
  const dia = fechaLocal(diaIso)
  const lunes = sumarDias(dia, -((dia.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => aIsoLocal(sumarDias(lunes, i)))
}
export function rangoSemana(diaIso) {
  const dias = semanaDe(diaIso)
  return { desde: fechaLocal(dias[0]).toISOString(), hasta: sumarDias(fechaLocal(dias[0]), 7).toISOString() }
}
export function duracionCatalogo(cita) {
  const valor = cita.servicios?.duracion_minutos
  return Number.isInteger(valor) && valor > 0 ? valor : null
}
export const horaDe = fecha => new Date(fecha).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', hour12: false })
export const nombreDia = iso => fechaLocal(iso).toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })
export function filtrarProfesional(citas, id) {
  return id === 'todos' ? citas : citas.filter(c => (c.especialista_id || 'sin-asignar') === id)
}

const PALETA = ['#3B6488', '#803B67', '#33745F', '#8B611E', '#66529B', '#9B4C3F', '#337780', '#6B7036', '#5F607E', '#9A4563', '#466835', '#875A40']
export function coloresProfesionales(profesionales) {
  const usados = new Set()
  const colores = { 'sin-asignar': '#6B7280' }
  for (const { id } of [...profesionales].sort((a, b) => a.id.localeCompare(b.id))) {
    const hash = [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 0)
    let posicion = hash % PALETA.length
    if (usados.size < PALETA.length) {
      while (usados.has(posicion)) posicion = (posicion + 1) % PALETA.length
      usados.add(posicion)
      colores[id] = PALETA[posicion]
    } else colores[id] = `hsl(${hash % 360} 38% 36%)`
  }
  return colores
}

/** Segmentos de visualización; la duración del catálogo NO es disponibilidad histórica. */
export function segmentosDelDia(citas, diaIso) {
  const inicio = fechaLocal(diaIso).getTime()
  const fin = sumarDias(fechaLocal(diaIso), 1).getTime()
  return citas.flatMap(cita => {
    const desde = new Date(cita.fecha_hora).getTime()
    const duracion = duracionCatalogo(cita)
    const hasta = desde + (duracion || 30) * 60000
    if (desde >= fin || hasta <= inicio) return []
    return [{ cita, inicio: (Math.max(desde, inicio) - inicio) / 60000,
      fin: (Math.min(hasta, fin) - inicio) / 60000, continua: desde < inicio, duracion }]
  }).sort((a, b) => a.inicio - b.inicio || a.cita.id.localeCompare(b.cita.id))
}

/** Carriles por grupo de colisión; tampoco se tapan tarjetas cortas o sin duración. */
export function distribuirSegmentos(segmentos) {
  const salida = []
  let grupo = [], limite = -1
  function cerrar() {
    const carriles = []
    for (const segmento of grupo) {
      let carril = carriles.findIndex(fin => fin <= segmento.inicio)
      if (carril < 0) carril = carriles.length
      carriles[carril] = Math.max(segmento.fin, segmento.inicio + 40)
      segmento.carril = carril
    }
    salida.push(...grupo.map(s => ({ ...s, carriles: carriles.length })))
    grupo = []
  }
  for (const segmento of segmentos) {
    if (segmento.inicio >= limite && grupo.length) cerrar()
    grupo.push({ ...segmento })
    limite = Math.max(grupo.length === 1 ? -1 : limite, segmento.fin, segmento.inicio + 40)
  }
  if (grupo.length) cerrar()
  return salida
}
export function transicionExistente(actual, nuevo) {
  return (actual === 'pendiente' && ['confirmada', 'cancelada'].includes(nuevo)) ||
    (actual === 'confirmada' && nuevo === 'completada')
}

// Solo columnas del esquema vigente. No usar duración/fin propuestos en citas.
export const COLUMNAS_AGENDA = 'id,clinica_id,paciente_id,especialista_id,servicio_id,promocion_id,fecha_hora,estado,tratamiento,especialistas(nombre),pacientes(nombre),servicios(nombre,duracion_minutos)'
