/** Solo presentación: nunca escribe ni inventa registros de catálogo. */
export const DEMO_CLINICA_ID = 'c48eea49-bcd3-4fc8-86db-60faf0610c75'
export const esClinicaDemo = clinica => clinica?.id === DEMO_CLINICA_ID && clinica?.slug === 'demo'
export function categoriaImagen(nombre = '', tipo = 'servicio') {
  const texto = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if (tipo === 'producto') return /crema|serum|suero|protector|champu|shampoo|acondicionador|mascarilla|aceite|kit/.test(texto) ? 'productos' : null
  if (/manicur|pedicur|unas|nail/.test(texto)) return 'unas'
  if (/cabell|capilar|peluquer|corte|peinad|tinte|alisado|keratina/.test(texto)) return 'cabello'
  if (/masaj|spa|relaj/.test(texto)) return 'spa'
  if (/hidrat|mascarilla/.test(texto)) return 'hidratacion'
  if (/facial|rostro|cutis|limpieza/.test(texto)) return 'facial'
  return null
}
export function imagenMuestra(nombre, tipo = 'servicio') {
  const categoria = categoriaImagen(nombre,tipo)
  return categoria ? `/images/muestras/${categoria}.webp` : null
}
