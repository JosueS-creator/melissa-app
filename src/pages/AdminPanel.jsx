import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { supabase } from '../lib/supabaseClient'
import { obtenerPerfilActual } from '../lib/auth'
import Personalizacion from './Personalizacion'
import { PREFIJO_QR_CLIENTE } from './TarjetaVIP'
import { descargarDatosClinica } from '../lib/exportarDatosClinica'
import { useFunciones } from '../lib/FuncionesContext'
import { NOMBRE_PLAN } from '../lib/planes'
import FuncionBloqueada from '../components/FuncionBloqueada'
import CabeceraAdmin from '../components/admin/CabeceraAdmin'
import SeccionAdmin from '../components/admin/SeccionAdmin'
import FotoServicio, { SelectorFotoServicio } from '../components/admin/FotoServicio'
import { guardarFotoServicio, prepararFotoServicio } from '../lib/fotosServicios'
import '../components/admin/sistemaAdmin.css'
import NavInferior, { PRINCIPALES } from '../components/admin/NavInferior'
import HojaMas from '../components/admin/HojaMas'
import PanelAgenda from '../components/admin/PanelAgenda'
import { mensajeErrorCita } from '../lib/erroresCitas'
import Candado from '../components/admin/Candado'
import EscanerBarras from '../components/EscanerBarras'
import Crm from './Crm'
import ClientesReactivar from './ClientesReactivar'
import Canjes from './Canjes'
import Promociones from './Promociones'
import { CampoPuntos, PuntosEnFila } from '../components/PuntosCatalogo'
import { useConfigPuntos, nuevaClaveOperacion } from '../lib/puntos'

// `funcion`: la función del plan que desbloquea la pestaña (el servidor también la exige).
const TABS = [
  { id: 'citas', label: 'Citas', funcion: 'agenda' },
  { id: 'pacientes', label: 'Clientes', funcion: 'clientes' },
  { id: 'reactivar', label: 'Por reactivar', funcion: 'reactivacion' },
  { id: 'canjes', label: 'Canjes', funcion: 'canjes' },
  { id: 'promociones', label: 'Promociones', funcion: 'promociones' },
  { id: 'empleados', label: 'Empleados', funcion: 'empleados' },
  { id: 'servicios', label: 'Servicios', funcion: 'servicios' },
  { id: 'productos', label: 'Productos', funcion: 'tienda' },
  { id: 'caja', label: 'Caja', funcion: 'caja' },
  { id: 'marca', label: 'Marca', funcion: 'marca' },
]

const primerNombre = (n) => {
  const t = (n || '').trim()
  return t.includes('@') ? '' : t.split(/\s+/)[0]
}

export default function AdminPanel({ onCerrarSesion, esSuperAdmin, onIrAMelissa }) {
  const [perfil, setPerfil] = useState(null)
  const [nombreClinica, setNombreClinica] = useState('')
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('citas')
  const [canjesPendientes, setCanjesPendientes] = useState(0)
  const [masAbierto, setMasAbierto] = useState(false)
  const masRef = useRef(null)
  const habiaAbierto = useRef(false)
  const cerrarMas = useCallback(() => setMasAbierto(false), [])
  const { cargado: planCargado, plan, tiene } = useFunciones()
  const sinPlan = (t) => planCargado && !tiene(t.funcion)
  const tabActual = TABS.find((t) => t.id === tab)
  const mostrar = (id) => tab === id && !sinPlan(tabActual)

  useEffect(() => {
    obtenerPerfilActual().then(async (p) => {
      setPerfil(p)
      if (p?.clinica_id) {
        const { data } = await supabase.from('clinicas').select('nombre').eq('id', p.clinica_id).single()
        setNombreClinica(data?.nombre || '')
      }
      setCargando(false)
    })
  }, [])

  // Aviso visible en la pestaña: cuántos canjes esperan aprobación.
  async function contarCanjesPendientes() {
    const { count } = await supabase.from('canjes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    setCanjesPendientes(count || 0)
  }

  useEffect(() => {
    if (perfil?.rol === 'admin') contarCanjesPendientes()
  }, [perfil, tab])

  // Al cerrar «Más», el foco vuelve al botón que la abrió.
  useEffect(() => {
    if (!masAbierto && habiaAbierto.current) masRef.current?.focus()
    habiaAbierto.current = masAbierto
  }, [masAbierto])

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!perfil) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para continuar.</p>
  if (perfil.rol !== 'admin') {
    return <p className="text-center pt-16 text-sm text-ink/60 px-8">Esta sección es solo para administradores.</p>
  }

  return (
    <div className={`panel-admin ${tab !== 'citas' ? 'admin-shell-unificado' : ''} lg:flex lg:min-h-screen max-lg:bg-[var(--admin-fondo)]`}>
      <aside
        className="hidden lg:flex lg:flex-col lg:w-[252px] lg:flex-shrink-0 lg:sticky lg:top-0 lg:h-screen px-5 py-6"
        style={{ background: 'var(--gradiente-fondo-oscuro)' }}
      >
        <p className="font-display text-lg text-white mb-1">Panel del negocio</p>
        <p className="text-[11px] mb-6" style={{ color: 'rgba(254,250,248,.62)' }}>Vista operativa{plan ? ` · Plan ${NOMBRE_PLAN[plan] || plan}` : ''}</p>

        <nav className="flex flex-col gap-1 flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="text-left rounded-lg px-3.5 py-2.5 text-sm"
              style={
                tab === t.id
                  ? { background: 'var(--gradiente-primario)', color: '#FFFFFF' }
                  : { color: 'rgba(254,250,248,.74)' }
              }
            >
              {t.label}{t.id === 'canjes' && canjesPendientes > 0 ? ` (${canjesPendientes})` : ''}{sinPlan(t) && <Candado />}
            </button>
          ))}
        </nav>

        <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(235,203,134,.2)' }}>
          {esSuperAdmin && (
            <button onClick={onIrAMelissa} className="w-full text-left text-xs py-2" style={{ color: 'rgba(254,250,248,.74)' }}>
              Panel de Melissa
            </button>
          )}
          <button onClick={() => descargarDatosClinica(perfil.clinica_id, nombreClinica)} className="w-full text-left text-xs py-2" style={{ color: 'rgba(254,250,248,.74)' }}>
            Descargar mis datos
          </button>
          <button onClick={onCerrarSesion} className="w-full text-left text-xs py-2" style={{ color: 'rgba(254,250,248,.74)' }}>
            Salir
          </button>
        </div>
      </aside>

      <div className={`min-w-0 w-full sm:max-w-app mx-auto ${tab === 'citas' ? 'lg:max-w-none' : 'lg:max-w-3xl'} lg:mx-0 lg:flex-1 px-5 lg:px-10 pb-6 lg:pb-10 pt-[calc(env(safe-area-inset-top)+14px)] lg:pt-10 font-body`}>
      {(tab === 'citas' || sinPlan(tabActual)) && <CabeceraAdmin nombre={primerNombre(perfil.nombre)} titulo={tabActual.label} plan={plan ? NOMBRE_PLAN[plan] || plan : null} />}

      {planCargado && sinPlan(tabActual) && <FuncionBloqueada funcion={tabActual.funcion} />}
      {mostrar('citas') && <PanelCitas key={perfil.clinica_id} clinicaId={perfil.clinica_id} />}
      {/* El CRM recibe EscanerQR e HistorialCliente (definidos aquí) para reutilizarlos sin duplicar código. */}
      {mostrar('pacientes') && <SeccionAdmin titulo="Clientes" descripcion="Directorio y relación con tus clientes"><Crm clinicaId={perfil.clinica_id} HistorialCliente={HistorialCliente} EscanerQR={EscanerQR} onVerOportunidades={() => setTab('reactivar')} /></SeccionAdmin>}
      {mostrar('reactivar') && <SeccionAdmin titulo="Por reactivar" descripcion="Oportunidades de seguimiento"><ClientesReactivar clinicaId={perfil.clinica_id} HistorialCliente={HistorialCliente} /></SeccionAdmin>}
      {mostrar('canjes') && <SeccionAdmin titulo="Canjes" descripcion="Solicitudes y recompensas"><Canjes onCambio={contarCanjesPendientes} /></SeccionAdmin>}
      {mostrar('promociones') && <SeccionAdmin titulo="Promociones" descripcion="Ofertas de tu clínica"><Promociones clinicaId={perfil.clinica_id} /></SeccionAdmin>}
      {mostrar('empleados') && <SeccionAdmin titulo="Empleados" descripcion="Tu equipo de profesionales"><PanelEmpleados clinicaId={perfil.clinica_id} /></SeccionAdmin>}
      {mostrar('servicios') && <SeccionAdmin titulo="Servicios" descripcion="Catálogo de tratamientos"><PanelServicios clinicaId={perfil.clinica_id} /></SeccionAdmin>}
      {mostrar('productos') && <SeccionAdmin titulo="Productos" descripcion="Catálogo de tu tienda"><PanelProductos clinicaId={perfil.clinica_id} /></SeccionAdmin>}
      {mostrar('caja') && <SeccionAdmin titulo="Caja" descripcion="Movimientos y control diario"><PanelCaja clinicaId={perfil.clinica_id} perfilId={perfil.id} /></SeccionAdmin>}
      {mostrar('marca') && (
        <SeccionAdmin titulo="Marca" descripcion="Identidad y personalización de tu clínica">
          <Personalizacion />
        </SeccionAdmin>
      )}
      </div>

      <NavInferior
        tabs={TABS}
        tab={tab}
        onSelect={setTab}
        sinPlan={sinPlan}
        canjesPendientes={canjesPendientes}
        masAbierto={masAbierto}
        onMas={() => setMasAbierto(true)}
        masRef={masRef}
      />
      <HojaMas
        abierta={masAbierto}
        onCerrar={cerrarMas}
        tabs={TABS.filter((t) => !PRINCIPALES.includes(t.id))}
        tab={tab}
        onSelect={(id) => {
          setTab(id)
          setMasAbierto(false)
        }}
        sinPlan={sinPlan}
        canjesPendientes={canjesPendientes}
        cuenta={{
          onDescargar: () => descargarDatosClinica(perfil.clinica_id, nombreClinica),
          onSalir: onCerrarSesion,
          onIrAMelissa: esSuperAdmin ? onIrAMelissa : null,
        }}
      />
    </div>
  )
}

