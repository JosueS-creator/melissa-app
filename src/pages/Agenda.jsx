import { useEffect, useState } from 'react'
import { leerReservaPromo, limpiarReservaPromo, formatearPorcentaje } from '../lib/promociones'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import { estadoDeCita, esProxima, aIsoLocal, fechaLocal, esHoraPasada, textoFechaHora } from '../lib/citas'
import logoMelissaMarcaAgua from '../assets/melissa-logo-256.png'
import ContactoNegocio from '../components/ContactoNegocio'

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

/** Mis citas: lo que el cliente solicitó y en qué estado está. El cliente no puede confirmar, completar ni cancelar. */
function MisCitas({ pacienteId, refresco }) {
  const [citas, setCitas] = useState(null)
  const [verAnteriores, setVerAnteriores] = useState(false)

  useEffect(() => {
    supabase
      .from('citas')
      .select('id, fecha_hora, estado, tratamiento, especialistas(nombre)')
      .eq('paciente_id', pacienteId)
      .order('fecha_hora', { ascending: false })
      .limit(30)
      .then(({ data }) => setCitas(data || []))
  }, [pacienteId, refresco])

  if (!citas) return null
  const proximas = citas.filter((c) => esProxima(c)).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
  const anteriores = citas.filter((c) => !esProxima(c)).slice(0, 5)

  const fila = (c) => {
    const estado = estadoDeCita(c)
    return (
      <div key={c.id} className="rounded-xl px-3.5 py-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{c.tratamiento || 'Cita'}</p>
        <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>
          {textoFechaHora(c.fecha_hora)}{c.especialistas?.nombre ? ` · ${c.especialistas.nombre}` : ''}
        </p>
        <p className="text-[11px] font-medium mt-1" style={{ color: estado.color }}>{estado.texto}</p>
        {c.estado === 'pendiente' && esProxima(c) && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-texto-terciario)' }}>El negocio te confirmará o te propondrá otro horario.</p>
        )}
      </div>
    )
  }

  return (
    <div className="mb-6">
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Mis citas</p>
      {proximas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-texto-secundario)' }}>No tienes citas próximas.</p>
      ) : (
        <div className="flex flex-col gap-2">{proximas.map(fila)}</div>
      )}
      {proximas.length > 0 && (
        <>
          <p className="text-[10px] mt-2" style={{ color: 'var(--color-texto-terciario)' }}>
            Para cambiar o cancelar una cita, comunícate con el negocio: desde Melissa solo puedes solicitar citas nuevas.
          </p>
          <ContactoNegocio />
        </>
      )}
      {anteriores.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setVerAnteriores((v) => !v)} className="text-xs" style={{ color: 'var(--color-primary)' }}>
            Citas anteriores ({anteriores.length}) {verAnteriores ? '▴' : '▾'}
          </button>
          {verAnteriores && <div className="flex flex-col gap-2 mt-2">{anteriores.map(fila)}</div>}
        </div>
      )}
    </div>
  )
}

