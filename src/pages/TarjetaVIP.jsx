import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import { calcularNivelYProgreso, obtenerUmbrales } from '../lib/fidelidad'
import logoMelissa from '../assets/melissa-logo-64.png'
import logoMelissaMarcaAgua from '../assets/melissa-logo-256.png'

/** Prefijo que usamos para reconocer nuestros propios QR al escanearlos
 * (así el escáner del admin no confunde un QR de Melissa con cualquier
 * otro código que apunte a la cámara). */
export const PREFIJO_QR_CLIENTE = 'melissa:cliente:'

const ESTADOS_CANJE = {
  pendiente: { texto: 'Pendiente de aprobación', color: 'var(--color-dorado)' },
  aplicado: { texto: 'Aplicado', color: '#4F7A3E' },
  rechazado: { texto: 'Rechazado', color: '#B0524A' },
  cancelado: { texto: 'Cancelado', color: 'var(--color-texto-terciario)' },
}

export default function TarjetaVIP({ onNavigate }) {
  const [paciente, setPaciente] = useState(null)
  const [puntos, setPuntos] = useState(0)
  const [umbrales, setUmbrales] = useState(null)
  const [recompensas, setRecompensas] = useState([])
  const [canjes, setCanjes] = useState([])
  const [qrDataUrl, setQrDataUrl] = useState(null)
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
    setUmbrales(await obtenerUmbrales(p.clinica_id))

    const { data: dataRecompensas } = await supabase
      .from('recompensas')
      .select('id, nombre, costo_puntos')
      .eq('clinica_id', p.clinica_id)
      .eq('activa', true)
      .order('orden')
    setRecompensas(dataRecompensas || [])

    const { data: dataCanjes } = await supabase
      .from('canjes')
      .select('id, recompensa_nombre, puntos, codigo, estado, fecha_solicitud, nota')
      .order('fecha_solicitud', { ascending: false })
      .limit(8)
    setCanjes(dataCanjes || [])

    const url = await QRCode.toDataURL(`${PREFIJO_QR_CLIENTE}${p.id}`, {
      margin: 0,
      width: 240,
      color: { dark: '#4A0E2B', light: '#FFFFFF' },
    })
    setQrDataUrl(url)

    setCargando(false)
  }

  async function canjear(recompensa) {
    if (!paciente || puntos < recompensa.costo_puntos) return
    setCanjeando(true)
    setMensaje('')

    const { data: resultado, error } = await supabase.rpc('solicitar_canje', { p_recompensa_id: recompensa.id })

    if (error || resultado?.resultado !== 'ok') {
      const motivo = resultado?.resultado
      setMensaje(
        motivo === 'puntos_insuficientes'
          ? 'No tienes puntos suficientes.'
          : motivo === 'no_disponible'
            ? 'Esa recompensa ya no está disponible.'
            : 'No se pudo solicitar el canje. Intenta de nuevo.'
      )
    } else {
      setMensaje(`Solicitud enviada. Muestra el código ${resultado.codigo} en recepción para que apliquen tu "${recompensa.nombre}".`)
      setMostrarCanje(false)
      cargar()
    }
    setCanjeando(false)
  }

  async function cancelarCanje(canje) {
    setMensaje('')
    const { data: resultado, error } = await supabase.rpc('cancelar_canje', { p_canje_id: canje.id })
    if (error || resultado?.resultado !== 'ok') {
      setMensaje('No se pudo cancelar la solicitud. Quizá el negocio ya la resolvió.')
    } else {
      setMensaje(`Solicitud cancelada. Se devolvieron ${resultado.puntos_devueltos} puntos.`)
    }
    cargar()
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando tarjeta...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tu tarjeta.</p>

  const { nivelActual } = calcularNivelYProgreso(puntos, umbrales)
  const codigoInterno = `MEL · ${paciente.id.slice(0, 4).toUpperCase()}`

  return (
    <div
      className="font-body px-5 pb-10"
      style={{ background: 'var(--color-fondo-app)', paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}
    >
      <div className="flex flex-col items-center mb-5">
        <img src={logoMelissa} alt="Melissa" className="w-16 h-16 rounded-2xl" />
        <p className="mt-2" style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-dorado)' }}>
          Miembro {nivelActual.nombre}
        </p>
      </div>

      <div className="rounded-2xl p-5 shadow-tarjeta-oscura relative overflow-hidden" style={{ background: 'var(--gradiente-fondo-oscuro)', border: '1px solid var(--color-dorado)' }}>
        <img
          src={logoMelissaMarcaAgua}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ top: -20, right: -30, width: 180, height: 180, opacity: 0.13, objectFit: 'contain' }}
        />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#FFFFFF' }}>{paciente.nombre}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(233,169,193,0.75)' }}>{codigoInterno}</p>

        <div className="h-px my-4" style={{ background: 'rgba(235,203,134,0.3)' }} />

        <p style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-dorado-claro)' }}>Saldo</p>
        <p className="mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--color-dorado)' }}>{puntos.toLocaleString()}</p>

        <div className="bg-white rounded-lg mx-auto mt-5 p-2" style={{ width: 96, height: 96 }}>
          {qrDataUrl && <img src={qrDataUrl} alt="Código QR de tu tarjeta" className="w-full h-full object-contain" />}
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
          <p className="text-[11px] text-center" style={{ color: 'var(--color-texto-secundario)' }}>
            Al pedir un canje, tus puntos quedan reservados y el negocio lo aprueba y aplica el descuento en tu compra.
          </p>
          {recompensas.length === 0 && (
            <p className="text-center text-xs" style={{ color: 'var(--color-texto-secundario)' }}>Tu negocio aún no tiene recompensas configuradas.</p>
          )}
          {recompensas.map((r) => {
            const alcanza = puntos >= r.costo_puntos
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
                  {r.costo_puntos} pts
                </span>
              </button>
            )
          })}
        </div>
      )}

      {mensaje && <p className="text-center text-xs mt-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}

      {canjes.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.16em', color: 'var(--color-dorado)' }}>Mis canjes</p>
          <div className="flex flex-col gap-2">
            {canjes.map((c) => {
              const estado = ESTADOS_CANJE[c.estado] || ESTADOS_CANJE.pendiente
              return (
                <div key={c.id} className="rounded-xl px-4 py-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{c.recompensa_nombre}</p>
                    <span className="text-[11px] font-medium flex-shrink-0" style={{ color: estado.color }}>{estado.texto}</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-texto-secundario)' }}>
                    Código <strong style={{ color: 'var(--color-ink)', letterSpacing: '0.1em' }}>{c.codigo}</strong> · {c.puntos} pts ·{' '}
                    {new Date(c.fecha_solicitud).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}
                  </p>
                  {c.estado === 'rechazado' && c.nota && (
                    <p className="text-[11px] mt-1" style={{ color: '#B0524A' }}>Motivo: {c.nota} · tus puntos fueron devueltos.</p>
                  )}
                  {c.estado === 'pendiente' && (
                    <button onClick={() => cancelarCanje(c)} className="text-[11px] mt-1.5" style={{ color: '#B0524A' }}>
                      Cancelar solicitud
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