function PanelCitas({ clinicaId }) {
  return <PanelAgenda clinicaId={clinicaId} FormularioCita={FormularioNuevaCita} HistorialCliente={HistorialCliente} />
}

/** Compatible con el esquema desplegado: no envía duración ni finalización propuestas. */
export function FormularioNuevaCita({ clinicaId, onCreada, inicial = {} }) {
  const [pacientes, setPacientes] = useState([])
  const [especialistas, setEspecialistas] = useState([])
  const [servicios, setServicios] = useState([])
  const [pacienteId, setPacienteId] = useState('')
  const [especialistaId, setEspecialistaId] = useState(inicial.especialistaId || '')
  const [servicioId, setServicioId] = useState('')
  const [fecha, setFecha] = useState(inicial.fecha || '')
  const [hora, setHora] = useState(inicial.hora || '')
  const [guardando, setGuardando] = useState(false)
  const [cargandoListas, setCargandoListas] = useState(true)
  const [errorListas, setErrorListas] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setCargandoListas(true); setErrorListas('')
    async function cargarListas() {
      try {
        const [p, e, s] = await Promise.all([
          supabase.from('pacientes').select('id,nombre').eq('clinica_id', clinicaId).order('nombre').abortSignal(controller.signal),
          supabase.from('especialistas').select('id,nombre').eq('clinica_id', clinicaId).eq('activo', true).abortSignal(controller.signal),
          supabase.from('servicios').select('id,nombre,precio').eq('clinica_id', clinicaId).eq('activo', true).abortSignal(controller.signal),
        ])
        if (controller.signal.aborted) return
        if (p.error || e.error || s.error) throw new Error('listas')
        setPacientes(p.data || []); setEspecialistas(e.data || []); setServicios(s.data || [])
      } catch { if (!controller.signal.aborted) setErrorListas('No se pudieron cargar los datos del formulario.') }
      finally { if (!controller.signal.aborted) setCargandoListas(false) }
    }
    cargarListas()
    return () => controller.abort()
  }, [clinicaId, recarga])

  async function crearCita(e) {
    e.preventDefault()
    if (!pacienteId || !fecha || !hora || guardando) return
    setGuardando(true); setError('')
    try {
      const { error: errorInsert } = await supabase.from('citas').insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        especialista_id: especialistaId || null,
        fecha_hora: new Date(`${fecha}T${hora}:00`).toISOString(),
        estado: 'confirmada',
        servicio_id: servicioId || null,
        tratamiento: servicios.find(s => s.id === servicioId)?.nombre || null,
      })
      if (errorInsert) setError(mensajeErrorCita(errorInsert))
      else onCreada()
    } catch { setError('No se pudo guardar la cita. Revisa la conexión e intenta de nuevo.') }
    finally { setGuardando(false) }
  }

  return <form onSubmit={crearCita} className="cal-form">
    <label>Cliente<select aria-label="Cliente" value={pacienteId} onChange={e => setPacienteId(e.target.value)} required>
      <option value="" disabled>Selecciona un cliente</option>
      {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
    </select></label>
    <label>Profesional<select aria-label="Profesional" value={especialistaId} onChange={e => setEspecialistaId(e.target.value)}>
      <option value="">Sin especialista asignado</option>
      {especialistas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
    </select></label>
    <label>Servicio<select aria-label="Servicio" value={servicioId} onChange={e => setServicioId(e.target.value)}>
      <option value="">Sin servicio específico</option>
      {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} · L {Number(s.precio).toFixed(0)}</option>)}
    </select></label>
    <div className="cal-form-fechas">
      <label>Fecha<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></label>
      <label>Hora<input type="time" value={hora} onChange={e => setHora(e.target.value)} required /></label>
    </div>
    {cargandoListas && <p role="status">Cargando clientes y servicios…</p>}
    {errorListas && <p role="alert">{errorListas} <button type="button" className="cal-boton" onClick={() => setRecarga(n => n + 1)}>Reintentar</button></p>}
    {error && <p role="alert" className="cal-aviso">{error}</p>}
    <button type="submit" disabled={guardando || cargandoListas || Boolean(errorListas)} className="cal-boton cal-boton-principal">{guardando ? 'Agendando...' : 'Agendar cita'}</button>
  </form>
}

