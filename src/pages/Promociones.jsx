import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { SEGMENTOS, formatearFecha } from '../lib/crm'
import { formatearPorcentaje } from '../lib/promociones'
import { nuevaClaveOperacion } from '../lib/puntos'

const hoy = () => new Date().toISOString().slice(0, 10)
const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const TIPOS = [{ id: 'servicio', e: 'Servicio' }, { id: 'producto', e: 'Producto' }, { id: 'membresia', e: 'Membresía' }, { id: 'otro', e: 'Otro' }]
const METODOS = [{ id: 'efectivo', e: 'Efectivo' }, { id: 'tarjeta', e: 'Tarjeta' }, { id: 'transferencia', e: 'Transferencia' }]
const dinero = (n) => `L ${Number(n || 0).toFixed(2)}`

function mensajeAplicar(r) {
  switch (r?.resultado) {
    case 'no_elegible': return 'Este cliente ya no pertenece al segmento de esa promoción.'
    case 'no_vigente': return 'La promoción no está activa o ya venció.'
    case 'ya_utilizada': return 'Este cliente ya usó esa promoción.'
    case 'cliente_invalido': return 'Ese cliente no pertenece a tu negocio.'
    case 'datos_invalidos': return 'Revisa el tipo de cobro y el método de pago.'
    case 'concepto_requerido': return 'Escribe qué se cobra: es la justificación del descuento.'
    case 'monto_invalido': return 'El monto debe ser mayor que cero.'
    case 'no_encontrada': return 'Esa promoción ya no existe.'
    default: return 'No se pudo aplicar. Intenta de nuevo (no se duplicará).'
  }
}

/** Estado visible de una promoción: "expirada" y "programada" se deducen de las fechas. */
function estadoVisible(p) {
  if (p.estado === 'borrador') return { texto: 'Borrador', color: 'var(--color-texto-terciario)' }
  if (p.estado === 'pausada') return { texto: 'Pausada', color: '#B08D3E' }
  if (p.fin < hoy()) return { texto: 'Expirada', color: '#B0524A' }
  if (p.inicio > hoy()) return { texto: 'Programada', color: 'var(--color-dorado)' }
  return { texto: 'Activa', color: '#4F7A3E' }
}

