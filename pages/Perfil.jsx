import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPerfilActual, obtenerPacienteActual } from '../lib/auth'

export default function Perfil() {
  const [perfil, setPerfil] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function cargar() {
      const [p, pac] = await Promise.all([obtenerPerfilActual(), obtenerPacienteActual()])
      setPerfil(p)
      setPaciente(pac)
      setNombre(p?.nombre || '')
      setTelefono(p?.telefono || '')
      setCargando(false)
    }
    cargar()
  }, [])

  async function guardar(e) {
    e.preventDefault()
    if (!perfil) return
    setGuardando(true)
    setMensaje('')

    const { error: errorPerfil } = await supabase
      .from('perfiles')
      .update({ nombre: nombre.trim(), telefono: telefono.trim() })
      .eq('id', perfil.id)

    let errorPaciente = null
    if (paciente) {
      const resultado = await supabase
        .from('pacientes')
        .update({ nombre: nombre.trim(), telefono: telefono.trim() })
        .eq('id', paciente.id)
      errorPaciente = resultado.error
    }

    if (errorPerfil || errorPaciente) {
      setMensaje('No se pudo guardar. Intenta de nuevo.')
    } else {
      setMensaje('Cambios guardados ✓')
    }
    setGuardando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!perfil) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para continuar.</p>

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 pb-10 font-body">
      <p className="font-display text-xl text-ink mb-1">Mi perfil</p>
      <p className="text-xs text-ink/50 mb-6">Mantén tus datos actualizados.</p>

      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <label className="text-[11px] text-ink/50 block mb-1">Nombre completo</label>
          <input
            className="w-full border border-ink/15 rounded-xl px-4 py-3 text-sm"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-[11px] text-ink/50 block mb-1">Teléfono</label>
          <input
            className="w-full border border-ink/15 rounded-xl px-4 py-3 text-sm"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl py-3 text-white text-sm font-medium mt-2 disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {mensaje && <p className="text-center text-xs mt-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
    </div>
  )
}
