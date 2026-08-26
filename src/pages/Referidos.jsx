import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import logoMelissa from '../assets/melissa-logo-64.png'
import logoMelissaMarcaAgua from '../assets/melissa-logo-256.png'

const META_MENSUAL = 5

export default function Referidos({ onVolver }) {
  const [paciente, setPaciente] = useState(null)
  const [referidos, setReferidos] = useState([])
  const [codigo, setCodigo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [copiado, setCopiado] = useState(false)

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

    const [{ data: refs }, { data: codigoData }] = await Promise.all([
      supabase.from('referidos').select('*').eq('paciente_referidor_id', p.id).order('fecha', { ascending: false }),
      supabase.rpc('generar_codigo_referido', { p_paciente_id: p.id }),
    ])

    setReferidos(refs || [])
    setCodigo(codigoData || '')
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
      codigo,
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

  function copiarCodigo() {
    navigator.clipboard?.writeText(codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tus referidos.</p>

  const recompensados = referidos.filter((r) => r.estado === 'recompensado').length
  const registrados = referidos.filter((r) => r.estado === 'registrado' || r.estado === 'recompensado').length
  const progresoMeta = Math.min((registrados / META_MENSUAL) * 100, 100)

  const colorEstado = { invitado: '#B08D3E', registrado: '#2D6E8E', recompensado: '#6B8E5A' }
  const etiquetaEstado = { invitado: 'Invitado', registrado: 'Registrada · cita pendiente', recompensado: 'Primera cita completada' }

  return (
    <div className="font-body pb-10" style={{ background: 'var(--color-fondo-app)' }}>
      <div
        className="px-5 pb-6 flex flex-col items-center text-center relative overflow-hidden"
        style={{ background: 'var(--gradiente-fondo-oscuro)', paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
      >
        <img
          src={logoMelissaMarcaAgua}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ top: -20, right: -30, width: 180, height: 180, opacity: 0.13, objectFit: 'contain' }}
        />
        {onVolver && (
          <button onClick={onVolver} className="text-xs self-start mb-3" style={{ color: 'var(--color-dorado-claro)' }}>‹ Volver</button>
        )}
        <img src={logoMelissa} alt="Melissa" className="w-11 h-11 rounded-xl" />
        <p className="mt-3" style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#FFFFFF', lineHeight: 1.2 }}>
          Invita y ganan las dos
        </p>
        <p className="text-xs mt-2" style={{ color: 'rgba(233,169,193,0.85)' }}>
          Ella recibe 20% en su primera cita. Tú, 500 Beauty Points.
        </p>
      </div>

      <div className="px-5 -mt-4">
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--gradiente-dorado)' }}>
          <div>
            <p className="text-[10px] uppercase" style={{ letterSpacing: '0.14em', color: 'rgba(74,14,43,0.6)' }}>Tu código</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-ink)' }}>{codigo}</p>
          </div>
          <button
            onClick={copiarCodigo}
            className="px-4 py-2 rounded-lg text-white text-xs font-medium"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            {copiado ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="flex justify-between items-baseline mb-1.5">
          <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{registrados} de {META_MENSUAL} invitadas</p>
          <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>Meta del mes</span>
        </div>
        <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--color-accent)' }}>
          <div className="h-full rounded-full" style={{ width: `${progresoMeta}%`, background: 'var(--gradiente-primario)' }} />
        </div>
        {registrados < META_MENSUAL && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-texto-secundario)' }}>
            {META_MENSUAL - registrados} más y desbloqueas una limpieza facial gratis
          </p>
        )}

        <p className="text-sm font-medium mt-6 mb-2" style={{ color: 'var(--color-ink)' }}>Invitar por teléfono</p>
        <div className="flex gap-2 mb-2">
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+504 0000-0000"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm bg-white"
            style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          />
          <button
            onClick={invitar}
            disabled={enviando || !telefono.trim()}
            className="px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            Invitar
          </button>
        </div>
        {mensaje && <p className="text-xs mb-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}

        <p className="text-sm font-medium mt-6 mb-2" style={{ color: 'var(--color-ink)' }}>Tus invitadas</p>
        {referidos.length === 0 && <p className="text-sm" style={{ color: 'var(--color-texto-secundario)' }}>Todavía no has invitado a nadie.</p>}
        <div className="flex flex-col gap-2">
          {referidos.map((r) => (
            <div key={r.id} className="rounded-xl px-3.5 py-3 flex justify-between items-center" style={{ background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)', border: '1px solid var(--color-borde-tarjeta)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full" style={{ background: 'var(--color-accent)' }} />
                <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{r.telefono_referido}</p>
              </div>
              <span className="text-[10px] font-medium" style={{ color: colorEstado[r.estado] }}>
                {r.estado === 'recompensado' ? '+500' : etiquetaEstado[r.estado]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
