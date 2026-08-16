import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

const HORAS_DISPONIBLES = ['10:00', '11:30', '14:00', '15:30', '17:00']

export default function Agenda() {
  const [especialistas, setEspecialistas] = useState([])
  const [especialistaId, setEspecialistaId] = useState(null)
  const [hora, setHora] = useState(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [paciente, setPaciente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      const pacienteActual = await obtenerPacienteActual()
      setPaciente(pacienteActual)

      if (pacienteActual) {
        const { data } = await supabase
          .from('especialistas')
          .select('*')
          .eq('clinica_id', pacienteActual.clinica_id)
          .eq('activo', true)

        setEspecialistas(data || [])
        if (data && data.length > 0) setEspecialistaId(data[0].id)
      }
      setCargando(false)
    }
    cargar()
  }, [])

  async function confirmarCita() {
    if (!especialistaId || !hora || !paciente) return
    setEnviando(true)
    setError('')

    const fechaHora = new Date(`${fecha}T${hora}:00`).toISOString()

    const { error: errorInsert } = await supabase.from('citas').insert({
      clinica_id: paciente.clinica_id,
      paciente_id: paciente.id,
      especialista_id: especialistaId,
      fecha_hora: fechaHora,
      estado: 'pendiente',
    })

    if (errorInsert) {
      setError('No se pudo reservar la cita. Intenta de nuevo.')
    } else {
      setConfirmacion(`Cita reservada para el ${fecha} a las ${hora}.`)
    }
    setEnviando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando agenda...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para reservar una cita.</p>

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 font-body">
      <p className="font-display text-xl text-ink mb-4">Reservar cita</p>

      {confirmacion ? (
        <p className="text-sm text-ink bg-accent rounded-xl p-4">{confirmacion}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-ink mb-2">Especialista</p>
          {especialistas.length === 0 && (
            <p className="text-sm text-ink/60 mb-4">Esta clínica todavía no tiene especialistas registrados.</p>
          )}
          {especialistas.map((esp) => (
            <button
              key={esp.id}
              onClick={() => setEspecialistaId(esp.id)}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 text-left"
              style={{
                background: 'var(--color-accent)',
                border: `1.5px solid ${especialistaId === esp.id ? 'var(--color-primary)' : 'transparent'}`,
              }}
            >
              <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
              <div>
                <p className="text-sm font-medium text-ink">{esp.nombre}</p>
                <p className="text-xs text-ink/60">{esp.especialidad}</p>
              </div>
            </button>
          ))}

          <p className="text-sm font-medium text-ink mt-5 mb-2">Fecha</p>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-ink/15 rounded-xl px-4 py-2.5 text-sm w-full"
          />

          <p className="text-sm font-medium text-ink mt-5 mb-2">Horario</p>
          <div className="grid grid-cols-3 gap-2">
            {HORAS_DISPONIBLES.map((h) => (
              <button
                key={h}
                onClick={() => setHora(h)}
                className="rounded-lg py-2 text-sm"
                style={{
                  background: hora === h ? 'var(--color-primary)' : 'var(--color-accent)',
                  color: hora === h ? '#FFFFFF' : 'var(--color-ink)',
                }}
              >
                {h}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <button
            onClick={confirmarCita}
            disabled={!especialistaId || !hora || enviando}
            className="w-full rounded-xl py-3 text-white text-sm font-medium mt-6 disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {enviando ? 'Reservando...' : 'Confirmar cita'}
          </button>
        </>
      )}
    </div>
  )
}
