import { useEffect, useMemo, useState } from 'react'
import Cliente360 from './Cliente360'
import NivelBadge from '../components/NivelBadge'
import { SEGMENTOS, obtenerClientesCrm, obtenerResumenCrm, ordenarClientes, formatearFecha, textoDias } from '../lib/crm'
import { obtenerResumenReactivacion } from '../lib/reactivacion'

function Indicador({ etiqueta, valor, nota }) {
  return (
    <div className="rounded-xl px-3 py-2.5 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
      <p className="text-[10px]" style={{ color: 'var(--color-texto-secundario)' }}>{etiqueta}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.2, color: 'var(--color-ink)' }}>{valor}</p>
      {nota && <p className="text-[9px]" style={{ color: 'var(--color-texto-terciario)' }}>{nota}</p>}
    </div>
  )
}

export function FilaCliente({ cliente, onAbrir, detalle }) {
  return (
    <button
      onClick={() => onAbrir(cliente.paciente_id)}
      className="w-full text-left rounded-xl p-3"
      style={{ background: 'var(--color-accent)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{cliente.nombre}</p>
        <NivelBadge nivel={cliente.nivel} />
      </div>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-texto-secundario)' }}>
        {cliente.telefono || 'Sin teléfono'}
      </p>
      {detalle}
    </button>
  )
}

export default function Crm({ clinicaId, HistorialCliente, EscanerQR, onVerOportunidades }) {
  const [clientes, setClientes] = useState([])
  const [resumen, setResumen] = useState(null)
  const [reactivacion, setReactivacion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [segmento, setSegmento] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('nombre')
  const [abierto, setAbierto] = useState(null)
  const [mostrarEscaner, setMostrarEscaner] = useState(false)

  async function cargar() {
    try {
      const [lista, res] = await Promise.all([obtenerClientesCrm(), obtenerResumenCrm()])
      setClientes(lista || [])
      setResumen(res)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
    // La tarjeta de reactivación es un extra: si falla, el CRM sigue funcionando.
    obtenerResumenReactivacion().then(setReactivacion).catch(() => setReactivacion(null))
  }

  useEffect(() => {
    cargar()
  }, [])

  const visibles = useMemo(() => {
    const seg = SEGMENTOS.find((s) => s.id === segmento) || SEGMENTOS[0]
    const texto = busqueda.trim().toLowerCase()
    const filtrados = clientes.filter(
      (c) =>
        seg.filtro(c) &&
        (!texto || [c.nombre, c.telefono, c.email].some((v) => (v || '').toLowerCase().includes(texto)))
    )
    return ordenarClientes(filtrados, orden)
  }, [clientes, segmento, busqueda, orden])

  if (abierto) {
    return (
      <Cliente360
        pacienteId={abierto}
        clinicaId={clinicaId}
        HistorialCliente={HistorialCliente}
        onVolver={() => {
          setAbierto(null)
          cargar()
        }}
      />
    )
  }

  const segActual = SEGMENTOS.find((s) => s.id === segmento) || SEGMENTOS[0]

  return (
    <div>
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          <Indicador etiqueta="Clientes" valor={resumen.total} />
          <Indicador etiqueta="Nuevos (30 días)" valor={resumen.nuevos_30d} />
          <Indicador etiqueta="Recurrentes" valor={resumen.recurrentes} nota="2 o más visitas" />
          <Indicador etiqueta="Inactivos" valor={resumen.inactivos} nota={`+${resumen.dias_inactividad} días`} />
          <Indicador etiqueta="Sin próxima cita" valor={resumen.sin_proxima_cita} />
          <Indicador
            etiqueta="Recuperados"
            valor={resumen.recuperados_desde ? resumen.recuperados : '—'}
            nota={resumen.recuperados_desde ? `desde el ${formatearFecha(resumen.recuperados_desde)}` : 'se mide desde la primera cita nueva'}
          />
        </div>
      )}

      {reactivacion && onVerOportunidades && (
        <div className="rounded-xl p-4 mb-4 bg-white" style={{ border: '1px solid var(--color-dorado)' }}>
          <p className="text-[10px] uppercase" style={{ letterSpacing: '0.16em', color: 'var(--color-dorado)' }}>Clientes por reactivar</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.1, color: 'var(--color-ink)' }}>{reactivacion.oportunidades}</p>
          <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>{reactivacion.oportunidades === 0 ? 'Aún no hay clientes para reactivar.' : `Personas que podrían volver a reservar.${reactivacion.alta > 0 ? ` ${reactivacion.alta} de prioridad alta.` : ''}`}</p>
          <button onClick={onVerOportunidades} className="mt-2 text-xs font-medium" style={{ color: 'var(--color-primary)' }}>Ver oportunidades ›</button>
        </div>
      )}

      {EscanerQR && (
        <>
          <button
            onClick={() => setMostrarEscaner((v) => !v)}
            className="w-full rounded-xl py-2.5 text-sm font-medium mb-3"
            style={{ background: mostrarEscaner ? 'var(--color-accent)' : 'var(--gradiente-primario)', color: mostrarEscaner ? 'var(--color-ink)' : '#FFFFFF', boxShadow: mostrarEscaner ? 'none' : '0 3px 8px rgba(201,59,121,0.3)' }}
          >
            {mostrarEscaner ? 'Cerrar escáner' : '📷 Escanear QR de un cliente'}
          </button>
          {mostrarEscaner && (
            <EscanerQR
              clinicaId={clinicaId}
              onPuntosActualizados={() => {
                setMostrarEscaner(false)
                cargar()
              }}
            />
          )}
        </>
      )}

      <input
        className="w-full rounded-xl px-4 py-2.5 text-sm bg-white mb-3"
        style={{ border: '1px solid var(--color-borde-tarjeta)' }}
        placeholder="Buscar por nombre, teléfono o email"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {SEGMENTOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSegmento(s.id)}
            className="rounded-full px-3 py-1.5 text-[11px]"
            style={
              segmento === s.id
                ? { background: 'var(--gradiente-primario)', color: '#FFFFFF', boxShadow: '0 2px 6px rgba(201,59,121,0.3)' }
                : { background: '#FFFFFF', color: 'var(--color-ink)', border: '1px solid var(--color-borde-tarjeta)' }
            }
          >
            {s.etiqueta}
          </button>
        ))}
      </div>
      <p className="text-[11px] mb-3" style={{ color: 'var(--color-texto-terciario)' }}>{segActual.ayuda(resumen?.dias_inactividad ?? 45)}</p>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>{visibles.length} cliente{visibles.length === 1 ? '' : 's'}</p>
        <select
          className="text-xs rounded-lg px-2 py-1 bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
        >
          <option value="nombre">Nombre</option>
          <option value="visita">Última visita</option>
          <option value="inactividad">Más días sin venir</option>
          <option value="puntos">Más puntos</option>
        </select>
      </div>

      {cargando && <p className="text-sm text-ink/50">Cargando clientes...</p>}
      {error && <p className="text-sm" style={{ color: '#B0524A' }}>No se pudo cargar el CRM: {error}</p>}
      {!cargando && !error && visibles.length === 0 && (
        <p className="text-sm text-ink/50">
          {clientes.length === 0 ? 'Todavía no hay clientes registrados.' : 'Ningún cliente cumple este filtro.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {visibles.map((c) => (
          <FilaCliente
            key={c.paciente_id}
            cliente={c}
            onAbrir={setAbierto}
            detalle={
              <div className="flex items-end justify-between mt-1.5">
                <div className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>
                  <p>
                    {c.ultima_visita
                      ? `Última visita: ${formatearFecha(c.ultima_visita)} · ${textoDias(c.dias_inactivo)}`
                      : 'Aún sin visitas'}
                  </p>
                  <p>
                    {c.proxima_cita
                      ? `Próxima cita: ${formatearFecha(c.proxima_cita)}`
                      : c.visitas_completadas > 0 ? 'Sin próxima cita' : ''}
                  </p>
                </div>
                <p className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
                  {Number(c.puntos).toLocaleString()} pts
                </p>
              </div>
            }
          />
        ))}
      </div>
    </div>
  )
}
