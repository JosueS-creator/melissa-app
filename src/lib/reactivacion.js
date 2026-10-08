import { supabase } from './supabaseClient'

/** Reactivación asistida por WhatsApp. Melissa NO envía nada: prepara un mensaje, el administrador lo
 * revisa y abre WhatsApp (enlace wa.me); lo que sabemos es "contacto iniciado", no "enviado".
 * Qué clientes son oportunidad, su prioridad, el teléfono utilizable, el cooldown y el límite diario
 * los decide la base de datos: aquí solo se muestran y se arma el texto. */
async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) throw new Error(error.message)
  return data
}

export const obtenerOportunidades = async () => (await rpc('reactivacion_oportunidades')) || []
export const obtenerResumenReactivacion = () => rpc('reactivacion_resumen')
export const registrarContacto = (pacienteId, promocionId, plantilla) =>
  rpc('registrar_contacto_reactivacion', { p_paciente: pacienteId, p_promocion: promocionId || null, p_plantilla: plantilla })

export const ETIQUETA_PRIORIDAD = { alta: 'Alta', media: 'Media', baja: 'Baja' }

const primerNombre = (nombre) => (nombre || '').trim().split(/\s+/)[0] || 'hola'
const minuscula = (texto) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(texto) ? texto[0].toLowerCase() + texto.slice(1) : texto)
const porcentaje = (n) => `${Number(n).toLocaleString('es-HN', { maximumFractionDigits: 2 })}%`

/** "15% de descuento en tu próximo limpieza facial" no suena bien: se dice "en tu próxima visita" o el servicio tal cual. */
export function describirBeneficio(oportunidad) {
  if (!oportunidad?.promocion_id) return ''
  const base = `${porcentaje(oportunidad.promocion_descuento)} de descuento`
  return oportunidad.promocion_servicio ? `${base} en ${minuscula(oportunidad.promocion_servicio)}` : `${base} en tu próxima visita`
}

/** Tres plantillas cortas y moderadas. No se inventan datos que Melissa no conoce. */
export function elegirPlantilla(oportunidad, incluirPromocion) {
  if (!incluirPromocion || !oportunidad?.promocion_id) return 'sin_promocion'
  const frecuenteOVip = ['gold', 'platinum'].includes(oportunidad.nivel) || Number(oportunidad.visitas) >= 3
  return frecuenteOVip ? 'frecuente_vip' : 'con_promocion'
}

export function construirMensaje(oportunidad, plantilla) {
  const nombre = primerNombre(oportunidad.nombre)
  const beneficio = describirBeneficio(oportunidad)
  switch (plantilla) {
    case 'con_promocion':
      return `Hola ${nombre} 👋 Hace un tiempo no te vemos por aquí. Tenemos un beneficio especial para ti: ${beneficio}. Si quieres aprovecharlo, podemos ayudarte a reservar tu próxima cita.`
    case 'frecuente_vip':
      return `Hola ${nombre} 👋 Queríamos saludarte porque hace un tiempo no te vemos. Tenemos un beneficio especial para ti: ${beneficio}. ¿Te gustaría reservar?`
    default:
      return `Hola ${nombre} 👋 Hace un tiempo no te vemos por aquí. Nos encantaría volver a atenderte. Si quieres reservar tu próxima cita, estamos para ayudarte.`
  }
}

/** Enlace wa.me: solo con un número validado por la base (dígitos con código de país). El texto va codificado. */
export function crearEnlaceWhatsApp(telefonoWa, mensaje) {
  if (!/^\d{8,15}$/.test(String(telefonoWa || ''))) return null
  return `https://wa.me/${telefonoWa}?text=${encodeURIComponent(mensaje)}`
}

/** Avisos (no bloquean: el negocio decide) para que el mensaje no suene a spam. */
export function revisarMensaje(texto) {
  const avisos = []
  const t = texto || ''
  if ((t.match(/[!¡]/g) || []).length > 2) avisos.push('Tiene varios signos de exclamación: un tono más tranquilo se siente más cercano.')
  const mayusculas = (t.match(/\b[A-ZÁÉÍÓÚÑ]{4,}\b/g) || []).length
  if (mayusculas > 0) avisos.push('Evita escribir palabras en MAYÚSCULAS: puede sonar a publicidad.')
  const emojis = (t.match(/\p{Extended_Pictographic}/gu) || []).length
  if (emojis > 3) avisos.push('Tiene muchos emojis: con uno o dos basta.')
  if (t.length > 600) avisos.push('El mensaje es largo: los cortos se leen y se responden más.')
  if (/\b(oferta|promo|descuento)\b[^.]*!{2,}/i.test(t)) avisos.push('Evita la urgencia artificial.')
  return avisos
}

const hora = (iso) => new Date(iso).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Respuesta de la base → texto para el administrador. */
export function mensajeDeResultado(r) {
  switch (r?.resultado) {
    case 'en_cooldown':
      return `A este cliente ya se le inició un contacto hace poco. Podrá volver a aparecer desde el ${hora(r.disponible_desde)}.`
    case 'limite_diario':
      return `Llegaste al límite de ${r.limite} contactos de reactivación en 24 horas (es una protección de Melissa). Podrás preparar más desde el ${r.libre_desde ? hora(r.libre_desde) : 'siguiente día'}.`
    case 'no_oportunidad':
      return 'Este cliente ya no es una oportunidad de reactivación (volvió, tiene cita, no tiene teléfono utilizable o no desea promociones).'
    case 'promocion_no_aplicable':
      return 'La promoción ya no está disponible para este cliente. Quítala del mensaje o elige contactarlo sin promoción.'
    case 'cliente_invalido':
      return 'Ese cliente no pertenece a tu negocio.'
    default:
      return 'No se pudo registrar el contacto. No se abrió WhatsApp; intenta de nuevo.'
  }
}
