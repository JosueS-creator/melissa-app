import { useEffect, useMemo, useState } from 'react'
import Cliente360 from './Cliente360'
import { FilaCliente } from './Crm'
import { obtenerClientesCrm, formatearFecha } from '../lib/crm'

const UMBRALES = [45, 60, 90]

export default function ClientesReactivar({ clinicaId, HistorialCliente }) {
  const [clientes, setClientes] = useState([])
  const [minimo, setMinimo] = useState(45)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    obtenerClientesCrm()
      .then((lista) => setClientes(lista || []))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  // Cliente por reactivar = ya tuvo una visita completada, no tiene cita
  // pendiente/confirmada futura y lleva al menos `minimo` días sin venir.
  const lista = useMemo(
    () =>
      clientes
        .filter((c) => c.ultima_visita && !c.proxima_cita && c.dias_inactivo >= minimo)
        .sort((a, b) => b.dias_inactivo - a.dias_inactivo),
    [clientes, minimo]
  )

  if (abierto) {
    return <Cliente360 pacienteId={abierto} clinicaId={clinicaId} HistorialCliente={HistorialCliente} onVolver={() => setAbierto(null)} />
  }

  return (
    <div>
      <p className="font-display text-lg text-ink mb-0.5">Clientes por reactivar</p>
      <p className="text-xs mb-3" style={{ color: 'var(--color-texto-secundario)' }}>
        Ya vinieron antes, no tienen una cita pendiente o confirmada y llevan tiempo sin volver.
      </p>

      <div className="flex gap-1.5 mb-3">
        {UMBRALES.map((d) => (
          <button
            key={d}
            onClick={() => setMinimo(d)}
            className="rounded-full px-3 py-1.5 text-[11px]"
            style={
              minimo === d
                ? { background: 'var(--gradiente-primario)', color: '#FFFFFF', boxShadow: '0 2px 6px rgba(201,59,121,0.3)' }
                : { background: '#FFFFFF', color: 'var(--color-ink)', border: '1px solid var(--color-borde-tarjeta)' }
            }
          >
            {d}+ días
          </button>
        ))}
      </div>

      {cargando && <p className="text-sm text-ink/50">Cargando clientes...</p>}
      {error && <p className="text-sm" style={{ color: '#B0524A' }}>No se pudo cargar: {error}</p>}
      {!cargando && !error && (
        <p className="text-xs mb-2" style={{ color: 'var(--color-texto-secundario)' }}>
          {lista.length} cliente{lista.length === 1 ? '' : 's'} · más días sin venir primero
        </p>
      )}
      {!cargando && !error && lista.length === 0 && (
        <p className="text-sm text-ink/50">Nadie lleva {minimo} días o más sin volver. ¡Buena señal!</p>
      )}

      <div className="flex flex-col gap-2">
        {lista.map((c) => (
          <FilaCliente
            key={c.paciente_id}
            cliente={c}
            onAbrir={setAbierto}
            detalle={
              <div className="flex items-end justify-between mt-1.5">
                <div className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>
                  <p><strong style={{ color: 'var(--color-ink)' }}>{c.dias_inactivo} días</strong> sin visitar · {formatearFecha(c.ultima_visita)}</p>
                  <p>Último servicio: {c.ultimo_servicio || '—'}</p>
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
