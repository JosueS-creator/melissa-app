// Etiquetas de estado. Los colores salen de las variables --adm-<estado> (ver .panel-admin en index.css).
export const ETIQUETA_ESTADO = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada' }
const ESTADOS_CONOCIDOS = Object.keys(ETIQUETA_ESTADO)

/** Tarjeta de cita: hora y estado · cliente · servicio · profesional · acciones (solo las que corresponden al estado). */
export default function TarjetaCita({ cita, promo, onEstado }) {
  const estado = cita.estado
  const conocido = ESTADOS_CONOCIDOS.includes(estado)
  const etiqueta = ETIQUETA_ESTADO[estado] || (estado ? estado[0].toUpperCase() + estado.slice(1) : 'Sin estado')
  const color = conocido ? `var(--adm-${estado})` : 'var(--admin-texto-2)'
  const fondo = conocido ? `var(--adm-${estado}-bg)` : 'var(--admin-fondo)'
  const base = conocido ? `var(--adm-${estado}-base)` : 'var(--admin-plata)'
  const fecha = new Date(cita.fecha_hora)
  const hora = fecha.toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })
  const dia = fecha.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' })
  const boton = 'rounded-xl px-4 text-sm font-semibold'

  return (
    <li className="relative overflow-hidden" style={{ background: 'var(--admin-superficie)', border: '1px solid var(--admin-borde)', borderRadius: 14 }}>
      <span aria-hidden="true" className="absolute top-0 bottom-0 left-0" style={{ width: 4, background: base }} />
      <div style={{ padding: '12px 14px 12px 18px' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p style={{ font: '700 20px/1.1 var(--font-body)', color: 'var(--admin-texto)' }}>{hora}</p>
            <p className="capitalize mt-0.5" style={{ fontSize: 12, color: 'var(--admin-texto-2)' }}>{dia}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full flex-none" style={{ padding: '4px 10px', background: fondo, color, font: '600 12px/1.2 var(--font-body)' }}>
            <span aria-hidden="true" className="rounded-full" style={{ width: 6, height: 6, background: color }} />
            {etiqueta}
          </span>
        </div>

        <p className="mt-2" style={{ font: '600 15px/1.3 var(--font-body)', color: 'var(--admin-texto)' }}>{cita.pacientes?.nombre ?? 'Cliente'}</p>
        {cita.tratamiento && <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--admin-texto-2)' }}>{cita.tratamiento}</p>}
        <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--admin-texto-2)' }}>{cita.especialistas?.nombre ?? 'Sin asignar'}</p>

        {cita.promocion_id && promo && (
          <p className="mt-1.5" style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--admin-accion)' }}>
            🎁 Reservada con la promoción «{promo.titulo}» ({Number(promo.descuento_porcentaje)}%): aplícala en Promociones al cobrar.
          </p>
        )}

        {estado === 'pendiente' && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => onEstado(cita.id, 'confirmada')} className={boton} style={{ minHeight: 44, color: 'var(--admin-sobre-accion)', background: 'linear-gradient(180deg, var(--admin-accion-2), var(--admin-accion))' }}>
              Confirmar
            </button>
            <button onClick={() => onEstado(cita.id, 'cancelada')} className={boton} style={{ minHeight: 44, color: 'var(--admin-texto)', background: 'var(--admin-superficie)', border: '1.5px solid var(--admin-acero-2)' }}>
              Cancelar
            </button>
          </div>
        )}
        {estado === 'confirmada' && (
          <button onClick={() => onEstado(cita.id, 'completada')} className={`${boton} mt-3`} style={{ minHeight: 44, color: 'var(--admin-sobre-accion)', background: 'linear-gradient(180deg, var(--admin-accion-2), var(--admin-accion))' }}>
            Marcar completada
          </button>
        )}
      </div>
    </li>
  )
}
