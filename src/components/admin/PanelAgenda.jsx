import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { aIsoLocal, fechaLocal } from '../../lib/citas'
import { COLUMNAS_AGENDA, coloresProfesionales, duracionCatalogo, filtrarProfesional, nombreDia, rangoSemana, semanaDe, sumarDias, transicionExistente } from '../../lib/calendario'
import { mensajeErrorCita } from '../../lib/erroresCitas'
import CalendarioSemanal, { HojaCalendario } from './CalendarioSemanal'
import TarjetaCita from './TarjetaCita'
import Cliente360 from '../../pages/Cliente360'
import './calendario.css'

export default function PanelAgenda({ clinicaId, FormularioCita, HistorialCliente }) {
  const [dia, setDia] = useState(() => aIsoLocal(new Date()))
  const [filtro, setFiltro] = useState('todos')
  const [datos, setDatos] = useState({ clave: '', citas: [], profesionales: [], pendientes: 0 })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [refresco, setRefresco] = useState(0)
  const [nueva, setNueva] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [promo, setPromo] = useState(null)
  const [bandeja, setBandeja] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [solicitudes, setSolicitudes] = useState(null)
  const [errorSolicitudes, setErrorSolicitudes] = useState('')
  const [ocupada, setOcupada] = useState(false)
  const mutacion = useRef(false)
  const [cliente, setCliente] = useState(null)
  const dias = semanaDe(dia)
  const clave = `${clinicaId}:${dias[0]}`
  const { desde, hasta } = rangoSemana(dia)

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true); setError('')
    async function leerSemana() {
      const lista = []
      for (let inicio = 0; !controller.signal.aborted; inicio += 500) {
        const respuesta = await supabase.from('citas').select(COLUMNAS_AGENDA).eq('clinica_id', clinicaId)
          .gte('fecha_hora', desde).lt('fecha_hora', hasta).order('fecha_hora').order('id')
          .range(inicio, inicio + 499).abortSignal(controller.signal)
        if (respuesta.error) return respuesta
        lista.push(...(respuesta.data || []))
        if ((respuesta.data || []).length < 500) return { data: lista }
      }
      return { data: [] }
    }
    async function cargar() {
      try {
        const [agenda, equipo, pendientes] = await Promise.all([
          leerSemana(),
          supabase.from('especialistas').select('id,nombre,activo').eq('clinica_id', clinicaId).order('nombre').abortSignal(controller.signal),
          supabase.from('citas').select('id', { count: 'exact', head: true }).eq('clinica_id', clinicaId).eq('estado', 'pendiente').abortSignal(controller.signal),
        ])
        if (controller.signal.aborted) return
        if (agenda.error || equipo.error || pendientes.error) throw new Error('consulta')
        setDatos({ clave, citas: agenda.data || [], profesionales: equipo.data || [], pendientes: pendientes.count || 0 })
      } catch {
        if (!controller.signal.aborted) setError('No se pudo cargar la agenda. Intenta de nuevo.')
      } finally { if (!controller.signal.aborted) setCargando(false) }
    }
    cargar()
    return () => controller.abort()
  }, [clinicaId, desde, hasta, clave, refresco])

  useEffect(() => {
    if (!bandeja) return
    const controller = new AbortController()
    setSolicitudes(null); setErrorSolicitudes('')
    supabase.from('citas').select(COLUMNAS_AGENDA).eq('clinica_id', clinicaId).eq('estado', 'pendiente')
      .order('fecha_hora').order('id').range(pagina * 20, pagina * 20 + 19).abortSignal(controller.signal)
      .then(({ data, error: fallo }) => {
        if (controller.signal.aborted) return
        if (fallo) setErrorSolicitudes('No se pudieron cargar las solicitudes.')
        else if (pagina > 0 && !data?.length) setPagina(0)
        else setSolicitudes(data || [])
      }).catch(() => { if (!controller.signal.aborted) setErrorSolicitudes('No se pudieron cargar las solicitudes.') })
    return () => controller.abort()
  }, [bandeja, pagina, clinicaId, refresco])

  useEffect(() => {
    setPromo(null)
    if (!detalle?.promocion_id) return
    let vigente = true
    supabase.from('promociones').select('id,titulo,descuento_porcentaje').eq('clinica_id', clinicaId).eq('id', detalle.promocion_id).maybeSingle()
      .then(({ data }) => { if (vigente) setPromo(data) }).catch(() => {})
    return () => { vigente = false }
  }, [detalle?.promocion_id, clinicaId])

  const datosVigentes = datos.clave === clave
  const citas = datosVigentes ? datos.citas : []
  const profesionales = datos.clave.startsWith(`${clinicaId}:`) ? datos.profesionales : []
  const colores = coloresProfesionales(profesionales)
  const visibles = filtrarProfesional(citas, filtro)
  const pendientes = datos.clave.startsWith(`${clinicaId}:`) ? datos.pendientes : 0

  function crearEn(fecha, hora = '09:00') {
    setNueva({ fecha, hora, especialistaId: profesionales.some(p => p.id === filtro && p.activo) ? filtro : '' })
  }
  async function cambiarEstado(id, estado) {
    if (mutacion.current) return
    const cita = detalle
    if (!cita || cita.id !== id || !transicionExistente(cita.estado, estado)) return
    mutacion.current = true; setOcupada(true); setAviso('')
    try {
      const { data, error: fallo } = await supabase.from('citas').update({ estado }).eq('id', id).eq('clinica_id', clinicaId).eq('estado', cita.estado).select('id')
      if (fallo) { setAviso(mensajeErrorCita(fallo)); return }
      if (!data?.length) { setAviso('Otra persona actualizó esta cita o ya no tienes acceso. Vuelve a consultarla.'); setDetalle(null); setRefresco(n => n + 1); return }
      if (estado === 'completada') {
        const { data: abono } = await supabase.from('puntos_movimientos').select('puntos').eq('clinica_id', clinicaId).eq('origen_tipo', 'cita').eq('origen_id', id).maybeSingle()
        setAviso(abono ? `Cita completada · +${abono.puntos} puntos para el cliente.` : 'Cita completada.')
      } else setAviso(estado === 'confirmada' ? 'Cita confirmada.' : 'Cita cancelada.')
      setDetalle(null); setRefresco(n => n + 1)
    } catch { setAviso('No se pudo actualizar la cita. Revisa la conexión e intenta de nuevo.') }
    finally { mutacion.current = false; setOcupada(false) }
  }

  if (cliente) return <Cliente360 pacienteId={cliente} clinicaId={clinicaId} HistorialCliente={HistorialCliente} onVolver={() => setCliente(null)} />
  return <section className="calendario" aria-label="Calendario de citas">
    <header className="cal-cabecera adm-sobre-acero">
      <div className="cal-fila"><div><p className="cal-eyebrow">Agenda de la clínica</p><h2>Calendario</h2><p className="cal-subtitulo">Tu semana, en un vistazo.</p></div>
        <button type="button" className="cal-boton cal-nueva" onClick={() => crearEn(dia)}>+ Nueva cita</button></div>
      <div className="cal-navegacion">
        <button type="button" className="cal-boton" aria-label="Semana anterior" onClick={() => setDia(aIsoLocal(sumarDias(fechaLocal(dia), -7)))}>‹</button>
        <p>{fechaLocal(dias[0]).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })} — {fechaLocal(dias[6]).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <button type="button" className="cal-boton" aria-label="Semana siguiente" onClick={() => setDia(aIsoLocal(sumarDias(fechaLocal(dia), 7)))}>›</button>
      </div>
    </header>
    <div className="cal-herramientas"><span className="cal-semana-etiqueta">Vista semanal</span><button type="button" className="cal-boton" onClick={() => setDia(aIsoLocal(new Date()))}>Hoy</button>
      <label className="cal-fecha">Ir a fecha<input type="date" aria-label="Elegir fecha" value={dia} onChange={e => { if (e.target.value) setDia(e.target.value) }} /></label></div>
    <button type="button" className="cal-pendientes" onClick={() => { setPagina(0); setBandeja(true) }}><span><strong>{cargando ? '…' : pendientes}</strong> {pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}</span><span>Ver todas <span aria-hidden="true">↗</span></span></button>
    <p className="cal-alcance">Todas las fechas y profesionales. El filtro solo afecta a la agenda.</p>
    {aviso && !detalle && <p role="status" className="cal-aviso">{aviso}</p>}
    {error && <div role="alert" className="cal-aviso">{error} <button type="button" className="cal-boton" onClick={() => setRefresco(n => n + 1)}>Reintentar</button></div>}
    {cargando && <p role="status" className="cal-aviso">Cargando semana…</p>}
    {!error && <div aria-busy={cargando}><CalendarioSemanal dias={dias} dia={dia} onDia={setDia} citas={visibles} profesionales={profesionales} colores={colores} filtro={filtro} onFiltro={setFiltro} onCita={c => { setAviso(''); setDetalle(c) }} onHorario={crearEn} /></div>}
    {bandeja && <HojaCalendario titulo="Solicitudes pendientes" onCerrar={() => setBandeja(false)}>
      <p className="cal-nota">Todas las fechas y profesionales de esta clínica. Una solicitud sigue pendiente hasta que la confirmes.</p>
      {errorSolicitudes && <p role="alert">{errorSolicitudes}<button type="button" className="cal-boton" onClick={() => setRefresco(n => n + 1)}>Reintentar</button></p>}
      {!solicitudes && !errorSolicitudes && <p role="status">Cargando solicitudes…</p>}
      {solicitudes?.length === 0 && <p>No hay solicitudes pendientes.</p>}
      <ul className="cal-lista-solicitudes">{solicitudes?.map(c => <li key={c.id}><button type="button" className="cal-solicitud" onClick={() => { setBandeja(false); setAviso(''); setDia(aIsoLocal(new Date(c.fecha_hora))); setDetalle(c) }}>
        <strong>{c.pacientes?.nombre || 'Cliente'}</strong><span>{new Date(c.fecha_hora).toLocaleString('es-HN', { dateStyle: 'medium', timeStyle: 'short' })}</span><span>{c.especialistas?.nombre || 'Sin asignar'} · Pendiente</span>
      </button></li>)}</ul>
      <div className="cal-fila"><button type="button" className="cal-boton" disabled={!pagina} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina + 1}</span><button type="button" className="cal-boton" disabled={!solicitudes || solicitudes.length < 20} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div>
    </HojaCalendario>}
    {detalle && <HojaCalendario titulo="Detalle de la cita" onCerrar={() => { if (!ocupada) setDetalle(null) }}>
      <ul><TarjetaCita cita={detalle} promo={promo} onEstado={cambiarEstado} ocupada={ocupada} /></ul>
      <p className="cal-nota">{duracionCatalogo(detalle) ? `${duracionCatalogo(detalle)} min según el catálogo actual. La duración histórica no está registrada.` : 'Esta cita no tiene duración disponible.'}</p>
      {aviso && <p role="status" className="cal-aviso">{aviso}</p>}
      <button type="button" className="cal-boton cal-ancho" disabled={ocupada} onClick={() => { setCliente(detalle.paciente_id); setDetalle(null) }}>Consultar cliente</button>
    </HojaCalendario>}
    {nueva && <HojaCalendario titulo="Nueva cita" onCerrar={() => setNueva(null)}>
      <p className="cal-nota">{nombreDia(nueva.fecha)} · {nueva.hora}. Revisa el horario con el profesional: el calendario no garantiza disponibilidad.</p>
      <FormularioCita clinicaId={clinicaId} inicial={nueva} onCreada={() => { setDia(nueva.fecha); setNueva(null); setAviso('Cita creada.'); setRefresco(n => n + 1) }} />
    </HojaCalendario>}
  </section>
}
