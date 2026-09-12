import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import CampoContrasena from '../components/CampoContrasena'

export default function RestablecerPassword({ onListo }) {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    const { error: errorUpdate } = await supabase.auth.updateUser({ password })

    if (errorUpdate) {
      setError('No se pudo cambiar la contraseña. Intenta de nuevo.')
      setCargando(false)
    } else {
      onListo()
    }
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body">
      <p className="font-display text-2xl text-ink mb-1">Crea tu nueva contraseña</p>
      <p className="text-sm text-ink/60 mb-6">Escríbela dos veces para confirmar.</p>

      <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
        <CampoContrasena value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" required minLength={6} />
        <CampoContrasena value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Confirma la nueva contraseña" required minLength={6} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="rounded-xl py-3 text-white text-sm font-medium mt-2 disabled:opacity-60"
          style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
        >
          {cargando ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </div>
  )
}
