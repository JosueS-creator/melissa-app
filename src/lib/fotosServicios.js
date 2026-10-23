export const BUCKET_SERVICIOS = 'fotos-productos'
export function validarFotoServicio(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Elige una imagen JPEG, PNG o WebP.')
  if (!file.size || file.size > 8 * 1024 * 1024) throw Error('La fotografía debe pesar como máximo 8 MB.')
}
export async function prepararFotoServicio(file) {
  validarFotoServicio(file)
  const bitmap = await createImageBitmap(file).catch(() => { throw Error('No se pudo leer la imagen. Prueba con otra fotografía.') })
  try {
    if (bitmap.width * bitmap.height > 40000000) throw Error('La imagen es demasiado grande. Usa una de hasta 40 megapíxeles.')
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob || blob.type !== 'image/webp') throw Error('Este navegador no puede preparar la foto. Prueba con un navegador actualizado.')
    return blob
  } finally { bitmap.close() }
}
export function rutaFotoPropia(url, baseUrl, clinicaId, servicioId) {
  if (!url) return null
  try {
    const parsed = new URL(url), base = new URL(baseUrl)
    const prefix = `/storage/v1/object/public/${BUCKET_SERVICIOS}/`
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length))
    const parts = path.split('/')
    return parts.length === 4 && parts[0] === clinicaId && parts[1] === 'servicios' && parts[2] === servicioId && /^[a-zA-Z0-9-]+\.webp$/.test(parts[3]) ? path : null
  } catch { return null }
}
export async function borrarFotoPropia(client, path, clinicaId, servicioId) {
  const prefix = `${clinicaId}/servicios/${servicioId}/`
  if (!path?.startsWith(prefix) || path.slice(prefix.length).includes('/') || !/^[a-zA-Z0-9-]+\.webp$/.test(path.slice(prefix.length))) throw Error('La fotografía no pertenece a este servicio.')
  const {data, error} = await client.storage.from(BUCKET_SERVICIOS).remove([path])
  if (error || !data?.some(item => item.name === path || item.name === path.split('/').pop())) throw Error('No se pudo retirar el archivo de Storage. Puedes reintentar la limpieza.')
}
/** Subir primero, guardar con control de versión y retirar después. No borra registros de servicios. */
export async function guardarFotoServicio({client, baseUrl, clinicaId, servicio, blob}) {
  const bucket = client.storage.from(BUCKET_SERVICIOS)
  const oldPath = rutaFotoPropia(servicio.imagen_url, baseUrl, clinicaId, servicio.id)
  let path = null, url = null
  if (blob) {
    path = `${clinicaId}/servicios/${servicio.id}/${crypto.randomUUID()}.webp`
    const {error} = await bucket.upload(path, blob, {contentType:'image/webp',upsert:false,cacheControl:'3600'})
    if (error) throw Error('No se pudo subir la fotografía. Conservamos tu selección para reintentar.')
    url = bucket.getPublicUrl(path).data.publicUrl
  }
  let query = client.from('servicios').update({imagen_url:url}).eq('id',servicio.id).eq('clinica_id',clinicaId)
  query = servicio.imagen_url ? query.eq('imagen_url',servicio.imagen_url) : query.is('imagen_url',null)
  let result
  try { result = await query.select('id').single() } catch { result = {error:true} }
  if (result.error || !result.data) {
    // Una respuesta de red perdida puede haber guardado la referencia. No borrar a ciegas.
    {
      let check
      try { check = await client.from('servicios').select('imagen_url').eq('id',servicio.id).eq('clinica_id',clinicaId).single() } catch { check = {error:true} }
      if (!check.error && check.data && check.data.imagen_url === url) result = {data:{id:servicio.id}}
      else if (!check.error && path) {
        try { await borrarFotoPropia(client,path,clinicaId,servicio.id) } catch { throw Error('No se guardó la foto y quedó una subida pendiente de limpieza. Recarga antes de reintentar.') }
      }
    }
    if (!result.data) throw Error('No se pudo guardar la referencia o alguien cambió la foto. Recarga los servicios antes de reintentar.')
  }
  let pendiente = null
  if (oldPath) { try { await borrarFotoPropia(client,oldPath,clinicaId,servicio.id) } catch { pendiente = oldPath } }
  return {url,pendiente,externa:!oldPath && Boolean(servicio.imagen_url)}
}
