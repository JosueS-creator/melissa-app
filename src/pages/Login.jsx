import { useState } from 'react'
import { iniciarSesion } from '../lib/auth'

export default function Login({ onLoginExitoso, irARegistro, modo = 'paciente', onVolver }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await iniciarSesion({ email, password })
      onLoginExitoso()
    } catch (err) {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body">
      {onVolver && (
        <button onClick={onVolver} className="text-xs mb-4" style={{ color: 'var(--color-primary)' }}>‹ Volver</button>
      )}
      <p className="font-display text-2xl text-ink mb-1">
        {modo === 'clinica' ? 'Acceso administrativo' : 'Bienvenida de vuelta'}
      </p>
      <p className="text-sm text-ink/60 mb-6">
        {modo === 'clinica'
          ? 'Inicia sesión con la cuenta de tu negocio.'
          : 'Inicia sesión para continuar tu rutina.'}
      </p>

      <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
        <input
          className="border border-ink/15 rounded-xl px-4 py-3 text-sm"
          placeholder="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border border-ink/15 rounded-xl px-4 py-3 text-sm"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="rounded-xl py-3 text-white text-sm font-medium mt-2 disabled:opacity-60"
          style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
        >
          {cargando ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>

      {modo === 'paciente' ? (
        <p className="text-sm text-ink/60 mt-6 text-center">
          ¿No tienes cuenta?{' '}
          <button onClick={irARegistro} className="font-medium" style={{ color: 'var(--color-primary)' }}>
            Regístrate
          </button>
        </p>
      ) : (
        <p className="text-sm text-ink/60 mt-6 text-center">
          ¿Tu negocio aún no tiene cuenta?{' '}
          <a
            href="https://wa.me/50499990000"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium"
            style={{ color: 'var(--color-primary)' }}
          >
            Contáctanos
          </a>
        </p>
      )}
    </div>
  )
}