export default function Agenda() {
  const [especialistas, setEspecialistas] = useState([])
  const [especialistaId, setEspecialistaId] = useState(null)
  const [servicios, setServicios] = useState([])
  const [servicioId, setServicioId] = useState(null)
  const [promo, setPromo] = useState(() => leerReservaPromo())   // promoción elegida en "Reservar ahora"
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => aIsoLocal(new Date()))
  const [refresco, setRefresco] = useState(0)
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
        const preferido = promo?.servicio_id && dataServ?.some((s) => s.id === promo.servicio_id) ? promo.servicio_id : dataServ?.[0]?.id
        if (preferido) setServicioId(preferido)
      }
      setCargando(false)
    }
    cargar()
  }, [])

  const servicioSeleccionado = servicios.find((s) => s.id === servicioId)
  // Una hora ya pasada de hoy no se puede solicitar (el sistema sí sabe qué hora es; no sabe la disponibilidad del negocio).
  const horaEfectiva = hora && !esHoraPasada(diaSeleccionado, hora) ? hora : null
  const quedanHorasHoy = HORAS_DISPONIBLES.some((h) => !esHoraPasada(diaSeleccionado, h))

  async function confirmarCita() {
    if (!especialistaId || !horaEfectiva || !paciente) return
    setEnviando(true)
    setError('')

    const fechaHora = new Date(`${diaSeleccionado}T${horaEfectiva}:00`).toISOString()

    const { error: errorInsert } = await supabase.from('citas').insert({
      clinica_id: paciente.clinica_id,
      paciente_id: paciente.id,
      especialista_id: especialistaId,
      fecha_hora: fechaHora,
      estado: 'pendiente',
      servicio_id: servicioSeleccionado?.id || null,
      promocion_id: promo?.id || null,
      tratamiento: servicioSeleccionado?.nombre || 'Consulta general',
    })

    if (errorInsert) {
      setError('No se pudo enviar la solicitud. Revisa que la fecha y la hora sean futuras e intenta de nuevo.')
    } else {
      limpiarReservaPromo()
      setConfirmacion(`${new Date(fechaHora).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}, ${horaEfectiva}`)
      setRefresco((n) => n + 1)
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
          Solicitar cita
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
        {promo && !confirmacion && (
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-2" style={{ background: 'var(--color-accent)' }}>
            <p className="text-xs" style={{ color: 'var(--color-ink)' }}>
              🎁 Solicitando cita con la promoción <strong>{promo.titulo}</strong> ({formatearPorcentaje(promo.descuento_porcentaje)}). El negocio aplica el descuento al cobrar.
            </p>
            <button onClick={() => { limpiarReservaPromo(); setPromo(null) }} className="text-[11px] flex-shrink-0" style={{ color: 'var(--color-primary)' }}>Quitar</button>
          </div>
        )}
        <MisCitas pacienteId={paciente.id} refresco={refresco} />

        {confirmacion ? (
          <div className="rounded-xl p-4" style={{ background: 'var(--color-accent)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>Solicitud enviada · {confirmacion}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-ink)' }}>Tu cita todavía <strong>no está confirmada</strong>: el negocio la confirmará o te propondrá otro horario. Verás el cambio en «Mis citas».</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium mb-3 pt-1" style={{ color: 'var(--color-ink)', borderTop: '1px solid var(--color-borde-tarjeta)', paddingTop: 16 }}>Solicitar una cita nueva</p>
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
                const iso = aIsoLocal(d)
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
                      boxShadow: activo ? '0 3px 8px rgba(201,59,121,0.3)' : 'none',
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

            <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--color-ink)' }}>Horarios sugeridos</p>
            <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-secundario)' }}>
              Elige el horario que prefieres. El negocio no publica su disponibilidad aquí: tu solicitud queda pendiente hasta que la confirme o te proponga otro horario.
            </p>
            {!quedanHorasHoy && <p className="text-xs mb-2" style={{ color: '#B08D3E' }}>Ya no quedan horarios sugeridos para este día: elige otro.</p>}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {HORAS_DISPONIBLES.map((h) => {
                const pasada = esHoraPasada(diaSeleccionado, h)
                const activa = horaEfectiva === h
                return (
                  <button
                    key={h}
                    onClick={() => setHora(h)}
                    disabled={pasada}
                    className="rounded-lg py-2.5 text-sm disabled:opacity-40"
                    style={{
                      background: activa ? 'var(--color-fondo-app)' : '#FFFFFF',
                      border: `1px solid ${activa ? 'var(--color-dorado)' : 'var(--color-borde-tarjeta)'}`,
                      color: activa ? 'var(--color-primary)' : 'var(--color-ink)',
                      fontWeight: activa ? 600 : 400,
                    }}
                  >
                    {h}
                  </button>
                )
              })}
            </div>

            {error && <p className="text-sm mb-3" style={{ color: '#B0524A' }}>{error}</p>}

            <button
              onClick={confirmarCita}
              disabled={!especialistaId || !horaEfectiva || enviando}
              className="w-full rounded-[10px] py-3 text-white shadow-boton-primario disabled:opacity-50"
              style={{ background: 'var(--gradiente-primario)', font: "500 13px/1 var(--font-body)", letterSpacing: '0.04em' }}
            >
              {enviando ? 'Enviando...' : `Solicitar cita${horaEfectiva ? ` · ${fechaLocal(diaSeleccionado).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}, ${horaEfectiva}` : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
