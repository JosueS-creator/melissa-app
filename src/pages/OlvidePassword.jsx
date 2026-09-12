import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function OlvidePassword({ onVolver }) {
  const [email, setEmail] = useState('')
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { error: errorReset } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    if (errorReset) {
      setError('No se pudo enviar el correo. Verifica que el correo sea correcto.')
    } else {
      setEnviado(true)
    }
    setCargando(false)
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body">
      <button onClick={onVolver} className="text-xs mb-4" style={{ color: 'var(--color-primary)' }}>‹ Volver</button>

      {enviado ? (
        <>
          <p className="font-display text-2xl text-ink mb-2">Revisa tu correo</p>
          <p className="text-sm text-ink/60">
            Te mandamos un link a <strong>{email}</strong> para que puedas crear una contraseña nueva.
            Si no lo ves en unos minutos, revisa también la carpeta de spam.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-ink mb-1">¿Olvidaste tu contraseña?</p>
          <p className="text-sm text-ink/60 mb-6">Escribe tu correo y te mandamos un link para crear una nueva.</p>

          <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
            <input
              className="border border-ink/15 rounded-xl px-4 py-3 text-sm"
              placeholder="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="rounded-xl py-3 text-white text-sm font-medium mt-2 disabled:opacity-60"
              style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
            >
              {cargando ? 'Enviando...' : 'Enviar link de recuperación'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
