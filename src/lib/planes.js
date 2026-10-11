// Etiquetas de los planes y de las funciones. QUÉ incluye cada plan NO está aquí: vive en la base (tabla plan_funciones)
// y llega con funciones_de_mi_clinica(). Aquí solo hay textos y utilidades.
export const ORDEN_PLANES = ['starter', 'pro', 'clinic_plus']
export const NOMBRE_PLAN = { starter: 'Starter', pro: 'Pro', clinic_plus: 'Clinic+' }
export const ETIQUETA_FUNCION = {
  agenda: 'Agenda y reservas',
  clientes: 'Clientes',
  empleados: 'Empleados',
  servicios: 'Servicios',
  historial: 'Historial con antes y después',
  fidelizacion: 'Beauty Points',
  marca: 'Marca',
  tienda: 'Tienda de productos',
  membresias: 'Niveles Plata, Oro y Platino',
  canjes: 'Recompensas y canjes',
  referidos: 'Programa de referidos',
  caja: 'Caja y reportes',
  promociones: 'Promociones',
  reactivacion: 'Clientes por reactivar',
  sucursales: 'Varias sucursales',
  soporte_prioritario: 'Soporte prioritario',
}

/** Plan más bajo que incluye la función (según el cuadro de planes que entrega la base). */
export function planMinimo(planes, funcion) {
  return ORDEN_PLANES.find((p) => (planes?.[p] || []).includes(funcion)) || null
}
