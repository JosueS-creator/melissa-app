/**
 * Asistente "Sugerir puntos": cálculo matemático y determinista (sin IA, sin servicios externos).
 * "Sugerencia basada en los datos que ingresaste": no es una recomendación financiera exacta.
 *
 *   margen estimado = precio − costo aproximado
 *   presupuesto     = margen × % destinado a fidelización
 *   puntos          = presupuesto ÷ valor de referencia del punto, redondeado (mitad hacia arriba)
 *
 * El valor de referencia vive en la base (clinicas.valor_punto): aquí NO hay valores fijos.
 */
export const OPCIONES_PORCENTAJE = [
  { id: 'conservador', porcentaje: 5, etiqueta: 'Conservador' },
  { id: 'balanceado', porcentaje: 10, etiqueta: 'Balanceado' },
  { id: 'agresivo', porcentaje: 15, etiqueta: 'Agresivo' },
]

// Se trabaja en centavos para que 0.1 + 0.2 y similares no alteren el resultado.
const centavos = (n) => Math.round(n * 100)

/**
 * @returns {{ estado: 'ok' | 'presupuesto_insuficiente' | 'sin_margen' | 'margen_negativo' | 'datos_invalidos',
 *            puntos: number, margen?: number, presupuesto?: number }}
 *  Los puntos nunca son negativos; sin margen o con margen negativo no se recomienda nada.
 */
// Number('') es 0: un campo vacío NO debe tomarse como "costo cero".
const esNumero = (x) => x !== '' && x !== null && x !== undefined && Number.isFinite(Number(x))

export function calcularSugerenciaPuntos({ precio, costo, porcentaje, valorPunto }) {
  if (![precio, costo, porcentaje, valorPunto].every(esNumero)) return { estado: 'datos_invalidos', puntos: 0 }
  const p = Number(precio)
  const c = Number(costo)
  const pct = Number(porcentaje)
  const vp = Number(valorPunto)
  if (p <= 0 || c < 0 || pct <= 0 || pct > 100 || vp <= 0) return { estado: 'datos_invalidos', puntos: 0 }

  const margenCentavos = centavos(p) - centavos(c)
  const margen = margenCentavos / 100
  if (margenCentavos < 0) return { estado: 'margen_negativo', margen, puntos: 0 }
  if (margenCentavos === 0) return { estado: 'sin_margen', margen: 0, puntos: 0 }

  const presupuesto = (margenCentavos * pct) / 10000
  // 173.5 → 174 · 173.4 → 173 (el 1e-9 absorbe el error binario del punto flotante)
  const puntos = Math.floor(presupuesto / vp + 0.5 + 1e-9)
  return { estado: puntos > 0 ? 'ok' : 'presupuesto_insuficiente', margen, presupuesto, puntos }
}
