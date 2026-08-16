import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

export default function Referidos() {
  const [paciente, setPaciente] = useState(null)
  const [referidos, setReferidos] = useState([])
  const [telefono, setTelefono] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const p = await obtenerPacienteActual()
    setPaciente(p)
    if (!p) {
      setCargando(false)
      return
    }
    const { data } = await supabase
      .from('referidos')
      .select('*')
      .eq('paciente_referidor_id', p.id)
      .order('fecha', { ascending: false })
    setReferidos(data || [])
    setCargando(false)
  }

  async function invitar() {
    if (!paciente || !telefono.trim()) return
    setEnviando(true)
    setMensaje('')

    const { error } = await supabase.from('referidos').insert({
      clinica_id: paciente.clinica_id,
      paciente_referidor_id: paciente.id,
      telefono_referido: telefono.trim(),
      estado: 'invitado',
    })

    if (error) {
      setMensaje('No se pudo enviar la invitación.')
    } else {
      setMensaje('¡Invitación registrada! ✓')
      setTelefono('')
      cargar()
    }
    setEnviando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tus referidos.</p>

  const recompensados = referidos.filter((r) => r.estado === 'recompensado').length

  const colorEstado = {
    invitado: '#B08D3E',
    registrado: '#2D6E8E',
    recompensado: '#6B8E5A',
  }
  const etiquetaEstado = {
    invitado: 'Invitado',
    registrado: 'Se registró',
    recompensado: 'Recompensado',
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 pb-10 font-body">
      <p className="font-display text-xl text-ink mb-1">Invita y gana</p>
      <p className="text-xs text-ink/50 mb-5">
        Invita a una amiga. Cuando complete su primera cita, ambas reciben una recompensa.
      </p>

      <div className="rounded-2xl p-4 mb-5" style={{ background: 'var(--color-ink)' }}>
        <p className="text-[11px] text-white/60">Referidos recompensados</p>
        <p className="text-2xl text-white font-medium mt-1">{recompensados}</p>
      </div>

      <p className="text-sm font-medium text-ink mb-2">Invitar por teléfono</p>
      <div className="flex gap-2 mb-2">
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+504 0000-0000"
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border border-ink/10 outline-none"
        />
        <button
          onClick={invitar}
          disabled={enviando || !telefono.trim()}
          className="px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}
        >
          Invitar
        </button>
      </div>
      {mensaje && <p className="text-xs mb-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}

      <p className="text-sm font-medium text-ink mt-6 mb-2">Tus invitaciones</p>
      {referidos.length === 0 && <p className="text-sm text-ink/50">Todavía no has invitado a nadie.</p>}
      <div className="flex flex-col gap-2">
        {referidos.map((r) => (
          <div key={r.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: 'var(--color-accent)' }}>
            <p className="text-sm text-ink">{r.telefono_referido}</p>
            <span className="text-[10px] font-medium px-2 py-1 rounded-full text-white" style={{ background: colorEstado[r.estado] }}>
              {etiquetaEstado[r.estado]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
