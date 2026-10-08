import { useEffect, useState } from 'react'
import { registrarPaciente } from '../lib/auth'
import { detectarPaisPorIP, PAISES } from '../lib/geolocalizacion'
import CampoContrasena from '../components/CampoContrasena'

export default function Registro({ onRegistroExitoso, irALogin, slugClinica, negocioNoEncontrado }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pais, setPais] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [detectandoPais, setDetectandoPais] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState('')

  useEffect(() => {
    detectarPaisPorIP().then((codigo) => {
      if (codigo && PAISES.some((p) => p.codigo === codigo)) {
        setPais(codigo)
      }
      setDetectandoPais(false)
    })
  }, [])

  async function manejarSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const resultado = await registrarPaciente({ email, password, nombre, telefono, pais, slugClinica, fechaNacimiento })
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

  if (!slugClinica || negocioNoEncontrado) {
    return (
      <div className="sm:max-w-app mx-auto min-h-screen px-6 pt-16 font-body text-center">
        <p className="font-display text-xl text-ink mb-2">
          {negocioNoEncontrado ? 'No encontramos ese negocio' : 'Necesitas el link de tu negocio'}
        </p>
        <p className="text-sm text-ink/60 mb-6">
          {negocioNoEncontrado
            ? 'Revisa que el link o el QR esté completo, o pídeselo de nuevo a tu negocio.'
            : 'Para crear tu cuenta, abre el link o escanea el QR que te compartió tu negocio.'}
        </p>
        <button onClick={irALogin} className="text-sm" style={{ color: 'var(--color-primary)' }}>Volver a iniciar sesión</button>
      </div>
    )
  }

  return (
    <div className="sm:max-w-app mx-auto min-h-screen px-6 pt-16 font-body">
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
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
          <input
            className="border border-ink/15 rounded-xl px-4 py-3 text-sm"
            placeholder="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <CampoContrasena value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink/50 px-1">Fecha de nacimiento (opcional)</span>
            <input
              className="border border-ink/15 rounded-xl px-4 py-3 text-sm bg-white"
              type="date"
              value={fechaNacimiento}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />
          </label>

          <select
            className="border border-ink/15 rounded-xl px-4 py-3 text-sm bg-white"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            required
          >
            <option value="" disabled>
              {detectandoPais ? 'Detectando tu país...' : 'Selecciona tu país'}
            </option>
            {PAISES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="rounded-xl py-3 text-white text-sm font-medium mt-2 disabled:opacity-60"
            style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
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
