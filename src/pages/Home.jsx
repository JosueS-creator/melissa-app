import { useEffect, useState } from 'react'
import BeautyScore from '../components/BeautyScore'
import { obtenerPacienteActual } from '../lib/auth'
import { calcularBeautyScore } from '../lib/beautyScore'

export default function Home({ nombrePaciente = 'Paciente' }) {
  const [score, setScore] = useState(null)

  useEffect(() => {
    obtenerPacienteActual().then(async (paciente) => {
      if (!paciente) return
      const s = await calcularBeautyScore(paciente.id)
      setScore(s)
    })
  }, [])

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen font-body">
      <div className="px-5 pt-5 pb-6" style={{ background: 'var(--color-accent)' }}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-ink/60">Buenas tardes</p>
            <p className="font-display text-lg text-ink">{nombrePaciente}</p>
          </div>
          <BeautyScore valor={score ?? 0} />
        </div>
        <p className="mt-3 text-[11px] tracking-wide uppercase" style={{ color: 'var(--color-primary)' }}>
          Beauty score
        </p>
      </div>

      <div className="px-5 pt-4">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-ink)' }}>
          <p className="text-xs" style={{ color: 'var(--color-accent)' }}>Promoción de agosto</p>
          <p className="font-display text-base text-white mt-1">20% en limpieza facial premium</p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <button
          className="w-full rounded-xl py-3 text-white text-sm font-medium"
          style={{ background: 'var(--color-primary)' }}
        >
          Reservar cita
        </button>
      </div>

      <div className="px-5 pt-5">
        <p className="text-sm font-medium text-ink mb-2">Tu progreso</p>
        <div className="flex gap-2.5">
          <div className="flex-1 h-20 rounded-xl flex items-end justify-center pb-2" style={{ background: 'var(--color-accent)' }}>
            <span className="text-[11px] text-ink/60">Antes</span>
          </div>
          <div className="flex-1 h-20 rounded-xl flex items-end justify-center pb-2 border" style={{ background: 'var(--color-accent)', borderColor: 'var(--color-primary)' }}>
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-primary)' }}>Ahora</span>
          </div>
        </div>
      </div>
    </div>
  )
}
