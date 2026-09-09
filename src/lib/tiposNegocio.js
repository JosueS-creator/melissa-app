export const TIPOS_NEGOCIO = [
  { valor: 'clinica_estetica', etiqueta: 'Clínica estética', sustantivo: 'clínica' },
  { valor: 'salon_belleza', etiqueta: 'Salón de belleza', sustantivo: 'salón' },
  { valor: 'salon_unas', etiqueta: 'Salón de uñas', sustantivo: 'salón' },
  { valor: 'spa', etiqueta: 'Spa', sustantivo: 'spa' },
  { valor: 'otro', etiqueta: 'Otro', sustantivo: 'negocio' },
]

/** Devuelve el sustantivo correcto ("clínica", "salón", "spa", "negocio")
 * según el tipo de negocio guardado. Si no se reconoce, cae a "negocio". */
export function sustantivoNegocio(tipoNegocio) {
  return TIPOS_NEGOCIO.find((t) => t.valor === tipoNegocio)?.sustantivo || 'negocio'
}
