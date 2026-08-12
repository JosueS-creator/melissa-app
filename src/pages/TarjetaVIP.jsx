import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

export default function TarjetaVIP() {
  const [paciente, setPaciente] = useState(null)
  const [puntos, setPuntos] = useState(0)
  const [membresia, setMembresia] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const p = await obtenerPacienteActual()
      setPaciente(p)
      if (!p) {
        setCargando(false)
        return
      }

      const [{ data: movimientos }, { data: membresias }] = await Promise.all([
        supabase.from('puntos_movimientos').select('puntos').eq('paciente_id', p.id),
        supabase
          .from('paciente_membresias')
          .select('*, membresias(*)')
          .eq('paciente_id', p.id)
          .eq('estado', 'activa')
          .limit(1),
      ])

      const totalPuntos = (movimientos || []).reduce((sum, m) => sum + m.puntos, 0)
      setPuntos(totalPuntos)
      setMembresia(membresias?.[0]?.membresias ?? null)
      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando tarjeta...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tu tarjeta.</p>

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 font-body">
      <p className="font-display text-xl text-ink mb-5">Mi tarjeta</p>

      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, var(--color-ink), #4A3F30)' }}>
        <p className="text-[11px] tracking-wide uppercase" style={{ color: 'var(--color-primary)' }}>
          Nivel {membresia?.nivel ?? 'sin membresía'}
        </p>
        <p className="font-display text-lg text-white mt-1.5 mb-6">{paciente.nombre}</p>
        <p className="text-2xl text-white font-medium">{puntos.toLocaleString()}</p>
        <p className="text-[11px] text-white/60 mt-0.5">Puntos acumulados</p>

        <div className="w-24 h-24 bg-white rounded-lg mx-auto mt-5 flex items-center justify-center">
          <span className="text-[10px] text-ink/40 text-center px-2">
            Código QR: {paciente.id.slice(0, 8)}
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-ink/50 mt-3">Muestra este código en recepción</p>

      {!membresia && (
        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-primary)' }}>
          Todavía no tienes una membresía activa.
        </p>
      )}
    </div>
  )
}
