import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RegistroAdmin({ codigo, onRegistroExitoso }) {
  const [clinica, setClinica] = useState(null)
  const [validando, setValidando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState('')

  useEffect(() => {
    supabase.rpc('validar_invitacion_admin', { p_codigo: codigo }).then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        setClinica(data[0])
      }
      setValidando(false)
    })
  }, [codigo])

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { data: authData, error: errorAuth } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, telefono, invitacion_codigo: codigo },
      },
    })

    if (errorAuth) {
      setError(errorAuth.message)
      setCargando(false)
      return
    }

    if (!authData.session) {
      setMensajeConfirmacion('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.')
    } else {
      onRegistroExitoso()
    }
    setCargando(false)
  }

  if (validando) {
    return <p className="text-center pt-16 text-sm" style={{ color: 'var(--color-texto-secundario)' }}>Verificando invitación...</p>
  }

  if (!clinica) {
    return (
      <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body text-center">
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-ink)' }}>Invitación no válida</p>
        <p className="text-sm mt-2" style={{ color: 'var(--color-texto-secundario)' }}>
          Este link ya se usó o no existe. Pide uno nuevo.
        </p>
      </div>
    )
  }

  if (mensajeConfirmacion) {
    return (
      <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body text-center">
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-ink)' }}>Casi listo</p>
        <p className="text-sm mt-2" style={{ color: 'var(--color-texto-secundario)' }}>{mensajeConfirmacion}</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-6 pt-16 font-body">
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-ink)' }}>
        Bienvenido a Melissa
      </p>
      <p className="text-sm mt-1 mb-6" style={{ color: 'var(--color-texto-secundario)' }}>
        Estás creando la cuenta de administrador de <strong>{clinica.clinica_nombre}</strong>.
      </p>

      <form onSubmit={manejarSubmit} className="flex flex-col gap-3">
        <input
          className="border rounded-xl px-4 py-3 text-sm"
          style={{ borderColor: 'var(--color-borde-tarjeta)' }}
          placeholder="Tu nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-4 py-3 text-sm"
          style={{ borderColor: 'var(--color-borde-tarjeta)' }}
          placeholder="Teléfono"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-4 py-3 text-sm"
          style={{ borderColor: 'var(--color-borde-tarjeta)' }}
          placeholder="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-4 py-3 text-sm"
          style={{ borderColor: 'var(--color-borde-tarjeta)' }}
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
          style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
        >
          {cargando ? 'Creando cuenta...' : 'Crear cuenta de administrador'}
        </button>
      </form>
    </div>
  )
}
