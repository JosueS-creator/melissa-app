import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPerfilActual } from '../lib/auth'
import Personalizacion from './Personalizacion'

const TABS = [
  { id: 'citas', label: 'Citas' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'marca', label: 'Marca' },
]

export default function AdminPanel() {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('citas')

  useEffect(() => {
    obtenerPerfilActual().then((p) => {
      setPerfil(p)
      setCargando(false)
    })
  }, [])

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!perfil) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para continuar.</p>
  if (perfil.rol !== 'admin') {
    return <p className="text-center pt-16 text-sm text-ink/60 px-8">Esta sección es solo para administradores.</p>
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 pb-10 font-body">
      <p className="font-display text-xl text-ink mb-1">Panel de la clínica</p>
      <p className="text-xs text-ink/50 mb-5">Vista operativa para el equipo.</p>

      <div className="grid grid-cols-4 gap-1.5 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-lg py-2 text-[11px] font-medium"
            style={
              tab === t.id
                ? { background: 'var(--color-primary)', color: '#FFFFFF' }
                : { background: 'var(--color-accent)', color: 'var(--color-ink)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'citas' && <PanelCitas clinicaId={perfil.clinica_id} />}
      {tab === 'pacientes' && <PanelPacientes clinicaId={perfil.clinica_id} />}
      {tab === 'ventas' && <PanelVentas clinicaId={perfil.clinica_id} />}
      {tab === 'marca' && (
        <div className="-mx-5">
          <Personalizacion />
        </div>
      )}
    </div>
  )
}

function PanelCitas({ clinicaId }) {
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('citas')
      .select('*, especialistas(nombre), pacientes(nombre)')
      .eq('clinica_id', clinicaId)
      .order('fecha_hora', { ascending: true })
    setCitas(data || [])
    setCargando(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('citas').update({ estado }).eq('id', id)
    cargar()
  }

  if (cargando) return <p className="text-sm text-ink/50">Cargando citas...</p>
  if (citas.length === 0) return <p className="text-sm text-ink/50">No hay citas registradas todavía.</p>

  const colorEstado = {
    pendiente: '#B08D3E',
    confirmada: '#2D6E8E',
    completada: '#6B8E5A',
    cancelada: '#B0524A',
  }

  return (
    <div className="flex flex-col gap-2.5">
      {citas.map((c) => (
        <div key={c.id} className="rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-ink">{c.pacientes?.nombre ?? 'Paciente'}</p>
              <p className="text-[11px] text-ink/50 mt-0.5">
                {new Date(c.fecha_hora).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                {' · '}
                {c.especialistas?.nombre ?? 'Sin asignar'}
              </p>
            </div>
            <span className="text-[10px] font-medium px-2 py-1 rounded-full text-white" style={{ background: colorEstado[c.estado] }}>
              {c.estado}
            </span>
          </div>
          {c.estado === 'pendiente' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => cambiarEstado(c.id, 'confirmada')} className="text-[11px] px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--color-primary)' }}>
                Confirmar
              </button>
              <button onClick={() => cambiarEstado(c.id, 'cancelada')} className="text-[11px] px-3 py-1.5 rounded-lg text-ink/60 bg-white">
                Cancelar
              </button>
            </div>
          )}
          {c.estado === 'confirmada' && (
            <button onClick={() => cambiarEstado(c.id, 'completada')} className="text-[11px] px-3 py-1.5 rounded-lg text-white mt-2" style={{ background: 'var(--color-primary)' }}>
              Marcar completada
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function PanelPacientes({ clinicaId }) {
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('pacientes')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('fecha_registro', { ascending: false })
      .then(({ data }) => {
        setPacientes(data || [])
        setCargando(false)
      })
  }, [])

  if (cargando) return <p className="text-sm text-ink/50">Cargando pacientes...</p>
  if (pacientes.length === 0) return <p className="text-sm text-ink/50">Todavía no hay pacientes registrados.</p>

  return (
    <div className="flex flex-col gap-2">
      {pacientes.map((p) => (
        <div key={p.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--color-accent)' }}>
          <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
          <div>
            <p className="text-sm font-medium text-ink">{p.nombre}</p>
            <p className="text-[11px] text-ink/50">{p.telefono || 'Sin teléfono registrado'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function PanelVentas({ clinicaId }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('pedidos')
      .select('*, pacientes(nombre)')
      .eq('clinica_id', clinicaId)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        setPedidos(data || [])
        setCargando(false)
      })
  }, [])

  if (cargando) return <p className="text-sm text-ink/50">Cargando ventas...</p>
  if (pedidos.length === 0) return <p className="text-sm text-ink/50">Todavía no hay pedidos registrados.</p>

  const totalVentas = pedidos.reduce((sum, p) => sum + Number(p.total), 0)

  return (
    <div>
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-ink)' }}>
        <p className="text-[11px] text-white/60">Total acumulado</p>
        <p className="text-xl text-white font-medium mt-1">L {totalVentas.toFixed(2)}</p>
      </div>
      <div className="flex flex-col gap-2">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: 'var(--color-accent)' }}>
            <div>
              <p className="text-sm font-medium text-ink">{p.pacientes?.nombre ?? 'Paciente'}</p>
              <p className="text-[11px] text-ink/50">
                {new Date(p.fecha).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })} · {p.estado}
              </p>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>L {Number(p.total).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
