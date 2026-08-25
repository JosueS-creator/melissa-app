/**
 * Niveles de fidelidad basados en puntos acumulados. Distinto del Beauty
 * Score (que mide constancia/engagement) — esto es un balance de puntos
 * canjeables, con umbrales por nivel. Ajustables cuando cada clínica
 * pueda definir sus propios umbrales de membresía.
 */
const NIVELES = [
  { id: 'plata', nombre: 'Plata', minimo: 0 },
  { id: 'oro', nombre: 'Oro', minimo: 800 },
  { id: 'platino', nombre: 'Platino', minimo: 3200 },
]

export function calcularNivelYProgreso(puntosTotal) {
  const total = Math.max(puntosTotal, 0)
  let nivelActual = NIVELES[0]
  let siguienteNivel = null

  for (let i = 0; i < NIVELES.length; i++) {
    if (total >= NIVELES[i].minimo) {
      nivelActual = NIVELES[i]
      siguienteNivel = NIVELES[i + 1] || null
    }
  }

  const progreso = siguienteNivel
    ? Math.min(((total - nivelActual.minimo) / (siguienteNivel.minimo - nivelActual.minimo)) * 100, 100)
    : 100

  return {
    nivelActual,
    siguienteNivel,
    progreso,
    puntosParaSiguiente: siguienteNivel ? siguienteNivel.minimo - total : 0,
  }
}
