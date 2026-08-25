import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

export default function Historial({ onVolver }) {
  const [paciente, setPaciente] = useState(null)
  const [tratamientos, setTratamientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const inputAntesRef = useRef(null)
  const inputDespuesRef = useRef(null)

  useEffect(() => {
    cargarTodo()
  }, [])

  async function cargarTodo() {
    const p = await obtenerPacienteActual()
    setPaciente(p)
    if (!p) {
      setCargando(false)
      return
    }
    const { data } = await supabase
      .from('tratamientos_paciente')
      .select('*')
      .eq('paciente_id', p.id)
      .order('fecha', { ascending: false })
    setTratamientos(data || [])
    setCargando(false)
  }

  async function subirNuevoRegistro(e) {
    const archivoAntes = inputAntesRef.current?.files?.[0]
    const archivoDespues = inputDespuesRef.current?.files?.[0]
    if (!archivoAntes && !archivoDespues) return
    if (!paciente) return
    setSubiendo(true)
    setMensaje('')

    async function subir(file, sufijo) {
      if (!file) return null
      const extension = file.name.split('.').pop()
      const ruta = `${paciente.clinica_id}/${paciente.id}/${Date.now()}-${sufijo}.${extension}`
      const { error } = await supabase.storage.from('fotos-tratamientos').upload(ruta, file)
      return error ? null : ruta
    }

    const [rutaAntes, rutaDespues] = await Promise.all([
      subir(archivoAntes, 'antes'),
      subir(archivoDespues, 'despues'),
    ])

    const { error: errorInsert } = await supabase.from('tratamientos_paciente').insert({
      clinica_id: paciente.clinica_id,
      paciente_id: paciente.id,
      procedimiento: 'Registro de progreso',
      foto_antes_url: rutaAntes,
      foto_despues_url: rutaDespues,
    })

    if (errorInsert) {
      setMensaje('No se pudo guardar el registro: ' + errorInsert.message)
    } else {
      setMensaje('Registro agregado ✓')
      if (inputAntesRef.current) inputAntesRef.current.value = ''
      if (inputDespuesRef.current) inputDespuesRef.current.value = ''
      cargarTodo()
    }
    setSubiendo(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando historial...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tu historial.</p>

  const totalInvertido = tratamientos.reduce((sum, t) => sum + Number(t.precio || 0), 0)

  return (
    <div className="min-h-screen font-body pb-10" style={{ background: 'var(--color-fondo-app)' }}>
      <div
        className="px-5 pb-5"
        style={{ background: 'var(--gradiente-fondo-oscuro)', paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
      >
        {onVolver && (
          <button onClick={onVolver} className="text-xs mb-3" style={{ color: 'var(--color-dorado-claro)' }}>‹ Volver</button>
        )}
        <p style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-dorado-claro)' }}>
          Historial clínico
        </p>
        <p className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: '#FFFFFF' }}>
          {tratamientos.length} {tratamientos.length === 1 ? 'registro' : 'registros'}
        </p>
        {totalInvertido > 0 && (
          <p className="text-xs mt-1" style={{ color: 'rgba(233,169,193,0.85)' }}>L {totalInvertido.toLocaleString()} invertidos</p>
        )}
      </div>

      <div className="px-5 pt-5">
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Agregar foto de progreso</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="rounded-xl border border-dashed flex flex-col items-center justify-center py-4 text-center cursor-pointer" style={{ borderColor: 'var(--color-borde-tarjeta)', background: '#FDEFF4' }}>
            <span className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>Antes</span>
            <input ref={inputAntesRef} type="file" accept="image/*" capture="environment" className="hidden" />
          </label>
          <label className="rounded-xl border border-dashed flex flex-col items-center justify-center py-4 text-center cursor-pointer" style={{ borderColor: 'var(--color-borde-tarjeta)', background: '#FDEFF4' }}>
            <span className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>Después</span>
            <input ref={inputDespuesRef} type="file" accept="image/*" capture="environment" className="hidden" />
          </label>
        </div>
        <button
          onClick={subirNuevoRegistro}
          disabled={subiendo}
          className="w-full rounded-[10px] py-2.5 text-white shadow-boton-primario disabled:opacity-50 mb-2"
          style={{ background: 'var(--gradiente-primario)', font: "500 12px/1 var(--font-body)" }}
        >
          {subiendo ? 'Subiendo...' : 'Guardar registro'}
        </button>
        {mensaje && <p className="text-center text-xs mb-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}

        {tratamientos.length === 0 && (
          <p className="text-sm text-center mt-8" style={{ color: 'var(--color-texto-secundario)' }}>
            Todavía no tienes tratamientos ni fotos registradas.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {tratamientos.map((t, i) => (
            <FilaTratamiento key={t.id} tratamiento={t} esUltimo={i === tratamientos.length - 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FilaTratamiento({ tratamiento, esUltimo }) {
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
    <div className="relative pl-4" style={{ borderLeft: esUltimo ? 'none' : '1.5px solid var(--color-borde-tarjeta)' }}>
      <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full" style={{ background: 'var(--color-primary)' }} />
      <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-texto-terciario)' }}>{fecha}</p>
      <div className="rounded-2xl p-3 bg-white border" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
        {(tratamiento.foto_antes_url || tratamiento.foto_despues_url) && (
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{ background: '#FDEFF4', height: 84 }}>
              {urlAntes ? <img src={urlAntes} alt="Antes" className="w-full h-full object-cover" /> : <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Antes</span>}
            </div>
            <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{ background: '#FDEFF4', height: 84 }}>
              {urlDespues ? <img src={urlDespues} alt="Después" className="w-full h-full object-cover" /> : <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Después</span>}
            </div>
          </div>
        )}
        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{tratamiento.procedimiento}</p>
        {tratamiento.recomendaciones && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-texto-secundario)' }}>{tratamiento.recomendaciones}</p>
        )}
      </div>
    </div>
  )
}
