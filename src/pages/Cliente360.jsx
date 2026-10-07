import { useEffect, useState } from 'react'
import { ETIQUETA_NIVEL } from '../lib/fidelidad'
import NivelBadge from '../components/NivelBadge'
import { obtenerCliente360, obtenerTimeline, formatearFecha, formatearMonto, textoDias } from '../lib/crm'

const TIPOS_EVENTO = {
  cita: 'Cita',
  pago: 'Pago',
  compra: 'Compra',
  puntos_ganados: 'Puntos ganados',
  puntos_canjeados: 'Puntos canjeados',
  puntos_ajuste: 'Ajuste de puntos',
  referido: 'Referido',
  membresia: 'Membresía',
  tratamiento: 'Tratamiento',
}

function Seccion({ titulo, children }) {
  return (
    <section className="mb-6">
      <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.16em', color: 'var(--color-dorado)' }}>{titulo}</p>
      <div className="rounded-xl p-4 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>{children}</div>
    </section>
  )
}

function Fila({ etiqueta, children }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span style={{ color: 'var(--color-texto-secundario)' }}>{etiqueta}</span>
      <span className="text-right" style={{ color: 'var(--color-ink)' }}>{children}</span>
    </div>
  )
}

const Vacio = ({ children }) => <span style={{ color: 'var(--color-texto-terciario)' }}>{children}</span>

function valorEvento(e, moneda) {
  if (e.valor == null) return null
  if (e.unidad === 'moneda') return formatearMonto(e.valor, moneda)
  if (e.unidad === 'puntos') return `${Number(e.valor) > 0 ? '+' : ''}${Number(e.valor).toLocaleString()} pts`
  return String(e.valor)
}

