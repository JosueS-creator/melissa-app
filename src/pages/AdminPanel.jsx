import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { supabase } from '../lib/supabaseClient'
import { obtenerPerfilActual } from '../lib/auth'
import Personalizacion from './Personalizacion'
import { PREFIJO_QR_CLIENTE } from './TarjetaVIP'

const TABS = [
  { id: 'citas', label: 'Citas' },
  { id: 'pacientes', label: 'Clientes' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'productos', label: 'Productos' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'marca', label: 'Marca' },
]

export default function AdminPanel({ onCerrarSesion, esSuperAdmin, onIrAMelissa }) {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('citas')

  useEffect(() => {
    obtenerPerfilActual().then((p) => {
      setPerfil(p)
      setCargando(false)
    })
  }, [])

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!perfil) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para continuar.</p>
  if (perfil.rol !== 'admin') {
    return <p className="text-center pt-16 text-sm text-ink/60 px-8">Esta sección es solo para administradores.</p>
  }

  return (
    <div
      className="max-w-sm mx-auto px-5 pb-10 font-body"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}
    >
      <div className="flex justify-between items-start mb-1">
        <p className="font-display text-xl text-ink">Panel del negocio</p>
        <div className="flex gap-2">
          {esSuperAdmin && (
            <button onClick={onIrAMelissa} className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>
              Panel de Melissa
            </button>
          )}
          <button onClick={onCerrarSesion} className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>
            Salir
          </button>
        </div>
      </div>
      <p className="text-xs text-ink/50 mb-5">Vista operativa para el equipo.</p>

      <div className="grid grid-cols-6 gap-1 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-lg py-2 text-[9px] font-medium"
            style={
              tab === t.id
                ? { background: 'var(--color-primary)', color: '#FFFFFF' }
                : { background: 'var(--color-accent)', color: 'var(--color-ink)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'citas' && <PanelCitas clinicaId={perfil.clinica_id} />}
      {tab === 'pacientes' && <PanelPacientes clinicaId={perfil.clinica_id} />}
      {tab === 'servicios' && <PanelServicios clinicaId={perfil.clinica_id} />}
      {tab === 'productos' && <PanelProductos clinicaId={perfil.clinica_id} />}
      {tab === 'ventas' && <PanelVentas clinicaId={perfil.clinica_id} />}
      {tab === 'marca' && (
        <div className="-mx-5">
          <Personalizacion />
        </div>
      )}
    </div>
  )
}

