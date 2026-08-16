import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

export default function Historial() {
  const [paciente, setPaciente] = useState(null)
  const [tratamientos, setTratamientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const inputFileRef = useRef(null)

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

  async function subirFotoProgreso(e) {
    const file = e.target.files?.[0]
    if (!file || !paciente) return
    setSubiendo(true)
    setMensaje('')

    const extension = file.name.split('.').pop()
    const ruta = `${paciente.clinica_id}/${paciente.id}/${Date.now()}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('fotos-tratamientos')
      .upload(ruta, file)

    if (errorSubida) {
      setMensaje('No se pudo subir la foto: ' + errorSubida.message)
      setSubiendo(false)
      return
    }

    const { error: errorInsert } = await supabase.from('tratamientos_paciente').insert({
      clinica_id: paciente.clinica_id,
      paciente_id: paciente.id,
      procedimiento: 'Foto de seguimiento',
      foto_url: ruta,
    })

    if (errorInsert) {
      setMensaje('Foto subida, pero no se pudo registrar: ' + errorInsert.message)
    } else {
      setMensaje('Foto de progreso agregada ✓')
      cargarTodo()
    }
    setSubiendo(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando historial...</p>
  if (!paciente) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para ver tu historial.</p>

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 pb-10 font-body">
      <p className="font-display text-xl text-ink mb-1">Mi historial</p>
      <p className="text-xs text-ink/50 mb-5">Tus tratamientos y evolución fotográfica.</p>

      <input
        ref={inputFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={subirFotoProgreso}
        className="hidden"
      />
      <button
        onClick={() => inputFileRef.current?.click()}
        disabled={subiendo}
        className="w-full rounded-xl py-3 text-white text-sm font-medium mb-2 disabled:opacity-50"
        style={{ background: 'var(--color-primary)' }}
      >
        {subiendo ? 'Subiendo...' : 'Agregar foto de progreso'}
      </button>
      {mensaje && <p className="text-center text-xs mb-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}

      {tratamientos.length === 0 && (
        <p className="text-sm text-ink/50 text-center mt-10">
          Todavía no tienes tratamientos ni fotos registradas.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {tratamientos.map((t) => (
          <TarjetaTratamiento key={t.id} tratamiento={t} />
        ))}
      </div>
    </div>
  )
}

function TarjetaTratamiento({ tratamiento }) {
  const [urlFoto, setUrlFoto] = useState(null)

  useEffect(() => {
    if (!tratamiento.foto_url) return
    supabase.storage
      .from('fotos-tratamientos')
      .createSignedUrl(tratamiento.foto_url, 60 * 60)
      .then(({ data }) => {
        if (data) setUrlFoto(data.signedUrl)
      })
  }, [tratamiento.foto_url])

  const fecha = new Date(tratamiento.fecha).toLocaleDateString('es-HN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="rounded-xl p-3 flex gap-3" style={{ background: 'var(--color-accent)' }}>
      <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-white overflow-hidden flex items-center justify-center">
        {urlFoto ? (
          <img src={urlFoto} alt="Progreso" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] text-ink/30">Sin foto</span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-ink">{tratamiento.procedimiento}</p>
        <p className="text-[11px] text-ink/50 mt-0.5">{fecha}</p>
        {tratamiento.recomendaciones && (
          <p className="text-[11px] text-ink/60 mt-1">{tratamiento.recomendaciones}</p>
        )}
      </div>
    </div>
  )
}
