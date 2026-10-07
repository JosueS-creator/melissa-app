import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS = [
  { id: 'servicio', etiqueta: 'Servicio' },
  { id: 'producto', etiqueta: 'Producto' },
  { id: 'membresia', etiqueta: 'Membresía' },
  { id: 'otro', etiqueta: 'Otro' },
]
const METODOS = [
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'tarjeta', etiqueta: 'Tarjeta' },
  { id: 'transferencia', etiqueta: 'Transferencia' },
]
const ESTADOS = {
  aplicado: { texto: 'Aplicado', color: '#4F7A3E' },
  rechazado: { texto: 'Rechazado', color: '#B0524A' },
  cancelado: { texto: 'Cancelado por el cliente', color: 'var(--color-texto-terciario)' },
}

function mensajeDeError(r) {
  switch (r?.resultado) {
    case 'no_encontrado': return 'Ese canje ya no existe.'
    case 'ya_resuelto': return 'Ese canje ya fue resuelto por otra persona.'
    case 'datos_invalidos': return 'Revisa el tipo de cobro y el método de pago.'
    case 'concepto_requerido': return 'Escribe qué se cobra: es la justificación del descuento en Caja.'
    case 'monto_invalido': return 'El monto del servicio o venta debe ser mayor que cero.'
    case 'descuento_invalido': return 'El descuento debe ser mayor que cero y no puede pasar del monto.'
    case 'descuento_excede_recompensa': return `El descuento no puede pasar de L ${Number(r.maximo).toFixed(2)} para esta recompensa.`
    case 'motivo_requerido': return 'Escribe el motivo del rechazo.'
    default: return 'No se pudo procesar. Intenta de nuevo.'
  }
}