export default function Promociones({ clinicaId }) {
  const [promos, setPromos] = useState([])
  const [resumen, setResumen] = useState({})
  const [servicios, setServicios] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [frecuencia, setFrecuencia] = useState(3)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', porcentaje: '15', segmento: 'inactivos', inicio: hoy(), fin: enDias(30), servicioId: '', estado: 'borrador' })
  // aplicar en un cobro
  const [clienteId, setClienteId] = useState('')
  const [aplicables, setAplicables] = useState([])
  const [promoId, setPromoId] = useState('')
  const [concepto, setConcepto] = useState('Servicio')
  const [tipo, setTipo] = useState('servicio')
  const [metodo, setMetodo] = useState('efectivo')
  const [bruto, setBruto] = useState('')
  const [clave, setClave] = useState(() => nuevaClaveOperacion())
  const [aplicando, setAplicando] = useState(false)

  async function cargar() {
    const [pr, rs, sv, pa, cl] = await Promise.all([
      supabase.from('promociones').select('*').eq('clinica_id', clinicaId).order('creada_at', { ascending: false }),
      supabase.rpc('promociones_resumen'),
      supabase.from('servicios').select('id, nombre').eq('clinica_id', clinicaId).eq('activo', true).order('nombre'),
      supabase.from('pacientes').select('id, nombre').eq('clinica_id', clinicaId).order('nombre'),
      supabase.from('clinicas').select('promo_frecuencia_dias').eq('id', clinicaId).single(),
    ])
    setPromos(pr.data || [])
    setResumen(Object.fromEntries((rs.data || []).map((r) => [r.promocion_id, r])))
    setServicios(sv.data || [])
    setPacientes(pa.data || [])
    if (cl.data) setFrecuencia(cl.data.promo_frecuencia_dias)
    setCargando(false)
  }
  useEffect(() => {
    cargar()
  }, [])

  const etiquetaSegmento = (id) => SEGMENTOS.find((s) => s.id === id)?.etiqueta || id
  const ayudaSegmento = SEGMENTOS.find((s) => s.id === form.segmento)?.ayuda(45) || ''
  const nombreServicio = (id) => servicios.find((s) => s.id === id)?.nombre

  async function crear(e) {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')
    const { error } = await supabase.from('promociones').insert({
      clinica_id: clinicaId,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      descuento_porcentaje: Number(form.porcentaje),
      segmento: form.segmento,
      servicio_id: form.servicioId || null,
      inicio: form.inicio,
      fin: form.fin,
      estado: form.estado,
    })
    setGuardando(false)
    if (error) {
      setMensaje('No se pudo guardar la promoción: revisa el título, el porcentaje (1 a 100) y que la fecha final no sea anterior a la inicial.')
      return
    }
    setMostrarForm(false)
    setForm({ titulo: '', descripcion: '', porcentaje: '15', segmento: 'inactivos', inicio: hoy(), fin: enDias(30), servicioId: '', estado: 'borrador' })
    setMensaje('Promoción creada. Mientras esté en borrador o pausada, ningún cliente la ve.')
    cargar()
  }

  async function cambiarEstado(p, estado) {
    setMensaje('')
    const { error } = await supabase.from('promociones').update({ estado }).eq('id', p.id)
    if (error) setMensaje('No se pudo cambiar el estado.')
    cargar()
  }

  async function eliminar(p) {
    setMensaje('')
    const { error } = await supabase.from('promociones').delete().eq('id', p.id)
    setMensaje(error ? 'Esta promoción ya se usó en un cobro y no se puede eliminar. Puedes pausarla.' : 'Promoción eliminada.')
    cargar()
  }

  async function guardarFrecuencia() {
    const dias = Math.round(Number(frecuencia))
    const { error } = await supabase.from('clinicas').update({ promo_frecuencia_dias: dias }).eq('id', clinicaId)
    setMensaje(error ? 'La frecuencia debe ser de 1 a 365 días.' : `Listo: a cada cliente se le avisa de una promoción como máximo cada ${dias} días.`)
  }

  // Recarga las promociones aplicables de un cliente SIN tocar el mensaje en pantalla.
  async function cargarAplicables(id) {
    setPromoId('')
    setAplicables([])
    if (!id) return
    const { data } = await supabase.rpc('promociones_aplicables', { p_paciente: id })
    setAplicables(data || [])
    if (data?.length) setPromoId(data[0].id)
  }

  async function elegirCliente(id) {
    setClienteId(id)
    setMensaje('')
    await cargarAplicables(id)
  }

  const promoElegida = aplicables.find((p) => p.id === promoId)
  const descuentoVista = useMemo(
    () => (promoElegida && Number(bruto) > 0 ? Math.round(Number(bruto) * Number(promoElegida.descuento_porcentaje)) / 100 : null),
    [promoElegida, bruto]
  )

  async function aplicar(e) {
    e.preventDefault()
    setAplicando(true)
    setMensaje('')
    const { data, error } = await supabase.rpc('aplicar_promocion', {
      p_clave: clave,
      p_promocion: promoId,
      p_paciente: clienteId,
      p_monto_bruto: Number(bruto),
      p_tipo: tipo,
      p_metodo_pago: metodo,
      p_concepto: concepto,
    })
    setAplicando(false)
    if (error || data?.resultado !== 'ok') {
      setMensaje(error ? 'No se pudo aplicar. Puedes intentar de nuevo: no se duplicará.' : mensajeAplicar(data))
      return
    }
    setMensaje(
      data.repetido
        ? 'Esa promoción ya estaba aplicada en este cobro (no se duplicó).'
        : `Promoción aplicada: se registró en Caja el cobro de ${dinero(data.cobrado)} con descuento de ${dinero(data.descuento)}.`
    )
    setClave(nuevaClaveOperacion())
    setBruto('')
    cargarAplicables(clienteId)   // la promoción usada ya no aparece; el mensaje de confirmación se conserva
    cargar()
  }

  const campo = 'rounded-lg px-3 py-2 text-sm bg-white'

  return (
    <div>
      <p className="font-display text-lg text-ink mb-0.5">Promociones</p>
      <p className="text-xs mb-4" style={{ color: 'var(--color-texto-secundario)' }}>
        Prepara beneficios para grupos de clientes (los mismos segmentos del CRM). El cliente la ve dentro de la app; el descuento lo aplicas tú al cobrar.
      </p>

      {mensaje && <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>{mensaje}</p>}

      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--gradiente-primario)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Nueva promoción'}
      </button>

      {mostrarForm && (
        <form onSubmit={crear} className="flex flex-col gap-2 mb-5 rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
          <input className={campo} placeholder="Título (ej. Te extrañamos)" maxLength={80} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          <input className={campo} placeholder="Descripción (opcional)" maxLength={500} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Descuento (%)</span>
            <input className={campo} type="number" inputMode="decimal" min="1" max="100" step="0.5" value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>¿Para qué clientes?</span>
            <select className={campo} value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
              {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
            </select>
            <span className="text-[11px]" style={{ color: 'var(--color-texto-terciario)' }}>{ayudaSegmento}</span>
          </label>
          <div className="flex gap-2">
            <label className="flex-1 flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Desde</span>
              <input className={campo} type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required />
            </label>
            <label className="flex-1 flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Hasta</span>
              <input className={campo} type="date" min={form.inicio} value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} required />
            </label>
          </div>
          <select className={campo} value={form.servicioId} onChange={(e) => setForm({ ...form, servicioId: e.target.value })} aria-label="Servicio de la promoción">
            <option value="">Cualquier servicio</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select className={campo} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} aria-label="Estado inicial">
            <option value="borrador">Guardar como borrador (nadie la ve)</option>
            <option value="activa">Activar ya</option>
          </select>
          <button type="submit" disabled={guardando} className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60" style={{ background: 'var(--gradiente-primario)' }}>
            {guardando ? 'Guardando...' : 'Guardar promoción'}
          </button>
        </form>
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando promociones...</p>}
      {!cargando && promos.length === 0 && <p className="text-sm text-ink/50 mb-4">Todavía no tienes promociones.</p>}

      <div className="flex flex-col gap-2 mb-6">
        {promos.map((p) => {
          const est = estadoVisible(p)
          const r = resumen[p.id] || {}
          return (
            <div key={p.id} className="rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{p.titulo}</p>
                  <p className="text-[11px] text-ink/60">
                    {formatearPorcentaje(p.descuento_porcentaje)} · {etiquetaSegmento(p.segmento)}{p.servicio_id ? ` · ${nombreServicio(p.servicio_id) || 'servicio'}` : ''}
                  </p>
                  <p className="text-[11px] text-ink/50">Del {formatearFecha(p.inicio)} al {formatearFecha(p.fin)}</p>
                </div>
                <span className="text-[11px] font-medium flex-shrink-0" style={{ color: est.color }}>{est.texto}</span>
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-texto-secundario)' }}>
                Pueden recibirla {r.elegibles ?? 0} · la abrieron {r.vistas ?? 0} · la descartaron {r.descartadas ?? 0} · la usaron {r.utilizadas ?? 0}
              </p>
              <div className="flex gap-2 mt-2">
                {p.estado === 'activa' ? (
                  <button onClick={() => cambiarEstado(p, 'pausada')} className="text-[11px] px-3 py-1.5 rounded-lg bg-white" style={{ color: 'var(--color-ink)' }}>Pausar</button>
                ) : (
                  <button onClick={() => cambiarEstado(p, 'activa')} className="text-[11px] px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--color-primary)' }}>Activar</button>
                )}
                {!(r.utilizadas > 0) && (
                  <button onClick={() => eliminar(p)} className="text-[11px] px-3 py-1.5 rounded-lg bg-white" style={{ color: '#B0524A' }}>Eliminar</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-ink)' }}>Aplicar una promoción en un cobro</p>
      <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-secundario)' }}>Elige al cliente: solo verás las promociones vigentes que le corresponden y que no ha usado.</p>
      <form onSubmit={aplicar} className="flex flex-col gap-2 mb-6 rounded-xl p-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
        <select className={campo} style={{ background: 'var(--color-accent)' }} value={clienteId} onChange={(e) => elegirCliente(e.target.value)} aria-label="Cliente">
          <option value="">Elige un cliente</option>
          {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {clienteId && aplicables.length === 0 && <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>Este cliente no tiene promociones aplicables ahora.</p>}
        {aplicables.length > 0 && (
          <>
            <select className={campo} style={{ background: 'var(--color-accent)' }} value={promoId} onChange={(e) => setPromoId(e.target.value)} aria-label="Promoción a aplicar">
              {aplicables.map((p) => <option key={p.id} value={p.id}>{p.titulo} · {formatearPorcentaje(p.descuento_porcentaje)}</option>)}
            </select>
            <input className={campo} style={{ background: 'var(--color-accent)' }} placeholder="Qué se cobra (ej. Limpieza facial)" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
            <div className="flex gap-2">
              <select className={`${campo} flex-1`} style={{ background: 'var(--color-accent)' }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.e}</option>)}
              </select>
              <select className={`${campo} flex-1`} style={{ background: 'var(--color-accent)' }} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {METODOS.map((m) => <option key={m.id} value={m.id}>{m.e}</option>)}
              </select>
            </div>
            <input className={campo} style={{ background: 'var(--color-accent)' }} type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Monto total del servicio o venta (L)" value={bruto} onChange={(e) => setBruto(e.target.value)} required />
            <p className="text-xs" style={{ color: 'var(--color-ink)' }}>
              {descuentoVista !== null
                ? <>Descuento {formatearPorcentaje(promoElegida.descuento_porcentaje)}: <strong>{dinero(descuentoVista)}</strong> · el cliente paga <strong>{dinero(Number(bruto) - descuentoVista)}</strong></>
                : <span style={{ color: 'var(--color-texto-terciario)' }}>Escribe el monto para ver el descuento (lo calcula el sistema).</span>}
            </p>
            <button type="submit" disabled={aplicando} className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60" style={{ background: 'var(--gradiente-primario)' }}>
              {aplicando ? 'Registrando...' : 'Aplicar y cobrar'}
            </button>
          </>
        )}
      </form>

      <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-ink)' }}>Frecuencia de avisos</p>
      <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-secundario)' }}>Para no abrumar: a cada cliente se le avisa de una promoción como máximo cada cierto número de días (las demás siguen en "Tus beneficios").</p>
      <div className="flex items-center gap-2">
        <input className={`${campo} w-24`} style={{ background: 'var(--color-accent)' }} type="number" min="1" max="365" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} aria-label="Días entre avisos" />
        <span className="text-xs" style={{ color: 'var(--color-ink)' }}>días</span>
        <button type="button" onClick={guardarFrecuencia} className="rounded-lg px-3 py-2 text-xs text-white" style={{ background: 'var(--color-primary)' }}>Guardar</button>
      </div>
    </div>
  )
}
