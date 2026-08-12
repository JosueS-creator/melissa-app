import { useState } from 'react'
import { registrarPaciente } from '../lib/auth'

export default function Registro({ onRegistroExitoso, irALogin }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState('')

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const resultado = await registrarPaciente({ email, password, nombre, telefono })
      if (resultado.requiereConfirmacion) {
        setMensajeConfirmacion('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.')
      } else {
        onRegistroExitoso()
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error al registrarte.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body">
      <p className="font-display text-2xl text-ink mb-1">Crea tu cuenta</p>
      <p className="text-sm text-ink/60 mb-6">Únete y empieza a construir tu Beauty Score.</p>

      {mensajeConfirmacion ? (
        <p className="text-sm text-ink bg-accent rounded-xl p-4">{mensajeConfirmacion}</p>
      ) : (
        <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
          <input
            className="border border-ink/15 rounded-xl px-4 py-3 text-sm"
            placeholder="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <input
            className="border border-ink/15 rounded-xl px-4 py-3 text-sm"
            placeholder="Teléfono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
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
            minLength={6}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="rounded-xl py-3 text-white text-sm font-medium mt-2 disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}
          >
            {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
      )}

      <p className="text-sm text-ink/60 mt-6 text-center">
        ¿Ya tienes cuenta?{' '}
        <button onClick={irALogin} className="font-medium" style={{ color: 'var(--color-primary)' }}>
          Inicia sesión
        </button>
      </p>
    </div>
  )
}
