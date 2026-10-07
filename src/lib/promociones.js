import { supabase } from './supabaseClient'

/** Promociones: todo lo decide la base (segmento, vigencia, frecuencia de avisos, estado por cliente).
 * Aquí solo se piden y se muestran. */
async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) throw new Error(error.message)
  return data
}

export const misPromociones = async () => (await rpc('mis_promociones')) || []
/** La promoción a mostrar como aviso ahora (o null). Pedirla la registra como "mostrada". */
export const promocionParaBanner = async () => (await rpc('promocion_para_banner'))?.[0] || null
export const marcarPromocion = (promocionId, accion) => rpc('marcar_promocion', { p_promocion: promocionId, p_accion: accion })

// "Reservar ahora" lleva a Agenda con la promoción elegida (memoria de la sesión; no se guarda en el dispositivo).
let reserva = null
export const guardarReservaPromo = (promo) => { reserva = promo }
export const leerReservaPromo = () => reserva
export const limpiarReservaPromo = () => { reserva = null }

export const formatearPorcentaje = (n) => `${Number(n).toLocaleString('es-HN', { maximumFractionDigits: 2 })}%`
