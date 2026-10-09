import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ESTADO_CITA } from '../lib/citas'
import { obtenerResumenCrm } from '../lib/crm'
import { obtenerResumenReactivacion } from '../lib/reactivacion'

/** Inicio del administrador: resumen accionable de HOY con datos que ya existen.
 * - Citas: una lectura (mismos filtros que PanelCitas) desde hace 7 días en adelante.
 * - Clientes y reactivación: funciones de la base crm_resumen y reactivacion_resumen.
 * - Canjes pendientes: llega como prop desde AdminPanel (no se consulta dos veces).
 * No muestra ingresos ni "recuperados": pagos no tiene cita_id y no se puede atribuir. */

const ETIQUETA_CORTA = { pendiente: 'Por confirmar', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada' }

const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const hora = (iso) => new Date(iso).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' })

function Chip({ estado, vencida }) {
  // Por confirmar usa el primario del tema (el dorado no sirve como texto: poco contraste).
  const color = vencida ? 'var(--color-texto-terciario)' : estado === 'pendiente' ? 'var(--color-primary)' : ESTADO_CITA[estado]?.color || 'var(--color-texto-secundario)'
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, white)` }}
    >
      {vencida ? 'Sin confirmar' : ETIQUETA_CORTA[estado] || estado}
    </span>
  )
}

function Seccion({ titulo, accion, children }) {
  return (
    <section className="rounded-2xl bg-white border border-borde-tarjeta">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="font-display text-lg text-ink">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

function EnlaceTab({ onClick, children }) {
  return (
    <button onClick={onClick} className="min-h-[44px] px-1 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
      {children} →
    </button>
  )
}

const Aviso = ({ children }) => <p className="px-5 pb-5 text-sm text-texto-secundario">{children}</p>

export default function InicioAdmin({ clinicaId, canjesPendientes, onIr }) {
  const [citas, setCitas] = useState(null)
  const [errorCitas, setErrorCitas] = useState('')
  const [crm, setCrm] = useState(null)
  const [reac, setReac] = useState(null)
  const [errorCrm, setErrorCrm] = useState(false)
  const [errorReac, setErrorReac] = useState(false)

  useEffect(() => {
    const desde = inicioDelDia(new Date())
    desde.setDate(desde.getDate() - 6)
    supabase
      .from('citas')
      .select('id, fecha_hora, estado, tratamiento, pacientes(nombre), especialistas(nombre)')
      .eq('clinica_id', clinicaId)
      .gte('fecha_hora', desde.toISOString())
      .order('fecha_hora', { ascending: true })
      .then(({ data, error }) => {
        if (error) setErrorCitas('No se pudieron cargar las citas.')
        setCitas(data || [])
      })
    obtenerResumenCrm().then(setCrm).catch(() => setErrorCrm(true))
    obtenerResumenReactivacion().then(setReac).catch(() => setErrorReac(true))
  }, [clinicaId])

  const ahora = new Date()
  const desde7 = inicioDelDia(ahora)
  desde7.setDate(desde7.getDate() - 6)
  const lista = citas || []
  const deHoy = lista.filter((c) => mismoDia(new Date(c.fecha_hora), ahora))
  const activasHoy = deHoy.filter((c) => c.estado !== 'cancelada')
  const porConfirmar = lista.filter((c) => c.estado === 'pendiente' && new Date(c.fecha_hora) >= ahora)
  const completadas7 = lista.filter((c) => c.estado === 'completada' && new Date(c.fecha_hora) >= desde7 && new Date(c.fecha_hora) <= ahora).length

  const hoyTexto = ahora.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })
  const cargandoCitas = citas === null
  const valor = (v) => (v === null || v === undefined ? '—' : v)

  const indicadores = [
    { titulo: 'Citas hoy', valor: cargandoCitas ? '…' : activasHoy.length, tab: 'citas' },
    { titulo: 'Solicitudes por confirmar', valor: cargandoCitas ? '…' : porConfirmar.length, tab: 'citas', alerta: porConfirmar.length > 0 },
    { titulo: 'Canjes por aprobar', valor: canjesPendientes, tab: 'canjes', alerta: canjesPendientes > 0 },
    { titulo: 'Clientes para reactivar', valor: errorReac ? '—' : reac ? valor(reac.oportunidades) : '…', tab: 'reactivar' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl lg:text-3xl text-ink">Inicio</h1>
        <p className="mt-1 text-sm text-texto-secundario">{hoyTexto.charAt(0).toUpperCase() + hoyTexto.slice(1)}</p>
      </header>

      {/* Indicadores del día: una sola franja, cada celda lleva a su pestaña. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl bg-white border border-borde-tarjeta overflow-hidden">
        {indicadores.map((it, i) => (
          <button
            key={it.titulo}
            onClick={() => onIr(it.tab)}
            className={`text-left px-5 py-4 min-h-[44px] border-borde-tarjeta ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <span className="block text-xs text-texto-secundario">{it.titulo}</span>
            <span className="mt-1 block font-display text-3xl" style={{ color: it.alerta ? 'var(--color-primary)' : 'var(--color-ink)' }}>
              {it.valor}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        {/* Columna principal: agenda de hoy y solicitudes. */}
        <div className="flex flex-col gap-5">
          <Seccion titulo="Agenda de hoy" accion={<EnlaceTab onClick={() => onIr('citas')}>Ver citas</EnlaceTab>}>
            {cargandoCitas && <Aviso>Cargando citas…</Aviso>}
            {errorCitas && <Aviso>{errorCitas}</Aviso>}
            {!cargandoCitas && !errorCitas && deHoy.length === 0 && <Aviso>No hay citas para hoy.</Aviso>}
            {deHoy.length > 0 && (
              <ul className="border-t border-borde-tarjeta">
                {deHoy.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 lg:gap-4 px-5 py-3 border-b border-borde-tarjeta last:border-b-0" style={{ opacity: c.estado === 'cancelada' ? 0.6 : 1 }}>
                    <span className="w-20 flex-shrink-0 whitespace-nowrap text-sm font-medium text-ink">{hora(c.fecha_hora)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{c.pacientes?.nombre ?? 'Cliente'}</span>
                      <span className="block truncate text-xs text-texto-secundario">
                        {c.tratamiento || 'Sin servicio'} · {c.especialistas?.nombre ?? 'Sin asignar'}
                      </span>
                    </span>
                    <Chip estado={c.estado} vencida={c.estado === 'pendiente' && new Date(c.fecha_hora) < ahora} />
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Solicitudes por confirmar" accion={porConfirmar.length > 0 && <EnlaceTab onClick={() => onIr('citas')}>Ir a Citas</EnlaceTab>}>
            {!cargandoCitas && !errorCitas && porConfirmar.length === 0 && <Aviso>No hay solicitudes esperando confirmación.</Aviso>}
            {porConfirmar.length > 0 && (
              <ul className="border-t border-borde-tarjeta">
                {porConfirmar.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 lg:gap-4 px-5 py-3 border-b border-borde-tarjeta last:border-b-0">
                    <span className="w-24 flex-shrink-0 text-xs text-texto-secundario capitalize">
                      {fechaCorta(c.fecha_hora)}
                      <span className="block whitespace-nowrap text-sm font-medium text-ink normal-case">{hora(c.fecha_hora)}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{c.pacientes?.nombre ?? 'Cliente'}</span>
                      <span className="block truncate text-xs text-texto-secundario">{c.tratamiento || 'Sin servicio'}</span>
                    </span>
                    <Chip estado="pendiente" />
                  </li>
                ))}
              </ul>
            )}
            {porConfirmar.length > 5 && <Aviso>y {porConfirmar.length - 5} más en Citas.</Aviso>}
          </Seccion>
        </div>

        {/* Columna lateral: seguimiento de clientes y actividad. */}
        <div className="flex flex-col gap-5">
          <Seccion titulo="Clientes" accion={<EnlaceTab onClick={() => onIr('pacientes')}>Ver clientes</EnlaceTab>}>
            {errorCrm && <Aviso>No se pudo cargar el resumen de clientes.</Aviso>}
            {!errorCrm && !crm && <Aviso>Cargando…</Aviso>}
            {crm && (
              <dl className="grid grid-cols-2 border-t border-borde-tarjeta">
                {[
                  ['Total', crm.total],
                  ['Nuevos (30 días)', crm.nuevos_30d],
                  ['Sin próxima cita', crm.sin_proxima_cita],
                  [`Inactivos (+${valor(crm.dias_inactividad)} días)`, crm.inactivos],
                ].map(([t, v], i) => (
                  <div key={t} className={`px-5 py-3 border-borde-tarjeta ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t' : ''}`}>
                    <dt className="text-xs text-texto-secundario">{t}</dt>
                    <dd className="font-display text-2xl text-ink">{valor(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Seccion>

          <Seccion titulo="Reactivación" accion={<EnlaceTab onClick={() => onIr('reactivar')}>Ver lista</EnlaceTab>}>
            {errorReac && <Aviso>No se pudo cargar la reactivación.</Aviso>}
            {!errorReac && !reac && <Aviso>Cargando…</Aviso>}
            {reac && (
              <div className="border-t border-borde-tarjeta px-5 py-4 flex flex-col gap-2 text-sm text-ink">
                <p>
                  <span className="font-medium">{valor(reac.oportunidades)}</span> clientes listos para contactar por WhatsApp
                </p>
                <p className="text-xs text-texto-secundario">
                  Prioridad alta {valor(reac.alta)} · media {valor(reac.media)} · baja {valor(reac.baja)}
                  {reac.sin_telefono > 0 && ` · ${reac.sin_telefono} sin teléfono`}
                </p>
                <p className="text-xs text-texto-secundario">
                  Contactos disponibles hoy: {valor(reac.restantes)} de {valor(reac.limite_diario)}
                </p>
              </div>
            )}
          </Seccion>

          <Seccion titulo="Últimos 7 días">
            <div className="border-t border-borde-tarjeta px-5 py-4">
              <p className="text-xs text-texto-secundario">Citas completadas</p>
              <p className="font-display text-2xl text-ink">{cargandoCitas ? '…' : errorCitas ? '—' : completadas7}</p>
            </div>
          </Seccion>
        </div>
      </div>
    </div>
  )
}