function PanelEmpleados({ clinicaId }) {
  const [empleados, setEmpleados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('especialistas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('nombre', { ascending: true })
    setEmpleados(data || [])
    setCargando(false)
  }

  async function agregarEmpleado(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const { error: errorInsert } = await supabase.from('especialistas').insert({
      clinica_id: clinicaId,
      nombre,
      especialidad,
      activo: true,
    })

    if (errorInsert) {
      setError('No se pudo guardar: ' + errorInsert.message)
    } else {
      setNombre('')
      setEspecialidad('')
      setMostrarForm(false)
      cargar()
    }
    setGuardando(false)
  }

  async function alternarActivo(empleado) {
    await supabase.from('especialistas').update({ activo: !empleado.activo }).eq('id', empleado.id)
    cargar()
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="admin-action w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--gradiente-primario)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF', boxShadow: mostrarForm ? 'none' : '0 3px 8px rgba(201,59,121,0.3)' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Agregar empleado'}
      </button>

      {mostrarForm && (
        <form onSubmit={agregarEmpleado} className="flex flex-col gap-2 mb-5 rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Especialidad (ej. Dermatología estética)"
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
          />
          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="admin-action rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            {guardando ? 'Guardando...' : 'Guardar empleado'}
          </button>
        </form>
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando empleados...</p>}
      {!cargando && empleados.length === 0 && <p className="admin-empty text-sm text-ink/50">Todavía no tienes empleados registrados.</p>}

      <div className="flex flex-col gap-2">
        {empleados.map((e) => (
          <div key={e.id} className="admin-card admin-catalog-record rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--color-accent)', opacity: e.activo ? 1 : 0.5 }}>
            <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: 'var(--gradiente-dorado)' }} />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{e.nombre}</p>
              <p className="text-[11px] text-ink/50">{e.especialidad || 'Sin especialidad registrada'}</p>
            </div>
            <button
              onClick={() => alternarActivo(e)}
              className="text-[10px] px-2.5 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: e.activo ? 'var(--color-ink)' : 'var(--color-primary)', color: '#FFFFFF' }}
            >
              {e.activo ? 'Quitar' : 'Reactivar'}
            </button>
          </div>
        ))}
      </div>
    </div>
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
  const [puntos, setPuntos] = useState('0')
  const config = useConfigPuntos(clinicaId)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [archivoFoto, setArchivoFoto] = useState(null)
  const [fotoPendiente, setFotoPendiente] = useState(null)
  const [avisoFoto, setAvisoFoto] = useState('')
  const guardandoRef = useRef(false)

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
    if (guardandoRef.current) return
    guardandoRef.current = true
    setGuardando(true)
    setError('')
    try {
    const blob = archivoFoto ? await prepararFotoServicio(archivoFoto) : null
    const nuevoId = crypto.randomUUID()
    const { error: errorInsert } = await supabase.from('servicios').insert({
      id: nuevoId,
      clinica_id: clinicaId,
      nombre,
      descripcion,
      precio: Number(precio),
      duracion_minutos: Number(duracion) || 30,
      puntos_otorga: Math.max(0, parseInt(puntos, 10) || 0),
      activo: true,
    })

    if (errorInsert) {
      setError('No se pudo guardar: ' + errorInsert.message)
    } else {
      setAvisoFoto('')
      if (blob) {
        try {
          await guardarFotoServicio({client:supabase,baseUrl:import.meta.env.VITE_SUPABASE_URL,clinicaId,servicio:{id:nuevoId,imagen_url:null},blob})
        } catch (err) {
          setFotoPendiente({id:nuevoId,archivo:archivoFoto})
          setAvisoFoto('El servicio se creó, pero su foto no se guardó. Puedes reintentar en su tarjeta. '+err.message)
        }
      }
      setArchivoFoto(null)
      setNombre('')
      setDescripcion('')
      setPrecio('')
      setDuracion('30')
      setPuntos('0')
      setMostrarForm(false)
      cargar()
    }
    } catch (err) { setError(err.message || 'No se pudo guardar el servicio.') }
    finally { setGuardando(false); guardandoRef.current = false }
  }

  async function alternarActivo(servicio) {
    await supabase.from('servicios').update({ activo: !servicio.activo }).eq('id', servicio.id)
    cargar()
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="admin-action w-full rounded-xl py-2.5 text-sm font-medium mb-3"
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
          <CampoPuntos valor={puntos} onCambio={setPuntos} precio={precio} tipo="servicio" config={config} />
          <SelectorFotoServicio archivo={archivoFoto} onCambio={setArchivoFoto} disabled={guardando} />

          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="admin-action rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
          >
            {guardando ? 'Guardando...' : 'Guardar servicio'}
          </button>
        </form>
      )}

      {avisoFoto && <p role="status" className="admin-notice">{avisoFoto}</p>}
      {cargando && <p className="text-sm text-ink/50">Cargando servicios...</p>}
      {!cargando && servicios.length === 0 && <p className="admin-empty text-sm text-ink/50">Todavía no tienes servicios registrados.</p>}

      <div className="flex flex-col gap-2">
        {servicios.map((s) => (
          <div key={s.id} className="admin-card admin-catalog-record rounded-xl p-3 flex items-center justify-between" style={{ background: 'var(--color-accent)', opacity: s.activo ? 1 : 0.5 }}>
            <FotoServicio servicio={s} clinicaId={clinicaId} archivoInicial={fotoPendiente?.id === s.id ? fotoPendiente.archivo : null} onCambio={url=>setServicios(actual=>actual.map(item=>item.id===s.id?{...item,imagen_url:url}:item))} />
            <div>
              <p className="text-sm font-medium text-ink">{s.nombre}</p>
              <p className="text-[11px] text-ink/50">L {Number(s.precio).toFixed(2)} · {s.duracion_minutos} min</p>
              <PuntosEnFila tabla="servicios" fila={s} tipo="servicio" config={config} onGuardado={cargar} />
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

function HistorialCliente({ clinicaId, paciente }) {
  const [tratamientos, setTratamientos] = useState([])
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [procedimiento, setProcedimiento] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')
  const [archivoAntes, setArchivoAntes] = useState(null)
  const [archivoDespues, setArchivoDespues] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const [{ data: dataTratamientos }, { data: dataServicios }] = await Promise.all([
      supabase.from('tratamientos_paciente').select('*').eq('paciente_id', paciente.id).order('fecha', { ascending: false }),
      supabase.from('servicios').select('nombre').eq('clinica_id', clinicaId).eq('activo', true),
    ])
    setTratamientos(dataTratamientos || [])
    setServicios(dataServicios || [])
    setCargando(false)
  }

  async function guardarRegistro(e) {
    e.preventDefault()
    if (!procedimiento) return
    setGuardando(true)
    setError('')

    async function subir(archivo, sufijo) {
      if (!archivo) return null
      const extension = archivo.name.split('.').pop()
      const ruta = `${clinicaId}/${paciente.id}/${Date.now()}-${sufijo}.${extension}`
      const { error: errorSubida } = await supabase.storage.from('fotos-tratamientos').upload(ruta, archivo)
      return errorSubida ? null : ruta
    }

    const [rutaAntes, rutaDespues] = await Promise.all([
      subir(archivoAntes, 'antes'),
      subir(archivoDespues, 'despues'),
    ])

    const { error: errorInsert } = await supabase.from('tratamientos_paciente').insert({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      procedimiento,
      recomendaciones: recomendaciones || null,
      foto_antes_url: rutaAntes,
      foto_despues_url: rutaDespues,
    })

    if (errorInsert) {
      setError('No se pudo guardar: ' + errorInsert.message)
    } else {
      setProcedimiento('')
      setRecomendaciones('')
      setArchivoAntes(null)
      setArchivoDespues(null)
      setMostrarForm(false)
      cargar()
    }
    setGuardando(false)
  }

  return (
    <div className="mt-3 rounded-xl p-3 bg-white">
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="w-full rounded-lg py-2 text-xs font-medium mb-2"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--color-primary)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Agregar antes/después'}
      </button>

      {mostrarForm && (
        <form onSubmit={guardarRegistro} className="flex flex-col gap-2 mb-3 rounded-lg p-2.5" style={{ background: 'var(--color-accent)' }}>
          <select
            className="rounded-lg px-3 py-2 text-sm bg-white"
            value={procedimiento}
            onChange={(e) => setProcedimiento(e.target.value)}
            required
          >
            <option value="" disabled>Selecciona el procedimiento</option>
            {servicios.map((s) => (
              <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
            ))}
            <option value="Otro">Otro</option>
          </select>
          <textarea
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Recomendaciones para el cliente (opcional)"
            value={recomendaciones}
            onChange={(e) => setRecomendaciones(e.target.value)}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs px-3 py-4 rounded-lg bg-white cursor-pointer text-center" style={{ color: 'var(--color-texto-secundario)', border: '1px dashed var(--color-borde-tarjeta)' }}>
              {archivoAntes ? '✓ Foto antes' : 'Foto antes'}
              <input type="file" accept="image/*" onChange={(e) => setArchivoAntes(e.target.files?.[0] || null)} className="hidden" />
            </label>
            <label className="text-xs px-3 py-4 rounded-lg bg-white cursor-pointer text-center" style={{ color: 'var(--color-texto-secundario)', border: '1px dashed var(--color-borde-tarjeta)' }}>
              {archivoDespues ? '✓ Foto después' : 'Foto después'}
              <input type="file" accept="image/*" onChange={(e) => setArchivoDespues(e.target.files?.[0] || null)} className="hidden" />
            </label>
          </div>
          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
          >
            {guardando ? 'Guardando...' : 'Guardar registro'}
          </button>
        </form>
      )}

      {cargando && <p className="text-xs text-ink/50">Cargando historial...</p>}
      {!cargando && tratamientos.length === 0 && <p className="text-xs text-ink/50">Este cliente todavía no tiene registros.</p>}

      <div className="flex flex-col gap-2">
        {tratamientos.map((t) => (
          <FilaTratamientoAdmin key={t.id} tratamiento={t} />
        ))}
      </div>
    </div>
  )
}

function FilaTratamientoAdmin({ tratamiento }) {
  const [urlAntes, setUrlAntes] = useState(null)
  const [urlDespues, setUrlDespues] = useState(null)

  useEffect(() => {
    async function cargarFotos() {
      if (tratamiento.foto_antes_url) {
        const { data } = await supabase.storage.from('fotos-tratamientos').createSignedUrl(tratamiento.foto_antes_url, 3600)
        if (data) setUrlAntes(data.signedUrl)
      }
      if (tratamiento.foto_despues_url) {
        const { data } = await supabase.storage.from('fotos-tratamientos').createSignedUrl(tratamiento.foto_despues_url, 3600)
        if (data) setUrlDespues(data.signedUrl)
      }
    }
    cargarFotos()
  }, [tratamiento])

  const fecha = new Date(tratamiento.fecha).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-lg p-2.5" style={{ background: 'var(--color-accent)' }}>
      <p className="text-xs font-medium text-ink">{tratamiento.procedimiento} · <span className="font-normal text-ink/50">{fecha}</span></p>
      {(tratamiento.foto_antes_url || tratamiento.foto_despues_url) && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="rounded-lg overflow-hidden flex items-center justify-center bg-white" style={{ height: 70 }}>
            {urlAntes ? <img src={urlAntes} alt="Antes" className="w-full h-full object-cover" /> : <span className="text-[9px] text-ink/30">Antes</span>}
          </div>
          <div className="rounded-lg overflow-hidden flex items-center justify-center bg-white" style={{ height: 70 }}>
            {urlDespues ? <img src={urlDespues} alt="Después" className="w-full h-full object-cover" /> : <span className="text-[9px] text-ink/30">Después</span>}
          </div>
        </div>
      )}
      {tratamiento.recomendaciones && <p className="text-[11px] text-ink/60 mt-1.5">{tratamiento.recomendaciones}</p>}
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
              style={modo === 'asignar' ? { background: 'var(--gradiente-primario)', color: '#FFFFFF', boxShadow: '0 3px 8px rgba(201,59,121,0.3)' } : { background: '#FFFFFF', color: 'var(--color-ink)' }}
            >
              Asignar puntos
            </button>
            <button
              type="button"
              onClick={() => setModo('canjear')}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={modo === 'canjear' ? { background: 'var(--gradiente-primario)', color: '#FFFFFF', boxShadow: '0 3px 8px rgba(201,59,121,0.3)' } : { background: '#FFFFFF', color: 'var(--color-ink)' }}
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
            style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
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
  const [codigoBarras, setCodigoBarras] = useState('')
  const [puntos, setPuntos] = useState('0')
  const config = useConfigPuntos(clinicaId)
  const [escaneandoCampo, setEscaneandoCampo] = useState(false)
  const [asignando, setAsignando] = useState(null)
  const [mensajeCodigo, setMensajeCodigo] = useState('')
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
      codigo_barras: codigoBarras.trim() || null,
      puntos_otorga: Math.max(0, parseInt(puntos, 10) || 0),
      activo: true,
    })

    if (errorInsert) {
      setError('No se pudo guardar: ' + errorInsert.message)
    } else {
      setNombre('')
      setDescripcion('')
      setPrecio('')
      setStock('')
      setCodigoBarras('')
      setPuntos('0')
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

  async function asignarCodigo(codigo) {
    const producto = asignando
    setAsignando(null)
    const { error: errorUpdate } = await supabase.from('productos').update({ codigo_barras: codigo }).eq('id', producto.id)
    setMensajeCodigo(errorUpdate ? 'No se pudo asignar el código: ' + errorUpdate.message : `Código ${codigo} asignado a ${producto.nombre}`)
    cargar()
  }

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="admin-action w-full rounded-xl py-2.5 text-sm font-medium mb-3"
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
          <CampoPuntos valor={puntos} onCambio={setPuntos} precio={precio} tipo="producto" config={config} />
          <div className="flex gap-2">
            <input
              className="rounded-lg px-3 py-2 text-sm bg-white flex-1"
              placeholder="Código de barras (opcional)"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              inputMode="numeric"
            />
            <button type="button" onClick={() => setEscaneandoCampo((v) => !v)} className="rounded-lg px-3 text-sm bg-white">📷</button>
          </div>
          {escaneandoCampo && (
            <EscanerBarras onDetectado={(c) => { setCodigoBarras(c); setEscaneandoCampo(false) }} />
          )}
          <label className="admin-upload text-xs px-3 py-2 rounded-lg bg-white cursor-pointer text-center" style={{ color: 'var(--color-texto-secundario)' }}>
            {archivo ? archivo.name : 'Elegir foto (opcional)'}
            <input type="file" accept="image/*" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="hidden" />
          </label>

          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="admin-action rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
          >
            {guardando ? 'Guardando...' : 'Guardar producto'}
          </button>
        </form>
      )}

      {cargando && <p className="text-sm text-ink/50">Cargando productos...</p>}
      {!cargando && productos.length === 0 && <p className="admin-empty text-sm text-ink/50">Todavía no tienes productos en tu tienda.</p>}

      {asignando && (
        <div className="mb-3">
          <p className="text-xs mb-1" style={{ color: 'var(--color-texto-secundario)' }}>
            Escanea el código de: <strong>{asignando.nombre}</strong>
          </p>
          <EscanerBarras key={asignando.id} onDetectado={asignarCodigo} />
        </div>
      )}
      {mensajeCodigo && <p className="text-xs mb-3" style={{ color: 'var(--color-primary)' }}>{mensajeCodigo}</p>}

      <div className="flex flex-col gap-2">
        {productos.map((p) => (
          <div key={p.id} className="admin-card admin-catalog-record rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--color-accent)', opacity: p.activo ? 1 : 0.5 }}>
            <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-white overflow-hidden flex items-center justify-center">
              {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" /> : <span className="text-[8px] text-ink/30">Sin foto</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{p.nombre}</p>
              <p className="text-[11px] text-ink/50">L {Number(p.precio).toFixed(2)} · Stock: {p.stock}</p>
              <PuntosEnFila tabla="productos" fila={p} tipo="producto" config={config} onGuardado={cargar} />
              <p className="text-[10px] text-ink/40">{p.codigo_barras ? `Código: ${p.codigo_barras}` : 'Sin código de barras'}</p>
            </div>
            <button
              onClick={() => { setMensajeCodigo(''); setAsignando(asignando?.id === p.id ? null : p) }}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white"
              style={{ color: 'var(--color-ink)' }}
            >
              {p.codigo_barras ? 'Cambiar código' : 'Asignar código'}
            </button>
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

function PanelCaja({ clinicaId, perfilId }) {
  const [pedidos, setPedidos] = useState([])
  const [pagos, setPagos] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [tipo, setTipo] = useState('servicio')
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [pacienteId, setPacienteId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [efectivoContado, setEfectivoContado] = useState('')
  const [direccion, setDireccion] = useState('ingreso')
  const [escaneando, setEscaneando] = useState(false)
  const [ventaProducto, setVentaProducto] = useState(null)
  const [cantidadVenta, setCantidadVenta] = useState('1')
  const [metodoVenta, setMetodoVenta] = useState('efectivo')
  const [ventaCliente, setVentaCliente] = useState('')
  const [claveVenta, setClaveVenta] = useState('')
  const [registrandoVenta, setRegistrandoVenta] = useState(false)
  const [mensajeVenta, setMensajeVenta] = useState('')
  const [anulando, setAnulando] = useState(null)
  const [pinAnular, setPinAnular] = useState('')
  const [motivoAnular, setMotivoAnular] = useState('')
  const [procesandoAnular, setProcesandoAnular] = useState(false)
  const [mensajeAnular, setMensajeAnular] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const [{ data: dataPedidos }, { data: dataPagos }, { data: dataPacientes }] = await Promise.all([
      supabase.from('pedidos').select('*, pacientes(nombre)').eq('clinica_id', clinicaId).order('fecha', { ascending: false }),
      supabase.from('pagos').select('*, pacientes(nombre)').eq('clinica_id', clinicaId).is('anulado_at', null).order('fecha', { ascending: false }),
      supabase.from('pacientes').select('id, nombre').eq('clinica_id', clinicaId).order('nombre'),
    ])
    setPedidos(dataPedidos || [])
    setPagos(dataPagos || [])
    setPacientes(dataPacientes || [])
    setCargando(false)
  }

  async function registrarPago(e) {
    e.preventDefault()
    if (!concepto || !monto) return
    setGuardando(true)
    setError('')

    const { error: errorInsert } = await supabase.from('pagos').insert({
      clinica_id: clinicaId,
      paciente_id: direccion === 'ingreso' ? pacienteId || null : null,
      concepto,
      tipo: direccion === 'ingreso' ? tipo : 'otro',
      direccion,
      monto: Number(monto),
      metodo_pago: metodoPago,
      registrado_por: perfilId,
    })

    if (errorInsert) {
      setError('No se pudo registrar: ' + errorInsert.message)
    } else {
      setConcepto('')
      setMonto('')
      setPacienteId('')
      setMostrarForm(false)
      cargar()
    }
    setGuardando(false)
  }

  async function productoEscaneado(codigo) {
    setEscaneando(false)
    setMensajeVenta('')
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio, puntos_otorga')
      .eq('clinica_id', clinicaId)
      .eq('codigo_barras', codigo)
      .maybeSingle()
    if (!data) {
      setMensajeVenta(`No hay un producto con el código ${codigo}. Asígnalo en la pestaña Productos.`)
      return
    }
    setCantidadVenta('1')
    setVentaCliente('')
    setClaveVenta(nuevaClaveOperacion())   // una clave por venta: un reintento no la duplica
    setVentaProducto(data)
  }

  async function registrarVenta() {
    if (registrandoVenta) return
    setRegistrandoVenta(true)
    setMensajeVenta('')
    const cantidad = Math.max(1, parseInt(cantidadVenta, 10) || 1)
    const detalle = `${ventaProducto.nombre}${cantidad > 1 ? ` x${cantidad}` : ''}`
    // El servidor calcula el precio y los puntos. Con la misma clave, un reintento devuelve la misma venta.
    const { data, error: errorRpc } = await supabase.rpc('registrar_venta_producto', {
      p_clave: claveVenta,
      p_producto_id: ventaProducto.id,
      p_cantidad: cantidad,
      p_metodo_pago: metodoVenta,
      p_paciente_id: ventaCliente || null,
    })
    setRegistrandoVenta(false)
    if (errorRpc || data?.resultado !== 'ok') {
      const motivos = {
        producto_no_disponible: 'Ese producto ya no está disponible.',
        cliente_invalido: 'Ese cliente no pertenece a tu negocio.',
        cantidad_invalida: 'La cantidad no es válida.',
      }
      setMensajeVenta(motivos[data?.resultado] || 'No se pudo registrar la venta. Puedes intentar de nuevo: no se duplicará.')
      return
    }
    const cliente = pacientes.find((p) => p.id === ventaCliente)?.nombre
    setMensajeVenta(
      data.repetido
        ? `Esta venta ya estaba registrada (no se duplicó): ${detalle}`
        : `Venta registrada: ${detalle}` +
            (data.puntos_otorgados > 0
              ? ` · +${data.puntos_otorgados} puntos para ${cliente}`
              : ventaCliente ? ' · este producto no otorga puntos' : ' · sin cliente: no suma puntos')
    )
    setVentaProducto(null)
    cargar()
  }

  async function marcarPedidoEntregado(pedido) {
    setMensajeVenta('')
    const { data, error: errorRpc } = await supabase.rpc('completar_pedido', { p_pedido_id: pedido.id })
    if (errorRpc || data?.resultado !== 'ok') {
      setMensajeVenta('No se pudo completar el pedido. Intenta de nuevo.')
      return
    }
    setMensajeVenta(
      `Pedido entregado${pedido.pacientes?.nombre ? ` a ${pedido.pacientes.nombre}` : ''}` +
        (data.puntos_otorgados > 0 ? ` · +${data.puntos_otorgados} puntos` : data.repetido ? ' · ya estaba entregado' : ' · sin puntos para estos productos')
    )
    cargar()
  }

  async function confirmarAnulacion(e) {
    e.preventDefault()
    setProcesandoAnular(true)
    const { data, error: errorRpc } = await supabase.rpc('anular_pago', {
      p_pago_id: anulando.pagoId,
      p_pin: pinAnular,
      p_motivo: motivoAnular,
    })
    setProcesandoAnular(false)

    if (errorRpc) {
      setMensajeAnular('No se pudo anular: ' + errorRpc.message)
      return
    }
    if (data === 'ok') {
      setMensajeAnular(`Movimiento anulado: ${anulando.concepto}`)
      setAnulando(null)
      cargar()
      return
    }
    const mensajes = {
      pin_incorrecto: 'Clave incorrecta.',
      bloqueado: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.',
      sin_clave: 'Primero crea la clave de supervisor (sección al final de Caja).',
      motivo_requerido: 'Escribe el motivo de la anulación.',
      no_encontrado: 'Ese movimiento ya no existe o ya fue anulado.',
    }
    setMensajeAnular(mensajes[data] || 'No se pudo anular.')
  }

  // Unificamos pedidos (Tienda) + pagos (registrados a mano) en una sola
  // lista de movimientos, para que Caja refleje TODO el dinero que entra,
  // sin importar por dónde entró.
  const movimientos = [
    ...pagos.map((p) => ({
      id: 'pago-' + p.id,
      pagoId: p.id,
      fecha: p.fecha,
      concepto: p.concepto,
      cliente: p.pacientes?.nombre ?? null,
      monto: Number(p.monto),
      descuento: Number(p.descuento || 0),
      metodoPago: p.metodo_pago,
      direccion: p.direccion,
      tipo: p.tipo,
      origen: 'manual',
    })),
    ...pedidos
      .filter((p) => p.estado !== 'cancelado')
      .map((p) => ({
        id: 'pedido-' + p.id,
        fecha: p.fecha,
        concepto: 'Compra en tienda',
        cliente: p.pacientes?.nombre ?? null,
        monto: Number(p.total),
        metodoPago: p.metodo_pago === 'wallet' ? 'wallet' : p.metodo_pago,
        direccion: 'ingreso',
        tipo: 'producto',
        origen: 'tienda',
      })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const hoy = new Date().toDateString()
  const movimientosHoy = movimientos.filter((m) => new Date(m.fecha).toDateString() === hoy)
  const sumar = (lista) => lista.reduce((sum, m) => sum + m.monto, 0)
  const ingresosHoy = movimientosHoy.filter((m) => m.direccion === 'ingreso')
  const egresosHoy = movimientosHoy.filter((m) => m.direccion === 'egreso')
  const totalIngresos = sumar(ingresosHoy)
  const totalEgresos = sumar(egresosHoy)
  const netoHoy = totalIngresos - totalEgresos
  const serviciosHoy = sumar(ingresosHoy.filter((m) => m.tipo === 'servicio'))
  const productosHoy = sumar(ingresosHoy.filter((m) => m.tipo === 'producto'))
  const otrosIngresosHoy = totalIngresos - serviciosHoy - productosHoy
  // monto = lo realmente cobrado; el descuento por canje se informa aparte y no afecta el cuadre de efectivo.
  const descuentosHoy = ingresosHoy.reduce((sum, m) => sum + (m.descuento || 0), 0)
  const efectivoEsperado =
    sumar(ingresosHoy.filter((m) => m.metodoPago === 'efectivo')) -
    sumar(egresosHoy.filter((m) => m.metodoPago === 'efectivo'))

  const diferenciaCaja = efectivoContado === '' ? null : Number(efectivoContado) - efectivoEsperado

  function descargarReporte() {
    const encabezado = 'Fecha,Movimiento,Concepto,Cliente,Método de pago,Descuento por canje,Monto cobrado\n'
    const filas = movimientos
      .map((m) => {
        const fecha = new Date(m.fecha).toLocaleString('es-HN')
        const firmado = m.direccion === 'egreso' ? -m.monto : m.monto
        return `"${fecha}","${m.direccion === 'egreso' ? 'Egreso' : 'Ingreso'}","${m.concepto}","${m.cliente || ''}","${m.metodoPago}","${(m.descuento || 0).toFixed(2)}","${firmado.toFixed(2)}"`
      })
      .join('\n')
    const csv = encabezado + filas
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `reporte-melissa-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  if (cargando) return <p className="text-sm text-ink/50">Cargando caja...</p>

  return (
    <div>
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="admin-action w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: mostrarForm ? 'var(--color-accent)' : 'var(--gradiente-primario)', color: mostrarForm ? 'var(--color-ink)' : '#FFFFFF', boxShadow: mostrarForm ? 'none' : '0 3px 8px rgba(201,59,121,0.3)' }}
      >
        {mostrarForm ? 'Cancelar' : '+ Registrar ingreso / gasto'}
      </button>

      {mostrarForm && (
        <form onSubmit={registrarPago} className="flex flex-col gap-2 mb-5 rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
          <div className="flex gap-2">
            {['ingreso', 'egreso'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDireccion(d)}
                className="flex-1 rounded-lg py-2 text-xs font-medium"
                style={direccion === d ? { background: 'var(--gradiente-primario)', color: '#FFFFFF' } : { background: '#FFFFFF', color: 'var(--color-ink)' }}
              >
                {d === 'ingreso' ? 'Ingreso' : 'Egreso (gasto)'}
              </button>
            ))}
          </div>
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={direccion === 'ingreso' ? 'Concepto (ej. Limpieza facial - Ana)' : 'Concepto del gasto (ej. Compra de insumos)'}
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            required
          />
          {direccion === 'ingreso' && (
            <select className="rounded-lg px-3 py-2 text-sm bg-white" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
              <option value="">Sin cliente específico</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            {direccion === 'ingreso' && (
              <select className="rounded-lg px-3 py-2 text-sm bg-white flex-1" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="servicio">Servicio</option>
                <option value="producto">Producto</option>
                <option value="membresia">Membresía</option>
                <option value="otro">Otro</option>
              </select>
            )}
            <select className="rounded-lg px-3 py-2 text-sm bg-white flex-1" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Monto (L)"
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
          {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="admin-action rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)' }}
          >
            {guardando ? 'Guardando...' : direccion === 'ingreso' ? 'Registrar ingreso' : 'Registrar gasto'}
          </button>
        </form>
      )}

      <button
        onClick={() => { setMensajeVenta(''); setVentaProducto(null); setEscaneando((v) => !v) }}
        className="admin-action w-full rounded-xl py-2.5 text-sm font-medium mb-3"
        style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}
      >
        {escaneando ? 'Cerrar escáner' : '📷 Vender producto (escanear código de barras)'}
      </button>

      {escaneando && (
        <div className="mb-3">
          <EscanerBarras onDetectado={productoEscaneado} />
        </div>
      )}

      {ventaProducto && (
        <div className="rounded-xl p-3 mb-3 bg-white border flex flex-col gap-2" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{ventaProducto.nombre}</p>
          <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>L {Number(ventaProducto.precio).toFixed(2)} c/u</p>
          <div className="flex gap-2">
            <input
              className="rounded-lg px-3 py-2 text-sm flex-1"
              style={{ background: 'var(--color-accent)' }}
              type="number"
              min="1"
              value={cantidadVenta}
              onChange={(e) => setCantidadVenta(e.target.value)}
              placeholder="Cantidad"
            />
            <select className="rounded-lg px-3 py-2 text-sm flex-1" style={{ background: 'var(--color-accent)' }} value={metodoVenta} onChange={(e) => setMetodoVenta(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <select className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-accent)' }} value={ventaCliente} onChange={(e) => setVentaCliente(e.target.value)} aria-label="Cliente de la venta">
            <option value="">Sin cliente (no suma puntos)</option>
            {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {ventaCliente && Number(ventaProducto.puntos_otorga) > 0 && (
            <p className="text-[11px]" style={{ color: 'var(--color-primary)' }}>
              Suma {Number(ventaProducto.puntos_otorga) * Math.max(1, parseInt(cantidadVenta, 10) || 1)} puntos al cliente.
            </p>
          )}
          <button onClick={registrarVenta} disabled={registrandoVenta} className="admin-action rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60" style={{ background: 'var(--gradiente-primario)' }}>
            {registrandoVenta ? 'Registrando...' : `Registrar venta · L ${(Number(ventaProducto.precio) * Math.max(1, parseInt(cantidadVenta, 10) || 1)).toFixed(2)}`}
          </button>
        </div>
      )}

      {mensajeVenta && <p className="text-xs mb-3" style={{ color: 'var(--color-primary)' }}>{mensajeVenta}</p>}

      <div className="admin-summary rounded-xl p-4 mb-4" style={{ background: 'var(--gradiente-fondo-oscuro)' }}>
        <p className="text-[11px]" style={{ color: 'var(--color-dorado-claro)' }}>Resultado de hoy (ingresos − egresos)</p>
        <p className="text-xl text-white font-medium mt-1">L {netoHoy.toFixed(2)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <p className="text-[11px] text-white/70">Ingresos: L {totalIngresos.toFixed(2)}</p>
          <p className="text-[11px] text-white/70">Egresos: L {totalEgresos.toFixed(2)}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          <p className="text-[11px] text-white/70">Servicios: L {serviciosHoy.toFixed(2)}</p>
          <p className="text-[11px] text-white/70">Productos: L {productosHoy.toFixed(2)}</p>
          {otrosIngresosHoy > 0 && <p className="text-[11px] text-white/70">Otros: L {otrosIngresosHoy.toFixed(2)}</p>}
          {descuentosHoy > 0 && <p className="text-[11px] text-white/70">Descuentos por canje: L {descuentosHoy.toFixed(2)} (ya restados de lo cobrado)</p>}
        </div>
      </div>

      <div className="admin-card rounded-xl p-3 mb-4 bg-white border" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-ink)' }}>Cierre de caja (efectivo)</p>
        <p className="text-xs mb-2" style={{ color: 'var(--color-texto-secundario)' }}>
          Efectivo esperado en caja hoy: <strong>L {efectivoEsperado.toFixed(2)}</strong> (ingresos en efectivo − gastos en efectivo)
        </p>
        <div className="flex gap-2 items-center">
          <input
            className="rounded-lg px-3 py-2 text-sm flex-1"
            style={{ background: 'var(--color-accent)' }}
            placeholder="Efectivo contado en caja"
            type="number"
            step="0.01"
            value={efectivoContado}
            onChange={(e) => setEfectivoContado(e.target.value)}
          />
        </div>
        {diferenciaCaja !== null && (
          <p className="text-xs mt-2" style={{ color: diferenciaCaja === 0 ? 'var(--color-primary)' : diferenciaCaja > 0 ? '#6B8E5A' : '#B0524A' }}>
            {diferenciaCaja === 0
              ? '✓ La caja cuadra exacto.'
              : diferenciaCaja > 0
                ? `Sobran L ${diferenciaCaja.toFixed(2)} respecto a lo esperado.`
                : `Faltan L ${Math.abs(diferenciaCaja).toFixed(2)} respecto a lo esperado.`}
          </p>
        )}
      </div>

      <button
        onClick={descargarReporte}
        className="w-full rounded-xl py-2.5 text-sm font-medium mb-4"
        style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}
      >
        ⬇ Descargar reporte completo (CSV)
      </button>

      {anulando && (
        <form onSubmit={confirmarAnulacion} className="rounded-xl p-3 mb-3 flex flex-col gap-2" style={{ background: 'var(--color-accent)', border: '1px solid #B0524A' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
            Anular: {anulando.concepto} · L {anulando.monto.toFixed(2)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>Requiere la clave de un supervisor o gerente.</p>
          {anulando.descuento > 0 && (
            <p className="text-xs" style={{ color: '#B0524A' }}>
              Este cobro tiene un descuento por canje. Al anularlo, los puntos del cliente no se devuelven solos: si corresponde, ajústalos aparte.
            </p>
          )}
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Motivo de la anulación"
            value={motivoAnular}
            onChange={(e) => setMotivoAnular(e.target.value)}
            required
          />
          <input
            className="rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="Clave de supervisor"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinAnular}
            onChange={(e) => setPinAnular(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAnulando(null)} className="flex-1 rounded-lg py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={procesandoAnular} className="flex-1 rounded-lg py-2 text-xs text-white disabled:opacity-60" style={{ background: '#B0524A' }}>
              {procesandoAnular ? 'Verificando...' : 'Confirmar anulación'}
            </button>
          </div>
        </form>
      )}
      {mensajeAnular && <p className="text-xs mb-3" style={{ color: 'var(--color-primary)' }}>{mensajeAnular}</p>}

      {pedidos.some((p) => !['entregado', 'cancelado'].includes(p.estado)) && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Pedidos de la tienda por entregar</p>
          <div className="flex flex-col gap-2">
            {pedidos
              .filter((p) => !['entregado', 'cancelado'].includes(p.estado))
              .map((p) => (
                <div key={p.id} className="admin-card admin-catalog-record rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: 'var(--color-accent)' }}>
                  <div>
                    <p className="text-sm font-medium text-ink">{p.pacientes?.nombre ?? 'Cliente'} · L {Number(p.total).toFixed(2)}</p>
                    <p className="text-[11px] text-ink/50">
                      {new Date(p.fecha).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })} · {p.entrega === 'domicilio' ? 'A domicilio' : 'Recoger en el negocio'} · {p.estado}
                    </p>
                  </div>
                  <button onClick={() => marcarPedidoEntregado(p)} className="text-[10px] px-2.5 py-1.5 rounded-lg text-white flex-shrink-0" style={{ background: 'var(--gradiente-primario)' }}>
                    Marcar entregado
                  </button>
                </div>
              ))}
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-texto-terciario)' }}>Al marcarlo entregado, el cliente recibe los puntos de lo que compró.</p>
        </div>
      )}

      <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Movimientos de hoy</p>
      {movimientosHoy.length === 0 && <p className="admin-empty text-sm text-ink/50">Todavía no hay movimientos hoy.</p>}
      <div className="flex flex-col gap-2">
        {movimientosHoy.map((m) => (
          <div key={m.id} className="admin-card admin-catalog-record rounded-xl p-3 flex justify-between items-center" style={{ background: 'var(--color-accent)' }}>
            <div>
              <p className="text-sm font-medium text-ink">{m.concepto}</p>
              {m.descuento > 0 && (
                <p className="text-[11px]" style={{ color: '#4F7A3E' }}>
                  Total L {(m.monto + m.descuento).toFixed(2)} − descuento por canje L {m.descuento.toFixed(2)}
                </p>
              )}
              <p className="text-[11px] text-ink/50">
                {m.cliente ? `${m.cliente} · ` : ''}{m.metodoPago} · {new Date(m.fecha).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: m.direccion === 'egreso' ? '#B0524A' : 'var(--color-primary)' }}>
                {m.direccion === 'egreso' ? '−' : ''}L {m.monto.toFixed(2)}
              </p>
              {m.origen === 'manual' && (
                <button
                  onClick={() => { setMensajeAnular(''); setPinAnular(''); setMotivoAnular(''); setAnulando(m) }}
                  className="text-[10px] mt-1"
                  style={{ color: '#B0524A' }}
                >
                  Anular
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ClaveSupervisor />
    </div>
  )
}

function ClaveSupervisor() {
  const [tieneClave, setTieneClave] = useState(null)
  const [pinActual, setPinActual] = useState('')
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinRepetido, setPinRepetido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    supabase.rpc('tiene_clave_supervisor').then(({ data }) => setTieneClave(!!data))
  }, [])

  async function guardar(e) {
    e.preventDefault()
    setMensaje('')
    if (pinNuevo !== pinRepetido) {
      setMensaje('Las claves nuevas no coinciden.')
      return
    }
    setGuardando(true)
    const { data, error } = await supabase.rpc('definir_clave_supervisor', {
      p_pin_nuevo: pinNuevo,
      p_pin_actual: tieneClave ? pinActual : null,
    })
    setGuardando(false)

    if (error) {
      setMensaje('No se pudo guardar: ' + error.message)
      return
    }
    const mensajes = {
      ok: 'Clave guardada.',
      formato: 'La clave debe tener de 4 a 8 dígitos.',
      pin_actual_incorrecto: 'La clave actual es incorrecta.',
      bloqueado: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.',
    }
    setMensaje(mensajes[data] || 'No se pudo guardar.')
    if (data === 'ok') {
      setTieneClave(true)
      setPinActual('')
      setPinNuevo('')
      setPinRepetido('')
    }
  }

  if (tieneClave === null) return null

  return (
    <form onSubmit={guardar} className="rounded-xl p-3 mt-6 bg-white border flex flex-col gap-2" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>Clave de supervisor</p>
      <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>
        {tieneClave
          ? 'Se pide para anular movimientos de caja. Para cambiarla necesitas la clave actual.'
          : 'Aún no hay clave. Créala (4 a 8 dígitos) y compártela solo con supervisores o gerentes.'}
      </p>
      {tieneClave && (
        <input className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-accent)' }} placeholder="Clave actual" type="password" inputMode="numeric" maxLength={8} value={pinActual} onChange={(e) => setPinActual(e.target.value)} required />
      )}
      <input className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-accent)' }} placeholder={tieneClave ? 'Clave nueva' : 'Clave'} type="password" inputMode="numeric" maxLength={8} value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} required />
      <input className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-accent)' }} placeholder="Repite la clave" type="password" inputMode="numeric" maxLength={8} value={pinRepetido} onChange={(e) => setPinRepetido(e.target.value)} required />
      {mensaje && <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
      <button type="submit" disabled={guardando} className="rounded-lg py-2.5 text-white text-sm font-medium disabled:opacity-60" style={{ background: 'var(--gradiente-primario)' }}>
        {guardando ? 'Guardando...' : tieneClave ? 'Cambiar clave' : 'Crear clave'}
      </button>
    </form>
  )
}
