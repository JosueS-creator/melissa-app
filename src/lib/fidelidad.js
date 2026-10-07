import { supabase } from './supabaseClient'

/**
 * Niveles de fidelidad. Una sola fuente de verdad:
 *  - Identificadores (en BD y en código): silver · gold · platinum
 *  - Umbrales por negocio: columnas clinicas.umbral_oro / umbral_platino (base de datos)
 *  - Etiquetas que ve el usuario: aquí, y solo aquí.
 * El nivel que usa el CRM lo calcula la base con la misma regla (nivel_por_puntos).
 */
export const ETIQUETA_NIVEL = { silver: 'Plata', gold: 'Oro', platinum: 'Platino' }

/** Lee los umbrales del negocio. Devuelve null si no se pudieron leer. */
export async function obtenerUmbrales(clinicaId) {
  if (!clinicaId) return null
  const { data } = await supabase.from('clinicas').select('umbral_oro, umbral_platino').eq('id', clinicaId).single()
  return data ? { gold: data.umbral_oro, platinum: data.umbral_platino } : null
}

/**
 * Nivel y progreso a partir de los puntos y los umbrales del negocio
 * ({ gold, platinum } — ver obtenerUmbrales). Sin umbrales no se afirma nada:
 * se muestra el nivel base y ningún "siguiente nivel".
 */
export function calcularNivelYProgreso(puntosTotal, umbrales) {
  const niveles = [{ id: 'silver', nombre: ETIQUETA_NIVEL.silver, minimo: 0 }]
  if (umbrales) {
    niveles.push({ id: 'gold', nombre: ETIQUETA_NIVEL.gold, minimo: umbrales.gold })
    niveles.push({ id: 'platinum', nombre: ETIQUETA_NIVEL.platinum, minimo: umbrales.platinum })
  }

  const total = Math.max(puntosTotal, 0)
  let nivelActual = niveles[0]
  let siguienteNivel = null

  for (let i = 0; i < niveles.length; i++) {
    if (total >= niveles[i].minimo) {
      nivelActual = niveles[i]
      siguienteNivel = niveles[i + 1] || null
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