function PanelCitas({ clinicaId }) {
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('citas')
      .select('*, especialistas(nombre), pacientes(nombre)')
      .eq('clinica_id', clinicaId)
      .order('fecha_hora', { ascending: true })
    setCitas(data || [])
    setCargando(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('citas').update({ estado }).eq('id', id)
    cargar()
  }

  const colorEstado = {
    pendiente: '#B08D3E',
    confirmada: '#2D6E8E',
    completada: '#6B8E5A',
    cancelada: '#B0524A',
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--color-primary)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Agendar cita'}
      </button>

      {mostrarForm && (
        <FormularioNuevaCita
          clinicaId={clinicaId}
          onCreada={() => {
            setMostrarForm(false)
            cargar()
          }}
        />
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando citas...</p>}
      {!cargando && citas.length === 0 && <p className="text-sm text-ink/50">No hay citas registradas todavía.</p>}

      <div className="flex flex-col gap-2.5">
        {citas.map((c) => (
          <div key={c.id} className="rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-ink">{c.pacientes?.nombre ?? 'Cliente'}</p>
                <p className="text-[11px] text-ink/50 mt-0.5">
                  {new Date(c.fecha_hora).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {' · '}
                  {c.especialistas?.nombre ?? 'Sin asignar'}
                </p>
                {c.tratamiento && <p className="text-[11px] text-ink/50">{c.tratamiento}</p>}
              </div>
              <span className="text-[10px] font-medium px-2 py-1 rounded-full text-white" style={{ background: colorEstado[c.estado] }}>
                {c.estado}
              </span>
            </div>
            {c.estado === 'pendiente' && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => cambiarEstado(c.id, 'confirmada')} className="text-[11px] px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--color-primary)' }}>
                  Confirmar
                </button>
                <button onClick={() => cambiarEstado(c.id, 'cancelada')} className="text-[11px] px-3 py-1.5 rounded-lg text-ink/60 bg-white">
                  Cancelar
                </button>
              </div>
            )}
            {c.estado === 'confirmada' && (
              <button onClick={() => cambiarEstado(c.id, 'completada')} className="text-[11px] px-3 py-1.5 rounded-lg text-white mt-2" style={{ background: 'var(--color-primary)' }}>
                Marcar completada
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FormularioNuevaCita({ clinicaId, onCreada }) {
  const [pacientes, setPacientes] = useState([])
  const [especialistas, setEspecialistas] = useState([])
  const [servicios, setServicios] = useState([])
  const [pacienteId, setPacienteId] = useState('')
  const [especialistaId, setEspecialistaId] = useState('')
  const [servicioNombre, setServicioNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarListas() {
      const [{ data: p }, { data: e }, { data: s }] = await Promise.all([
        supabase.from('pacientes').select('id, nombre').eq('clinica_id', clinicaId).order('nombre'),
        supabase.from('especialistas').select('id, nombre').eq('clinica_id', clinicaId).eq('activo', true),
        supabase.from('servicios').select('id, nombre, precio').eq('clinica_id', clinicaId).eq('activo', true),
      ])
      setPacientes(p || [])
      setEspecialistas(e || [])
      setServicios(s || [])
    }
    cargarListas()
  }, [clinicaId])

  async function crearCita(e) {
    e.preventDefault()
    if (!pacienteId || !fecha || !hora) return
    setGuardando(true)
    setError('')

    const fechaHora = new Date(`${fecha}T${hora}:00`).toISOString()

    const { error: errorInsert } = await supabase.from('citas').insert({
      clinica_id: clinicaId,
      paciente_id: pacienteId,
      especialista_id: especialistaId || null,
      fecha_hora: fechaHora,
      estado: 'confirmada',
      tratamiento: servicioNombre || null,
    })

    if (errorInsert) {
      setError('No se pudo agendar: ' + errorInsert.message)
      setGuardando(false)
    } else {
      onCreada()
    }
  }

  return (
    <form onSubmit={crearCita} className="flex flex-col gap-2 mb-5 rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
      <select
        className="rounded-lg px-3 py-2 text-sm bg-white"
        value={pacienteId}
        onChange={(e) => setPacienteId(e.target.value)}
        required
      >
        <option value="" disabled>Selecciona un cliente</option>
        {pacientes.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>

      <select
        className="rounded-lg px-3 py-2 text-sm bg-white"
        value={especialistaId}
        onChange={(e) => setEspecialistaId(e.target.value)}
      >
        <option value="">Sin especialista asignado</option>
        {especialistas.map((esp) => (
          <option key={esp.id} value={esp.id}>{esp.nombre}</option>
        ))}
      </select>

      <select
        className="rounded-lg px-3 py-2 text-sm bg-white"
        value={servicioNombre}
        onChange={(e) => setServicioNombre(e.target.value)}
      >
        <option value="">Sin servicio específico</option>
        {servicios.map((s) => (
          <option key={s.id} value={s.nombre}>{s.nombre} · L {Number(s.precio).toFixed(0)}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
        <input
          className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
        style={{ background: 'var(--gradiente-primario)' }}
      >
        {guardando ? 'Agendando...' : 'Agendar cita'}
      </button>
    </form>
  )
}

function PanelServicios({ clinicaId }) {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState('30')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('servicios')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('nombre', { ascending: true })
    setServicios(data || [])
    setCargando(false)
  }

  async function crearServicio(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const { error: errorInsert } = await supabase.from('servicios').insert({
      clinica_id: clinicaId,
      nombre,
      descripcion,
      precio: Number(precio),
      duracion_minutos: Number(duracion) || 30,
      activo: true,
    })

    if (errorInsert) {
      setError('No se pudo guardar: ' + errorInsert.message)
    } else {
      setNombre('')
      setDescripcion('')
      setPrecio('')
      setDuracion('30')
      setMostrarForm(false)
      cargar()
    }
    setGuardando(false)
  }

  async function alternarActivo(servicio) {
    await supabase.from('servicios').update({ activo: !servicio.activo }).eq('id', servicio.id)
    cargar()
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--color-primary)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Agregar servicio'}
      </button>

      {mostrarForm && (
        <form onSubmit={crearServicio} className="flex flex-col gap-2 mb-5 rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Nombre del servicio (ej. Limpieza facial)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
              placeholder="Precio"
              type="number"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
            <input
              className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
              placeholder="Duración (min)"
              type="number"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
            />
          </div>

          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            {guardando ? 'Guardando...' : 'Guardar servicio'}
          </button>
        </form>
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando servicios...</p>}
      {!cargando && servicios.length === 0 && <p className="text-sm text-ink/50">Todavía no tienes servicios registrados.</p>}

      <div className="flex flex-col gap-2">
        {servicios.map((s) => (
          <div key={s.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--color-accent)', opacity: s.activo ? 1 : 0.5 }}>
            <div>
              <p className="text-sm font-medium text-ink">{s.nombre}</p>
              <p className="text-[11px] text-ink/50">L {Number(s.precio).toFixed(2)} · {s.duracion_minutos} min</p>
            </div>
            <button
              onClick={() => alternarActivo(s)}
              className="text-[10px] px-2.5 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: s.activo ? 'var(--color-ink)' : 'var(--color-primary)', color: '#FFFFFF' }}
            >
              {s.activo ? 'Ocultar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelPacientes({ clinicaId }) {
  const [pacientes, setPacientes] = useState([])
  const [puntosPorCliente, setPuntosPorCliente] = useState({})
  const [cargando, setCargando] = useState(true)
  const [mostrarEscaner, setMostrarEscaner] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const [{ data: dataPacientes }, { data: dataMovimientos }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('clinica_id', clinicaId).order('fecha_registro', { ascending: false }),
      supabase.from('puntos_movimientos').select('paciente_id, puntos').eq('clinica_id', clinicaId),
    ])

    const saldos = {}
    for (const m of dataMovimientos || []) {
      saldos[m.paciente_id] = (saldos[m.paciente_id] || 0) + m.puntos
    }

    setPacientes(dataPacientes || [])
    setPuntosPorCliente(saldos)
    setCargando(false)
  }

  return (
    <div>
      <button
        onClick={() => setMostrarEscaner((v) => !v)}
        className="w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarEscaner ? 'var(--color-accent)' : 'var(--color-primary)', color: mostrarEscaner ? 'var(--color-ink)' : '#FFFFFF' }}
      >
        {mostrarEscaner ? 'Cerrar escáner' : '📷 Escanear QR de un cliente'}
      </button>

      {mostrarEscaner && (
        <EscanerQR clinicaId={clinicaId} onPuntosActualizados={() => { setMostrarEscaner(false); cargar() }} />
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando clientes...</p>}
      {!cargando && pacientes.length === 0 && <p className="text-sm text-ink/50">Todavía no hay clientes registrados.</p>}

      <div className="flex flex-col gap-2">
        {pacientes.map((p) => (
          <div key={p.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--color-accent)' }}>
            <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{p.nombre}</p>
              <p className="text-[11px] text-ink/50">{p.telefono || 'Sin teléfono registrado'}</p>
            </div>
            <p className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
              {(puntosPorCliente[p.id] || 0).toLocaleString()} pts
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function EscanerQR({ clinicaId, onPuntosActualizados }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const [clienteEncontrado, setClienteEncontrado] = useState(null)
  const [saldoActual, setSaldoActual] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [modo, setModo] = useState('asignar') // 'asignar' | 'canjear'
  const [puntos, setPuntos] = useState('')
  const [motivo, setMotivo] = useState('')
  const [asignando, setAsignando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let stream
    let animId

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          escanearCuadro()
        }
      } catch (err) {
        setError('No se pudo acceder a la cámara. Verifica los permisos.')
      }
    }

    function escanearCuadro() {
      if (clienteEncontrado) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const codigo = jsQR(imageData.data, imageData.width, imageData.height)
        if (codigo && codigo.data.startsWith(PREFIJO_QR_CLIENTE)) {
          const pacienteId = codigo.data.replace(PREFIJO_QR_CLIENTE, '')
          buscarCliente(pacienteId)
          return
        }
      }
      animId = requestAnimationFrame(escanearCuadro)
    }

    iniciar()

    return () => {
      if (animId) cancelAnimationFrame(animId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function buscarCliente(pacienteId) {
    setBuscando(true)
    // Verificación de seguridad: el cliente debe pertenecer a ESTA clínica,
    // no a cualquiera — así un QR de otro negocio nunca funciona aquí.
    const { data, error: errorBusqueda } = await supabase
      .from('pacientes')
      .select('id, nombre')
      .eq('id', pacienteId)
      .eq('clinica_id', clinicaId)
      .single()

    if (errorBusqueda || !data) {
      setError('Este código QR no pertenece a un cliente de tu negocio.')
    } else {
      const { data: movimientos } = await supabase
        .from('puntos_movimientos')
        .select('puntos')
        .eq('paciente_id', data.id)
      setSaldoActual((movimientos || []).reduce((sum, m) => sum + m.puntos, 0))
      setClienteEncontrado(data)
    }
    setBuscando(false)
  }

  async function confirmarMovimiento(e) {
    e.preventDefault()
    if (!clienteEncontrado || !puntos) return

    const cantidad = Number(puntos)
    if (modo === 'canjear' && cantidad > saldoActual) {
      setMensaje(`Este cliente solo tiene ${saldoActual.toLocaleString()} puntos disponibles.`)
      return
    }

    setAsignando(true)
    setMensaje('')

    const { error: errorInsert } = await supabase.from('puntos_movimientos').insert({
      clinica_id: clinicaId,
      paciente_id: clienteEncontrado.id,
      tipo: modo === 'asignar' ? 'acumulacion' : 'canje',
      puntos: modo === 'asignar' ? cantidad : -cantidad,
      motivo: motivo || (modo === 'asignar' ? 'Asignado por el negocio' : 'Canjeado en recepción'),
    })

    if (errorInsert) {
      setMensaje('No se pudo procesar: ' + errorInsert.message)
      setAsignando(false)
    } else {
      setMensaje(
        modo === 'asignar'
          ? `¡${cantidad} puntos asignados a ${clienteEncontrado.nombre}!`
          : `¡${cantidad} puntos canjeados de ${clienteEncontrado.nombre}!`
      )
      setTimeout(() => onPuntosActualizados(), 1200)
    }
  }

  return (
    <div className="rounded-xl p-3 mb-5" style={{ background: 'var(--color-accent)' }}>
      {!clienteEncontrado && (
        <>
          <div className="rounded-lg overflow-hidden relative" style={{ aspectRatio: '1/1', background: '#000' }}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <p className="text-xs text-center mt-2" style={{ color: 'var(--color-texto-secundario)' }}>
            {buscando ? 'Verificando cliente...' : 'Apunta la cámara al QR de la tarjeta del cliente'}
          </p>
          {error && <p className="text-xs text-center mt-1" style={{ color: '#B0524A' }}>{error}</p>}
        </>
      )}

      {clienteEncontrado && (
        <form onSubmit={confirmarMovimiento} className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>Cliente: {clienteEncontrado.nombre}</p>
          <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>
            Saldo actual: <strong style={{ color: 'var(--color-primary)' }}>{saldoActual.toLocaleString()} pts</strong>
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('asignar')}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={modo === 'asignar' ? { background: 'var(--color-primary)', color: '#FFFFFF' } : { background: '#FFFFFF', color: 'var(--color-ink)' }}
            >
              Asignar puntos
            </button>
            <button
              type="button"
              onClick={() => setModo('canjear')}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={modo === 'canjear' ? { background: 'var(--color-primary)', color: '#FFFFFF' } : { background: '#FFFFFF', color: 'var(--color-ink)' }}
            >
              Canjear puntos
            </button>
          </div>

          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={modo === 'asignar' ? 'Puntos a asignar' : 'Puntos a canjear'}
            type="number"
            max={modo === 'canjear' ? saldoActual : undefined}
            value={puntos}
            onChange={(e) => setPuntos(e.target.value)}
            required
          />
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={modo === 'asignar' ? 'Motivo (ej. Compra en recepción)' : 'Motivo (ej. Canjeado por limpieza facial)'}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {mensaje && <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
          <button
            type="submit"
            disabled={asignando}
            className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            {asignando ? 'Procesando...' : modo === 'asignar' ? 'Asignar puntos' : 'Confirmar canje'}
          </button>
        </form>
      )}
    </div>
  )
}

function PanelProductos({ clinicaId }) {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('cremas')
  const [precio, setPrecio] = useState('')
  const [stock, setStock] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('productos')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('nombre', { ascending: true })
    setProductos(data || [])
    setCargando(false)
  }

  async function crearProducto(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    let imagenUrl = null
    if (archivo) {
      const extension = archivo.name.split('.').pop()
      const ruta = `${clinicaId}/${Date.now()}.${extension}`
      const { error: errorSubida } = await supabase.storage.from('fotos-productos').upload(ruta, archivo)
      if (errorSubida) {
        setError('No se pudo subir la foto: ' + errorSubida.message)
        setGuardando(false)
        return
      }
      const { data: publicUrl } = supabase.storage.from('fotos-productos').getPublicUrl(ruta)
      imagenUrl = publicUrl.publicUrl
    }

    const { error: errorInsert } = await supabase.from('productos').insert({
      clinica_id: clinicaId,
      nombre,
      descripcion,
      categoria,
      precio: Number(precio),
      stock: Number(stock) || 0,
      imagen_url: imagenUrl,
      activo: true,
    })

    if (errorInsert) {
      setError('No se pudo guardar: ' + errorInsert.message)
    } else {
      setNombre('')
      setDescripcion('')
      setPrecio('')
      setStock('')
      setArchivo(null)
      setMostrarForm(false)
      cargar()
    }
    setGuardando(false)
  }

  async function alternarActivo(producto) {
    await supabase.from('productos').update({ activo: !producto.activo }).eq('id', producto.id)
    cargar()
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--color-primary)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Agregar producto'}
      </button>

      {mostrarForm && (
        <form onSubmit={crearProducto} className="flex flex-col gap-2 mb-5 rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Nombre del producto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <select
            className="rounded-lg px-3 py-2 text-sm bg-white"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="cremas">Cremas</option>
            <option value="protector_solar">Protector solar</option>
            <option value="sueros">Sueros</option>
            <option value="vitaminas">Vitaminas</option>
            <option value="kits">Kits</option>
          </select>
          <div className="flex gap-2">
            <input
              className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
              placeholder="Precio"
              type="number"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
            <input
              className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
              placeholder="Stock"
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <label className="text-xs px-3 py-2 rounded-lg bg-white cursor-pointer text-center" style={{ color: 'var(--color-texto-secundario)' }}>
            {archivo ? archivo.name : 'Elegir foto (opcional)'}
            <input type="file" accept="image/*" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="hidden" />
          </label>

          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            {guardando ? 'Guardando...' : 'Guardar producto'}
          </button>
        </form>
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando productos...</p>}
      {!cargando && productos.length === 0 && <p className="text-sm text-ink/50">Todavía no tienes productos en tu tienda.</p>}

      <div className="flex flex-col gap-2">
        {productos.map((p) => (
          <div key={p.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--color-accent)', opacity: p.activo ? 1 : 0.5 }}>
            <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-white overflow-hidden flex items-center justify-center">
              {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" /> : <span className="text-[8px] text-ink/30">Sin foto</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{p.nombre}</p>
              <p className="text-[11px] text-ink/50">L {Number(p.precio).toFixed(2)} · Stock: {p.stock}</p>
            </div>
            <button
              onClick={() => alternarActivo(p)}
              className="text-[10px] px-2.5 py-1.5 rounded-lg"
              style={{ background: p.activo ? 'var(--color-ink)' : 'var(--color-primary)', color: '#FFFFFF' }}
            >
              {p.activo ? 'Ocultar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelVentas({ clinicaId }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('pedidos')
      .select('*, pacientes(nombre)')
      .eq('clinica_id', clinicaId)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        setPedidos(data || [])
        setCargando(false)
      })
  }, [])

  if (cargando) return <p className="text-sm text-ink/50">Cargando ventas...</p>
  if (pedidos.length === 0) return <p className="text-sm text-ink/50">Todavía no hay pedidos registrados.</p>

  const totalVentas = pedidos.reduce((sum, p) => sum + Number(p.total), 0)

  return (
    <div>
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-ink)' }}>
        <p className="text-[11px] text-white/60">Total acumulado</p>
        <p className="text-xl text-white font-medium mt-1">L {totalVentas.toFixed(2)}</p>
      </div>
      <div className="flex flex-col gap-2">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: 'var(--color-accent)' }}>
            <div>
              <p className="text-sm font-medium text-ink">{p.pacientes?.nombre ?? 'Cliente'}</p>
              <p className="text-[11px] text-ink/50">
                {new Date(p.fecha).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })} · {p.estado}
              </p>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>L {Number(p.total).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
