export function mensajeErrorCita(error) {
  if (error?.code === '23P01') return 'El profesional ya tiene una cita en ese horario. Elige otro horario.'
  if (error?.message?.includes('CALENDARIO_DATOS_REQUERIDOS')) return 'Revisa el profesional y la duración de la cita antes de confirmarla.'
  if (error?.message?.includes('CALENDARIO_REFERENCIA_INVALIDA')) return 'El cliente o profesional no pertenece a esta clínica o no tienes acceso.'
  return 'No se pudo guardar la cita. Revisa los datos e intenta de nuevo.'
}
