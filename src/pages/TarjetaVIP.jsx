import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import { calcularNivelYProgreso } from '../lib/fidelidad'
import logoMelissa from '../assets/melissa-logo-64.png'

const RECOMPENSAS = [
  { id: 'descuento_100', nombre: 'L 100 de descuento', costo: 300 },
  { id: 'limpieza_facial', nombre: 'Limpieza facial gratis', costo: 800 },
  { id: 'sesion_gratis', nombre: 'Sesión de tratamiento gratis', costo: 1500 },
]

function PatronCodigo({ semilla }) {
  const celdas = []
  for (let i = 0; i < 64; i++) {
    const char = semilla.charCodeAt(i % semilla.length) + i
    const color = char % 3 === 0 ? 'var(--color-ink)' : char % 3 === 1 ? '#8FD1A8' : '#FFFFFF'
    celdas.push(color)
  }
  return (
    <div className="grid grid-cols-8 gap-[2px] w-full h-full">
      {celdas.map((c, i) => (
        <div key={i} style={{ background: c }} />
      ))}
    </div>
  )
}

export default function TarjetaVIP({ onNavigate }) {
  const [paciente, setPaciente] = useState(null)
  const [puntos, setPuntos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [mostrarCanje, setMostrarCanje] = useState(false)
  const [canjeando, setCanjeando] = useState(false)
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
    const { data: movimientos } = await supabase.from('puntos_movimientos').select('puntos').eq('paciente_id', p.id)
    setPuntos((movimientos || []).reduce((sum, m) => sum + m.puntos, 0))
    setCargando(false)
  }

  async function canjear(recompensa) {
    if (!paciente || puntos < recompensa.costo) return
    setCanjeando(true)
    setMensaje('')

    const { error } = await supabase.from('puntos_movimientos').insert({
      clinica_id: paciente.clinica_id,
      paciente_id: paciente.id,
      tipo: 'canje',
      puntos: -recompensa.costo,
      motivo: `Canje: ${recompensa.nombre}`,
    })

    if (error) {
      setMensaje('No se pudo canjear. Intenta de nuevo.')
    } else {
      setMensaje(`¡Canjeaste "${recompensa.nombre}"! Muéstralo en recepción.`)
      setMostrarCanje(false)
      cargar()
    }
    setCanjeando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando tarjeta...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tu tarjeta.</p>

  const { nivelActual } = calcularNivelYProgreso(puntos)
  const codigoInterno = `MEL · ${paciente.id.slice(0, 4).toUpperCase()}`

  return (
    <div
      className="min-h-screen font-body px-5 pb-10"
      style={{ background: 'var(--color-fondo-app)', paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}
    >
      <div className="flex flex-col items-center mb-5">
        <img src={logoMelissa} alt="Melissa" className="w-16 h-16 rounded-2xl" />
        <p className="mt-2" style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-dorado)' }}>
          Miembro {nivelActual.nombre}
        </p>
      </div>

      <div className="rounded-2xl p-5 shadow-tarjeta-oscura" style={{ background: 'var(--gradiente-fondo-oscuro)', border: '1px solid var(--color-dorado)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#FFFFFF' }}>{paciente.nombre}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(233,169,193,0.75)' }}>{codigoInterno}</p>

        <div className="h-px my-4" style={{ background: 'rgba(235,203,134,0.3)' }} />

        <p style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-dorado-claro)' }}>Saldo</p>
        <p className="mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--color-dorado)' }}>{puntos.toLocaleString()}</p>

        <div className="bg-white rounded-lg mx-auto mt-5 p-2" style={{ width: 96, height: 96 }}>
          <div className="relative w-full h-full">
            <PatronCodigo semilla={paciente.id} />
            <div className="absolute inset-0 flex items-center justify-center">
              <img src={logoMelissa} alt="" className="w-6 h-6 rounded-md bg-white p-0.5" />
            </div>
          </div>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: 'rgba(233,169,193,0.7)' }}>Muestra este código en recepción</p>
      </div>

      <div className="flex gap-2.5 mt-4">
        <button
          onClick={() => setMostrarCanje((v) => !v)}
          className="flex-1 rounded-[10px] py-2.5 text-sm"
          style={{ background: 'var(--gradiente-dorado)', color: 'var(--color-ink)', font: "500 12px/1 var(--font-body)" }}
        >
          Canjear puntos
        </button>
        <button
          onClick={() => onNavigate?.('referidos')}
          className="flex-1 rounded-[10px] py-2.5 text-white"
          style={{ background: 'var(--color-fondo-oscuro)', font: "500 12px/1 var(--font-body)" }}
        >
          Invitar amiga
        </button>
      </div>

      {mostrarCanje && (
        <div className="mt-4 flex flex-col gap-2">
          {RECOMPENSAS.map((r) => {
            const alcanza = puntos >= r.costo
            return (
              <button
                key={r.id}
                onClick={() => canjear(r)}
                disabled={!alcanza || canjeando}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left disabled:opacity-40"
                style={{ background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)', border: '1px solid var(--color-borde-tarjeta)' }}
              >
                <span className="text-sm" style={{ color: 'var(--color-ink)' }}>{r.nombre}</span>
                <span className="text-xs font-medium" style={{ color: alcanza ? 'var(--color-primary)' : 'var(--color-texto-terciario)' }}>
                  {r.costo} pts
                </span>
              </button>
            )
          })}
        </div>
      )}

      {mensaje && <p className="text-center text-xs mt-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
    </div>
  )
}