const dinero = (n) => `L ${Number(n || 0).toFixed(2)}`
const fechaHora = (v) => new Date(v).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Canjes({ onCambio }) {
  const [pendientes, setPendientes] = useState([])
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [abierto, setAbierto] = useState(null) // { id, modo: 'aplicar' | 'rechazar' }
  const [procesando, setProcesando] = useState(false)
  const [concepto, setConcepto] = useState('Servicio')
  const [tipo, setTipo] = useState('servicio')
  const [bruto, setBruto] = useState('')
  const [descuento, setDescuento] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [motivo, setMotivo] = useState('')

  async function cargar() {
    const [pend, hist] = await Promise.all([
      supabase.from('canjes').select('*, pacientes(nombre, telefono)').eq('estado', 'pendiente').order('fecha_solicitud', { ascending: true }),
      supabase.from('canjes').select('*, pacientes(nombre)').neq('estado', 'pendiente').order('fecha_resolucion', { ascending: false }).limit(10),
    ])
    if (pend.error || hist.error) setError((pend.error || hist.error).message)
    else setError('')
    setPendientes(pend.data || [])
    setHistorial(hist.data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrir(canje, modo) {
    setMensaje('')
    setAbierto({ id: canje.id, modo })
    setConcepto('Servicio')
    setTipo('servicio')
    setBruto('')
    setDescuento(canje.valor_descuento ? String(canje.valor_descuento) : '')
    setMetodo('efectivo')
    setMotivo('')
  }

  async function terminar(texto) {
    setMensaje(texto)
    setAbierto(null)
    await cargar()
    onCambio?.()
  }

  async function aplicar(e, canje) {
    e.preventDefault()
    setProcesando(true)
    const { data, error: err } = await supabase.rpc('aplicar_canje', {
      p_canje_id: canje.id,
      p_monto_bruto: Number(bruto),
      p_descuento: Number(descuento),
      p_tipo: tipo,
      p_metodo_pago: metodo,
      p_concepto: concepto,
    })
    setProcesando(false)
    if (err || data?.resultado !== 'ok') {
      setMensaje(err ? 'No se pudo procesar. Intenta de nuevo.' : mensajeDeError(data))
      if (data?.resultado === 'ya_resuelto' || data?.resultado === 'no_encontrado') {
        setAbierto(null)
        cargar()
        onCambio?.()
      }
      return
    }
    await terminar(`Canje ${canje.codigo} aprobado. Se registró en Caja el cobro de ${dinero(data.cobrado)} con descuento de ${dinero(descuento)}.`)
  }

  async function rechazar(e, canje) {
    e.preventDefault()
    setProcesando(true)
    const { data, error: err } = await supabase.rpc('rechazar_canje', { p_canje_id: canje.id, p_nota: motivo })
    setProcesando(false)
    if (err || data?.resultado !== 'ok') {
      setMensaje(err ? 'No se pudo procesar. Intenta de nuevo.' : mensajeDeError(data))
      return
    }
    await terminar(`Canje ${canje.codigo} rechazado. Se devolvieron ${data.puntos_devueltos} puntos a ${canje.pacientes?.nombre || 'el cliente'}.`)
  }

  const neto = bruto !== '' && descuento !== '' ? Number(bruto) - Number(descuento) : null

  return (
    <div>
      <p className="font-display text-lg text-ink mb-0.5">Canjes de puntos</p>
      <p className="text-xs mb-4" style={{ color: 'var(--color-texto-secundario)' }}>
        Cuando un cliente pide un canje, sus puntos quedan reservados. Aquí lo apruebas y aplicas el descuento en el cobro, o lo rechazas y se le devuelven.
      </p>

      {mensaje && <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>{mensaje}</p>}
      {cargando && <p className="text-sm text-ink/50">Cargando canjes...</p>}
      {error && <p className="text-sm" style={{ color: '#B0524A' }}>No se pudieron cargar los canjes: {error}</p>}
      {!cargando && !error && pendientes.length === 0 && <p className="text-sm text-ink/50 mb-4">No hay canjes pendientes de aprobar.</p>}

      <div className="flex flex-col gap-3 mb-6">
        {pendientes.map((c) => (
          <div key={c.id} className="rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{c.pacientes?.nombre || 'Cliente'}</p>
                <p className="text-[11px] text-ink/50">{c.pacientes?.telefono || 'Sin teléfono'} · {fechaHora(c.fecha_solicitud)}</p>
              </div>
              <p className="text-base font-medium flex-shrink-0" style={{ letterSpacing: '0.12em', color: 'var(--color-primary)' }}>{c.codigo}</p>
            </div>
            <p className="text-sm text-ink mt-2">{c.recompensa_nombre}</p>
            <p className="text-[11px] text-ink/60">
              {c.puntos} puntos reservados{c.valor_descuento ? ` · descuento máximo ${dinero(c.valor_descuento)}` : ' · el valor del descuento lo defines tú al aprobar'}
            </p>

            {abierto?.id !== c.id && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => abrir(c, 'aplicar')} className="flex-1 rounded-lg py-2 text-xs font-medium text-white" style={{ background: 'var(--gradiente-primario)' }}>
                  Aprobar y aplicar en Caja
                </button>
                <button onClick={() => abrir(c, 'rechazar')} className="rounded-lg px-4 py-2 text-xs bg-white" style={{ color: '#B0524A' }}>
                  Rechazar
                </button>
              </div>
            )}

            {abierto?.id === c.id && abierto.modo === 'aplicar' && (
              <form onSubmit={(e) => aplicar(e, c)} className="flex flex-col gap-2 mt-3">
                <input className="rounded-lg px-3 py-2 text-sm bg-white" placeholder="Qué se cobra (ej. Limpieza facial)" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
                <div className="flex gap-2">
                  <select className="flex-1 rounded-lg px-3 py-2 text-sm bg-white" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
                  </select>
                  <select className="flex-1 rounded-lg px-3 py-2 text-sm bg-white" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                    {METODOS.map((m) => <option key={m.id} value={m.id}>{m.etiqueta}</option>)}
                  </select>
                </div>
                <input className="rounded-lg px-3 py-2 text-sm bg-white" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Monto total del servicio o venta (L)" value={bruto} onChange={(e) => setBruto(e.target.value)} required />
                <input className="rounded-lg px-3 py-2 text-sm bg-white" type="number" inputMode="decimal" min="0.01" step="0.01" max={c.valor_descuento || undefined} placeholder="Descuento por el canje (L)" value={descuento} onChange={(e) => setDescuento(e.target.value)} required />
                <div className="rounded-lg px-3 py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>
                  {neto !== null && neto >= 0 ? (
                    <p>El cliente paga: <strong>{dinero(neto)}</strong> (descuento {dinero(descuento)})</p>
                  ) : (
                    <p style={{ color: 'var(--color-texto-terciario)' }}>Escribe el monto y el descuento para ver cuánto paga el cliente.</p>
                  )}
                  <p className="mt-1" style={{ color: 'var(--color-texto-secundario)' }}>
                    Queda en Caja con la justificación: «{concepto || '…'} · Canje {c.codigo}: {c.recompensa_nombre}».
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAbierto(null)} className="flex-1 rounded-lg py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>Cancelar</button>
                  <button type="submit" disabled={procesando} className="flex-1 rounded-lg py-2 text-xs font-medium text-white disabled:opacity-60" style={{ background: 'var(--gradiente-primario)' }}>
                    {procesando ? 'Registrando...' : 'Confirmar y cobrar'}
                  </button>
                </div>
              </form>
            )}

            {abierto?.id === c.id && abierto.modo === 'rechazar' && (
              <form onSubmit={(e) => rechazar(e, c)} className="flex flex-col gap-2 mt-3">
                <input className="rounded-lg px-3 py-2 text-sm bg-white" placeholder="Motivo del rechazo (el cliente lo verá)" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAbierto(null)} className="flex-1 rounded-lg py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>Cancelar</button>
                  <button type="submit" disabled={procesando} className="flex-1 rounded-lg py-2 text-xs text-white disabled:opacity-60" style={{ background: '#B0524A' }}>
                    {procesando ? 'Procesando...' : 'Rechazar y devolver puntos'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {historial.length > 0 && (
        <>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Resueltos recientemente</p>
          <div className="flex flex-col gap-2">
            {historial.map((c) => {
              const estado = ESTADOS[c.estado] || ESTADOS.cancelado
              return (
                <div key={c.id} className="rounded-xl p-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-ink">{c.pacientes?.nombre || 'Cliente'} · {c.recompensa_nombre}</p>
                    <span className="text-[11px] font-medium flex-shrink-0" style={{ color: estado.color }}>{estado.texto}</span>
                  </div>
                  <p className="text-[11px] text-ink/50">
                    {c.codigo} · {c.fecha_resolucion ? fechaHora(c.fecha_resolucion) : ''}
                    {c.estado === 'aplicado' && c.descuento_aplicado != null ? ` · descuento ${dinero(c.descuento_aplicado)}` : ''}
                    {c.estado === 'rechazado' && c.nota ? ` · ${c.nota}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