export default function Cliente360({ pacienteId, clinicaId, onVolver, HistorialCliente }) {
  const [datos, setDatos] = useState(null)
  const [eventos, setEventos] = useState([])
  const [limite, setLimite] = useState(30)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarHistorial, setMostrarHistorial] = useState(false)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    Promise.all([obtenerCliente360(pacienteId), obtenerTimeline(pacienteId, limite)])
      .then(([d, t]) => {
        if (!vigente) return
        setDatos(d)
        setEventos(t || [])
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [pacienteId, limite])

  const volver = (
    <button onClick={onVolver} className="text-xs mb-4" style={{ color: 'var(--color-primary)' }}>‹ Volver a clientes</button>
  )

  if (error) {
    return (
      <div>
        {volver}
        <p className="text-sm" style={{ color: '#B0524A' }}>No se pudo cargar el cliente: {error}</p>
      </div>
    )
  }
  if (!datos) return <div>{volver}<p className="text-sm text-ink/50">Cargando cliente...</p></div>

  const { paciente, fidelidad, actividad, finanzas, moneda } = datos
  const puntos = Number(fidelidad.puntos)

  return (
    <div>
      {volver}

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.15, color: 'var(--color-ink)' }}>{paciente.nombre}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-texto-secundario)' }}>
            Cliente desde {formatearFecha(paciente.fecha_registro)}
          </p>
        </div>
        <NivelBadge nivel={fidelidad.nivel} />
      </div>

      <Seccion titulo="Datos">
        <Fila etiqueta="Teléfono">{paciente.telefono || <Vacio>Sin teléfono</Vacio>}</Fila>
        <Fila etiqueta="Email">{paciente.email || <Vacio>Sin email registrado</Vacio>}</Fila>
        <Fila etiqueta="Nacimiento">{paciente.fecha_nacimiento ? formatearFecha(paciente.fecha_nacimiento) : <Vacio>No registrada</Vacio>}</Fila>
      </Seccion>

      <Seccion titulo="Fidelización">
        <Fila etiqueta="Nivel">{ETIQUETA_NIVEL[fidelidad.nivel]}</Fila>
        <Fila etiqueta="Puntos actuales"><strong style={{ color: 'var(--color-primary)' }}>{puntos.toLocaleString()} pts</strong></Fila>
        <Fila etiqueta="Membresía">
          {fidelidad.membresia ? `${fidelidad.membresia.nombre} · desde ${formatearFecha(fidelidad.membresia.fecha_inicio)}` : <Vacio>Sin membresía activa</Vacio>}
        </Fila>
        <Fila etiqueta="Recompensas canjeadas">
          {fidelidad.canjes.cantidad > 0
            ? `${fidelidad.canjes.cantidad} · ${Number(fidelidad.canjes.puntos).toLocaleString()} pts`
            : <Vacio>Ninguna todavía</Vacio>}
        </Fila>
        {fidelidad.canjes.pendientes > 0 && (
          <Fila etiqueta="Canjes por aprobar">
            <strong style={{ color: 'var(--color-primary)' }}>{fidelidad.canjes.pendientes}</strong> · revísalos en la pestaña Canjes
          </Fila>
        )}
        {fidelidad.recientes.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-borde-tarjeta)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--color-texto-terciario)' }}>Movimientos recientes</p>
            {fidelidad.recientes.map((m, i) => (
              <div key={i} className="flex justify-between text-xs py-0.5">
                <span style={{ color: 'var(--color-texto-secundario)' }}>{formatearFecha(m.fecha)} · {m.motivo || m.tipo}</span>
                <span style={{ color: m.puntos < 0 ? '#B0524A' : 'var(--color-ink)' }}>{m.puntos > 0 ? '+' : ''}{m.puntos}</span>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Actividad">
        <Fila etiqueta="Última visita">
          {actividad.ultima_visita
            ? `${formatearFecha(actividad.ultima_visita)} · ${textoDias(actividad.dias_inactivo)}`
            : <Vacio>Aún sin visitas completadas</Vacio>}
        </Fila>
        <Fila etiqueta="Próxima cita">{actividad.proxima_cita ? formatearFecha(actividad.proxima_cita, true) : <Vacio>Sin cita próxima</Vacio>}</Fila>
        <Fila etiqueta="Citas completadas">{actividad.citas_completadas}</Fila>
        {actividad.citas_canceladas > 0 && <Fila etiqueta="Citas canceladas">{actividad.citas_canceladas}</Fila>}
        <Fila etiqueta="Último servicio">{actividad.ultimo_servicio || <Vacio>—</Vacio>}</Fila>
        {actividad.servicios.length > 0 && (
          <Fila etiqueta="Servicios realizados">
            {actividad.servicios.map((s) => `${s.nombre} ×${s.veces}`).join(' · ')}
          </Fila>
        )}
        <Fila etiqueta="Compras en tienda">
          {actividad.pedidos.cantidad > 0
            ? `${actividad.pedidos.cantidad} pedido${actividad.pedidos.cantidad > 1 ? 's' : ''} · ${formatearMonto(actividad.pedidos.total, moneda)}`
            : <Vacio>Ninguna</Vacio>}
        </Fila>
        {actividad.productos.length > 0 && (
          <Fila etiqueta="Productos comprados">{actividad.productos.map((p) => `${p.nombre} ×${p.cantidad}`).join(' · ')}</Fila>
        )}
        <Fila etiqueta="Referidos">
          {actividad.referidos.total > 0
            ? `${actividad.referidos.total} invitado${actividad.referidos.total > 1 ? 's' : ''} · ${actividad.referidos.registrados} registrado${actividad.referidos.registrados === 1 ? '' : 's'}`
            : <Vacio>Ninguno</Vacio>}
        </Fila>
        <Fila etiqueta="Tratamientos con registro">{actividad.tratamientos_registrados}</Fila>
      </Seccion>

      <Seccion titulo="Finanzas">
        {finanzas.cobros > 0 ? (
          <Fila etiqueta="Total cobrado registrado">
            <strong>{formatearMonto(finanzas.total_cobrado, moneda)}</strong> · {finanzas.cobros} cobro{finanzas.cobros > 1 ? 's' : ''}
          </Fila>
        ) : (
          <Fila etiqueta="Total cobrado registrado"><Vacio>Sin cobros registrados a su nombre</Vacio></Fila>
        )}
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-texto-terciario)' }}>
          Suma de los cobros de Caja registrados con este cliente. Los cobros que se registraron sin elegir cliente no aparecen aquí.
        </p>
      </Seccion>

      <Seccion titulo="Línea de tiempo">
        {eventos.length === 0 && <Vacio>Todavía no hay actividad.</Vacio>}
        <div className="flex flex-col">
          {eventos.map((e, i) => {
            const valor = valorEvento(e, moneda)
            return (
              <div key={i} className="flex gap-3 py-2" style={i > 0 ? { borderTop: '1px solid var(--color-borde-tarjeta)' } : undefined}>
                <div className="w-20 flex-shrink-0 text-[11px]" style={{ color: 'var(--color-texto-terciario)' }}>
                  {e.fecha ? formatearFecha(e.fecha) : 'Sin fecha'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase" style={{ letterSpacing: '0.12em', color: 'var(--color-dorado)' }}>{TIPOS_EVENTO[e.tipo] || e.tipo}</p>
                  <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{e.descripcion}</p>
                </div>
                {valor && <div className="text-sm flex-shrink-0" style={{ color: e.valor < 0 ? '#B0524A' : 'var(--color-primary)' }}>{valor}</div>}
              </div>
            )
          })}
        </div>
        {eventos.length >= limite && (
          <button
            onClick={() => setLimite((l) => l + 30)}
            disabled={cargando}
            className="mt-3 text-xs disabled:opacity-50"
            style={{ color: 'var(--color-primary)' }}
          >
            Ver más actividad
          </button>
        )}
      </Seccion>

      {HistorialCliente && (
        <section className="mb-6">
          <button
            onClick={() => setMostrarHistorial((v) => !v)}
            className="w-full rounded-xl py-2.5 text-sm"
            style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}
          >
            {mostrarHistorial ? 'Ocultar historial de tratamientos' : '📋 Historial de tratamientos (antes y después)'}
          </button>
          {mostrarHistorial && <HistorialCliente clinicaId={clinicaId} paciente={{ id: paciente.id, nombre: paciente.nombre }} />}
        </section>
      )}
    </div>
  )
}
