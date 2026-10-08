/** Citas del cliente. Regla: el cliente SOLICITA; el negocio confirma, completa o cancela.
 * "Solicitada" (pendiente) NO es "Confirmada". Melissa no calcula disponibilidad: no la promete. */
const GRIS = 'var(--color-texto-terciario)'

export const ESTADO_CITA = {
  pendiente: { texto: 'Solicitada · esperando confirmación del negocio', color: 'var(--color-dorado)' },
  confirmada: { texto: 'Confirmada por el negocio', color: '#4F7A3E' },
  completada: { texto: 'Completada', color: 'var(--color-texto-secundario)' },
  cancelada: { texto: 'Cancelada', color: GRIS },
}

/** Una solicitud que nunca se confirmó y cuya fecha ya pasó no debe verse como "esperando". */
export function estadoDeCita(cita, ahora = new Date()) {
  if (cita.estado === 'pendiente' && new Date(cita.fecha_hora) < ahora) return { texto: 'Sin confirmar · la fecha ya pasó', color: GRIS }
  return ESTADO_CITA[cita.estado] || ESTADO_CITA.pendiente
}

export const esProxima = (cita, ahora = new Date()) =>
  ['pendiente', 'confirmada'].includes(cita.estado) && new Date(cita.fecha_hora) >= ahora

/** Fechas LOCALES (YYYY-MM-DD). toISOString() usa UTC y en Honduras corría el día después de las 6 p. m. */
export const aIsoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fechaLocal = (iso) => new Date(`${iso}T00:00:00`)
export const esHoraPasada = (diaIso, hora, ahora = new Date()) => new Date(`${diaIso}T${hora}:00`) <= ahora

export const textoFechaHora = (iso) => {
  const f = new Date(iso)
  return `${f.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${f.toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })}`
}
