import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import logoMelissaMarcaAgua from '../assets/melissa-logo-256.png'

const HORAS_DISPONIBLES = ['09:00', '09:45', '10:30', '11:15', '14:00', '15:30']

function proximosDias(cantidad = 5) {
  const dias = []
  for (let i = 0; i < cantidad; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dias.push(d)
  }
  return dias
}

export default function Agenda() {
  const [especialistas, setEspecialistas] = useState([])
  const [especialistaId, setEspecialistaId] = useState(null)
  const [servicios, setServicios] = useState([])
  const [servicioId, setServicioId] = useState(null)
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => new Date().toISOString().slice(0, 10))
  const [hora, setHora] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')

  const dias = proximosDias()

  useEffect(() => {
    async function cargar() {
      const pacienteActual = await obtenerPacienteActual()
      setPaciente(pacienteActual)

      if (pacienteActual) {
        const [{ data: dataEsp }, { data: dataServ }] = await Promise.all([
          supabase.from('especialistas').select('*').eq('clinica_id', pacienteActual.clinica_id).eq('activo', true),
          supabase.from('servicios').select('*').eq('clinica_id', pacienteActual.clinica_id).eq('activo', true).order('nombre'),
        ])

        setEspecialistas(dataEsp || [])
        if (dataEsp && dataEsp.length > 0) setEspecialistaId(dataEsp[0].id)
        setServicios(dataServ || [])
        if (dataServ && dataServ.length > 0) setServicioId(dataServ[0].id)
      }
      setCargando(false)
    }
    cargar()
  }, [])

  const servicioSeleccionado = servicios.find((s) => s.id === servicioId)

  async function confirmarCita() {
    if (!especialistaId || !hora || !paciente) return
    setEnviando(true)
    setError('')

    const fechaHora = new Date(`${diaSeleccionado}T${hora}:00`).toISOString()

    const { error: errorInsert } = await supabase.from('citas').insert({
      clinica_id: paciente.clinica_id,
      paciente_id: paciente.id,
      especialista_id: especialistaId,
      fecha_hora: fechaHora,
      estado: 'pendiente',
      tratamiento: servicioSeleccionado?.nombre || 'Consulta general',
    })

    if (errorInsert) {
      setError('No se pudo reservar la cita. Intenta de nuevo.')
    } else {
      setConfirmacion(`Cita reservada · ${new Date(fechaHora).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}, ${hora}`)
    }
    setEnviando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando agenda...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para reservar una cita.</p>

  return (
    <div className="font-body" style={{ background: 'var(--color-fondo-app)' }}>
      {/* Header */}
      <div
        className="relative overflow-hidden px-5 pb-5"
        style={{ background: 'var(--gradiente-fondo-oscuro)', paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
      >
        <img
          src={logoMelissaMarcaAgua}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ top: -20, right: -30, width: 180, height: 180, opacity: 0.13, objectFit: 'contain' }}
        />
        <p style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-dorado-claro)' }}>
          Reservar
        </p>
        <p className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.15, color: '#FFFFFF' }}>
          {servicioSeleccionado?.nombre || 'Nueva cita'}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'rgba(233,169,193,0.85)' }}>
          {servicioSeleccionado
            ? `${servicioSeleccionado.duracion_minutos} min · L ${Number(servicioSeleccionado.precio).toFixed(0)}`
            : especialistas.find((e) => e.id === especialistaId)?.especialidad || 'Elige un servicio'}
        </p>
      </div>

      <div className="px-5 pt-5 pb-10">
        {confirmacion ? (
          <div className="rounded-xl p-4" style={{ background: 'var(--color-accent)' }}>
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{confirmacion}</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Servicio</p>
            {servicios.length === 0 && (
              <p className="text-sm mb-4" style={{ color: 'var(--color-texto-secundario)' }}>
                Este negocio todavía no tiene servicios registrados.
              </p>
            )}
            <div className="flex flex-col gap-2 mb-5">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServicioId(s.id)}
                  className="w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-left"
                  style={{
                    background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)',
                    border: `1px solid ${servicioId === s.id ? 'var(--color-primary)' : 'var(--color-borde-tarjeta)'}`,
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{s.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>{s.duracion_minutos} min</p>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>L {Number(s.precio).toFixed(0)}</p>
                </button>
              ))}
            </div>

            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Especialista</p>
            {especialistas.length === 0 && (
              <p className="text-sm mb-4" style={{ color: 'var(--color-texto-secundario)' }}>
                Este negocio todavía no tiene especialistas registrados.
              </p>
            )}
            <div className="flex flex-col gap-2 mb-5">
              {especialistas.map((esp) => (
                <button
                  key={esp.id}
                  onClick={() => setEspecialistaId(esp.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left"
                  style={{
                    background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)',
                    border: `1px solid ${especialistaId === esp.id ? 'var(--color-primary)' : 'var(--color-borde-tarjeta)'}`,
                  }}
                >
                  <div className="w-[34px] h-[34px] rounded-full flex-shrink-0" style={{ background: 'var(--gradiente-dorado)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{esp.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>{esp.especialidad}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Fecha</p>
            <div className="flex gap-2 mb-5 overflow-x-auto">
              {dias.map((d) => {
                const iso = d.toISOString().slice(0, 10)
                const activo = iso === diaSeleccionado
                return (
                  <button
                    key={iso}
                    onClick={() => setDiaSeleccionado(iso)}
                    className="flex flex-col items-center justify-center rounded-xl flex-shrink-0"
                    style={{
                      width: 52,
                      height: 58,
                      background: activo ? 'var(--gradiente-primario)' : '#FFFFFF',
                      border: activo ? 'none' : '1px solid var(--color-borde-tarjeta)',
                      color: activo ? '#FFFFFF' : 'var(--color-ink)',
                    }}
                  >
                    <span className="text-[10px] uppercase" style={{ opacity: 0.8 }}>
                      {d.toLocaleDateString('es-HN', { weekday: 'short' })}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{d.getDate()}</span>
                  </button>
                )
              })}
            </div>

            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Horarios disponibles</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {HORAS_DISPONIBLES.map((h) => (
                <button
                  key={h}
                  onClick={() => setHora(h)}
                  className="rounded-lg py-2.5 text-sm"
                  style={{
                    background: hora === h ? 'var(--color-fondo-app)' : '#FFFFFF',
                    border: `1px solid ${hora === h ? 'var(--color-dorado)' : 'var(--color-borde-tarjeta)'}`,
                    color: hora === h ? 'var(--color-primary)' : 'var(--color-ink)',
                    fontWeight: hora === h ? 600 : 400,
                  }}
                >
                  {h}
                </button>
              ))}
            </div>

            {error && <p className="text-sm mb-3" style={{ color: '#B0524A' }}>{error}</p>}

            <button
              onClick={confirmarCita}
              disabled={!especialistaId || !hora || enviando}
              className="w-full rounded-[10px] py-3 text-white shadow-boton-primario disabled:opacity-50"
              style={{ background: 'var(--gradiente-primario)', font: "500 13px/1 var(--font-body)", letterSpacing: '0.04em' }}
            >
              {enviando ? 'Reservando...' : `Confirmar cita${hora ? ` · ${new Date(diaSeleccionado).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}, ${hora}` : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
