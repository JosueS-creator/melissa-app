import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_HISTORIAL = [
  ['consulta', 'Consulta'],
  ['vacuna', 'Vacunación'],
  ['desparasitacion', 'Desparasitación'],
  ['tratamiento', 'Tratamiento'],
  ['cirugia', 'Cirugía'],
  ['otro', 'Otro'],
]

const VACIO = { nombre: '', especie: 'perro', raza: '', sexo: '', fecha_nacimiento: '', peso: '', microchip: '', observaciones: '' }

export default function Mascotas({ clinicaId, perfilId }) {
  const [mascotas, setMascotas] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [propietarioId, setPropietarioId] = useState('')
  const [form, setForm] = useState(VACIO)
  const [seleccionada, setSeleccionada] = useState(null)
  const [historial, setHistorial] = useState([])
  const [nuevo, setNuevo] = useState({ tipo: 'consulta', fecha: new Date().toISOString().slice(0, 10), motivo: '', notas: '', peso: '', proxima_fecha: '' })
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { cargarDatos() }, [clinicaId])

  async function cargarDatos() {
    setCargando(true)
    setError('')
    const [m, p] = await Promise.all([
      supabase.from('mascotas').select('*, pacientes(nombre, telefono)').eq('clinica_id', clinicaId).eq('activo', true).order('nombre'),
      supabase.from('pacientes').select('id,nombre,telefono').eq('clinica_id', clinicaId).order('nombre'),
    ])
    if (m.error || p.error) setError('No se pudieron cargar las mascotas. Verifica que la migración de Melissa Pets esté instalada.')
    setMascotas(m.data || [])
    setPropietarios(p.data || [])
    setCargando(false)
  }

  async function guardarMascota(e) {
    e.preventDefault()
    if (!propietarioId || !form.nombre.trim() || !form.especie || guardando) return
    setGuardando(true); setError(''); setMensaje('')
    const payload = {
      clinica_id: clinicaId,
      propietario_paciente_id: propietarioId,
      nombre: form.nombre.trim(),
      especie: form.especie,
      raza: form.raza.trim() || null,
      sexo: form.sexo || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      peso: form.peso === '' ? null : Number(form.peso),
      microchip: form.microchip.trim() || null,
      observaciones: form.observaciones.trim() || null,
    }
    const { error: eInsert } = await supabase.from('mascotas').insert(payload)
    if (eInsert) setError('No se pudo guardar la mascota: ' + eInsert.message)
    else {
      setForm(VACIO); setPropietarioId(''); setMostrarForm(false)
      setMensaje('Mascota registrada correctamente.')
      await cargarDatos()
    }
    setGuardando(false)
  }

  async function abrirHistorial(mascota) {
    setSeleccionada(mascota); setMostrarHistorial(true); setError('')
    const { data, error: eHistorial } = await supabase.from('historial_veterinario')
      .select('*').eq('clinica_id', clinicaId).eq('mascota_id', mascota.id)
      .order('fecha', { ascending: false })
    if (eHistorial) setError('No se pudo cargar el historial veterinario.')
    setHistorial(data || [])
  }

  async function guardarEntrada(e) {
    e.preventDefault()
    if (!seleccionada || !nuevo.motivo.trim() || guardando) return
    setGuardando(true); setError('')
    const { error: eInsert } = await supabase.from('historial_veterinario').insert({
      clinica_id: clinicaId,
      mascota_id: seleccionada.id,
      tipo: nuevo.tipo,
      fecha: nuevo.fecha,
      motivo: nuevo.motivo.trim(),
      notas: nuevo.notas.trim() || null,
      peso: nuevo.peso === '' ? null : Number(nuevo.peso),
      proxima_fecha: nuevo.proxima_fecha || null,
      creado_por: perfilId,
    })
    if (eInsert) setError('No se pudo guardar la consulta: ' + eInsert.message)
    else {
      setNuevo({ tipo: 'consulta', fecha: new Date().toISOString().slice(0, 10), motivo: '', notas: '', peso: '', proxima_fecha: '' })
      await abrirHistorial(seleccionada)
    }
    setGuardando(false)
  }

  async function desactivar(mascota) {
    if (!window.confirm(`¿Desactivar la ficha de ${mascota.nombre}? Su historial se conservará.`)) return
    const { error: eUpdate } = await supabase.from('mascotas').update({ activo: false }).eq('id', mascota.id).eq('clinica_id', clinicaId)
    if (eUpdate) setError('No se pudo desactivar la ficha.')
    else { if (seleccionada?.id === mascota.id) setMostrarHistorial(false); await cargarDatos() }
  }

  if (cargando) return <p className="text-sm text-ink/50">Cargando mascotas...</p>

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl p-3 text-sm bg-red-50 text-red-700">{error}</p>}
      {mensaje && <p role="status" className="rounded-xl p-3 text-sm bg-emerald-50 text-emerald-800">{mensaje}</p>}
      <button onClick={() => { setMostrarForm(v => !v); setMostrarHistorial(false) }} className="w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--gradiente-primario)' }}>
        {mostrarForm ? 'Cancelar' : '+ Registrar mascota'}
      </button>

      {mostrarForm && <form onSubmit={guardarMascota} className="rounded-2xl border border-ink/10 p-4 space-y-3 bg-white">
        <h3 className="font-semibold text-sm">Nueva ficha de mascota</h3>
        <label className="block text-xs text-ink/60">Propietario
          <select className="mt-1 w-full rounded-lg border p-3 text-sm bg-white" value={propietarioId} onChange={e => setPropietarioId(e.target.value)} required>
            <option value="">Selecciona al propietario</option>
            {propietarios.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.telefono ? ` · ${p.telefono}` : ''}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-ink/60">Nombre<input className="mt-1 w-full rounded-lg border p-3 text-sm" value={form.nombre} onChange={e => setForm(v => ({...v, nombre:e.target.value}))} required /></label>
          <label className="text-xs text-ink/60">Especie<select className="mt-1 w-full rounded-lg border p-3 text-sm bg-white" value={form.especie} onChange={e => setForm(v => ({...v, especie:e.target.value}))}><option value="perro">Perro</option><option value="gato">Gato</option><option value="ave">Ave</option><option value="conejo">Conejo</option><option value="reptil">Reptil</option><option value="otro">Otro</option></select></label>
          <label className="text-xs text-ink/60">Raza<input className="mt-1 w-full rounded-lg border p-3 text-sm" value={form.raza} onChange={e => setForm(v => ({...v, raza:e.target.value}))} /></label>
          <label className="text-xs text-ink/60">Sexo<select className="mt-1 w-full rounded-lg border p-3 text-sm bg-white" value={form.sexo} onChange={e => setForm(v => ({...v, sexo:e.target.value}))}><option value="">No especificado</option><option value="macho">Macho</option><option value="hembra">Hembra</option></select></label>
          <label className="text-xs text-ink/60">Nacimiento<input type="date" className="mt-1 w-full rounded-lg border p-3 text-sm" value={form.fecha_nacimiento} onChange={e => setForm(v => ({...v, fecha_nacimiento:e.target.value}))} /></label>
          <label className="text-xs text-ink/60">Peso (kg)<input type="number" min="0" max="500" step="0.01" className="mt-1 w-full rounded-lg border p-3 text-sm" value={form.peso} onChange={e => setForm(v => ({...v, peso:e.target.value}))} /></label>
        </div>
        <label className="block text-xs text-ink/60">Microchip (opcional)<input className="mt-1 w-full rounded-lg border p-3 text-sm" value={form.microchip} onChange={e => setForm(v => ({...v, microchip:e.target.value}))} /></label>
        <label className="block text-xs text-ink/60">Observaciones iniciales<textarea rows="2" className="mt-1 w-full rounded-lg border p-3 text-sm" value={form.observaciones} onChange={e => setForm(v => ({...v, observaciones:e.target.value}))} /></label>
        <button disabled={guardando || !propietarios.length} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{background:'var(--gradiente-primario)'}}>{guardando ? 'Guardando...' : 'Guardar ficha'}</button>
        {!propietarios.length && <p className="text-xs text-amber-700">Primero registra al propietario en Clientes.</p>}
      </form>}

      {mostrarHistorial && seleccionada && <section className="rounded-2xl border border-ink/10 bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs text-ink/50">Expediente veterinario</p><h3 className="font-semibold">{seleccionada.nombre}</h3><p className="text-xs text-ink/60">{seleccionada.especie} · {seleccionada.raza || 'Raza no especificada'} · Tutor: {seleccionada.pacientes?.nombre}</p></div>
          <button onClick={() => setMostrarHistorial(false)} className="text-xs underline">Cerrar</button>
        </div>
        <form onSubmit={guardarEntrada} className="rounded-xl p-3 space-y-2" style={{background:'var(--color-accent)'}}>
          <p className="text-sm font-semibold">Registrar atención</p>
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-lg border p-2 text-sm bg-white" value={nuevo.tipo} onChange={e => setNuevo(v => ({...v,tipo:e.target.value}))}>{TIPOS_HISTORIAL.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
            <input type="date" className="rounded-lg border p-2 text-sm bg-white" value={nuevo.fecha} onChange={e => setNuevo(v => ({...v,fecha:e.target.value}))} required />
          </div>
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Motivo o diagnóstico registrado" value={nuevo.motivo} onChange={e => setNuevo(v => ({...v,motivo:e.target.value}))} required />
          <textarea rows="3" className="w-full rounded-lg border p-2 text-sm" placeholder="Notas, evolución, indicaciones o tratamiento" value={nuevo.notas} onChange={e => setNuevo(v => ({...v,notas:e.target.value}))} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" max="500" step="0.01" className="rounded-lg border p-2 text-sm" placeholder="Peso (kg)" value={nuevo.peso} onChange={e => setNuevo(v => ({...v,peso:e.target.value}))} />
            <input type="date" className="rounded-lg border p-2 text-sm" aria-label="Próximo control" value={nuevo.proxima_fecha} onChange={e => setNuevo(v => ({...v,proxima_fecha:e.target.value}))} />
          </div>
          <button disabled={guardando} className="w-full rounded-lg py-2.5 text-sm text-white disabled:opacity-50" style={{background:'var(--gradiente-primario)'}}>{guardando ? 'Guardando...' : 'Guardar en historial'}</button>
        </form>
        <div className="space-y-2">
          {historial.length === 0 && <p className="text-sm text-ink/50">Todavía no hay atenciones registradas.</p>}
          {historial.map(h => <article key={h.id} className="rounded-xl border border-ink/10 p-3">
            <div className="flex justify-between gap-2"><span className="text-xs font-semibold">{TIPOS_HISTORIAL.find(([v])=>v===h.tipo)?.[1] || h.tipo}</span><time className="text-xs text-ink/50">{h.fecha}</time></div>
            <p className="text-sm font-medium mt-1">{h.motivo}</p>
            {h.notas && <p className="text-xs text-ink/70 mt-1 whitespace-pre-wrap">{h.notas}</p>}
            <div className="flex gap-3 mt-2 text-xs text-ink/50">{h.peso != null && <span>{h.peso} kg</span>}{h.proxima_fecha && <span>Próximo control: {h.proxima_fecha}</span>}</div>
          </article>)}
        </div>
      </section>}

      {!mostrarHistorial && <div className="space-y-2">
        {mascotas.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center"><p className="text-sm font-medium">Todavía no hay mascotas registradas</p><p className="text-xs text-ink/50 mt-1">Registra una mascota para iniciar su expediente veterinario.</p></div>}
        {mascotas.map(m => <article key={m.id} className="rounded-2xl border border-ink/10 bg-white p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl" style={{background:'var(--color-accent)'}}>🐾</div>
          <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{m.nombre}</p><p className="text-xs text-ink/50">{m.especie}{m.raza ? ` · ${m.raza}` : ''}</p><p className="text-xs text-ink/50 truncate">Tutor: {m.pacientes?.nombre || 'Sin nombre'}</p></div>
          <button onClick={() => abrirHistorial(m)} className="text-xs font-semibold px-3 py-2 rounded-lg" style={{background:'var(--color-accent)'}}>Expediente</button>
          <button onClick={() => desactivar(m)} aria-label={`Desactivar ${m.nombre}`} className="text-xs text-ink/40 px-1">•••</button>
        </article>)}
      </div>}
    </div>
  )
}
