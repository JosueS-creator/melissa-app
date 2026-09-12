import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPerfilActual, obtenerPacienteActual } from '../lib/auth'
import { calcularNivelYProgreso } from '../lib/fidelidad'

const PAISES_APP = [
  { codigo: 'HN', nombre: 'Honduras', moneda: 'Lempira · HNL' },
  { codigo: 'ES', nombre: 'España', moneda: 'Euro · EUR' },
]

export default function Perfil({ onNavigate, onCerrarSesion, esSuperAdmin }) {
  const [perfil, setPerfil] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [pais, setPais] = useState('HN')
  const [puntos, setPuntos] = useState(0)
  const [preferencias, setPreferencias] = useState({
    recordatorios_citas: true,
    promociones_ofertas: true,
    compartir_fotos_progreso: false,
  })
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
      setPais(p?.pais && PAISES_APP.some((x) => x.codigo === p.pais) ? p.pais : 'HN')
      setPreferencias({
        recordatorios_citas: p?.recordatorios_citas ?? true,
        promociones_ofertas: p?.promociones_ofertas ?? true,
        compartir_fotos_progreso: p?.compartir_fotos_progreso ?? false,
      })
      if (pac) {
        const { data: movimientos } = await supabase.from('puntos_movimientos').select('puntos').eq('paciente_id', pac.id)
        setPuntos((movimientos || []).reduce((sum, m) => sum + m.puntos, 0))
      }
      setCargando(false)
    }
    cargar()
  }, [])

  async function guardarCampo(cambios) {
    if (!perfil) return
    setGuardando(true)
    setMensaje('')
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', perfil.id)
    if (!error) {
      setPerfil((p) => ({ ...p, ...cambios }))
      setMensaje('Cambios guardados ✓')
    } else {
      setMensaje('No se pudo guardar. Intenta de nuevo.')
    }
    setGuardando(false)
  }

  async function guardarDatos(e) {
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
      const resultado = await supabase.from('pacientes').update({ nombre: nombre.trim(), telefono: telefono.trim() }).eq('id', paciente.id)
      errorPaciente = resultado.error
    }

    setMensaje(errorPerfil || errorPaciente ? 'No se pudo guardar. Intenta de nuevo.' : 'Cambios guardados ✓')
    setGuardando(false)
  }

  function togglePreferencia(clave) {
    const nuevoValor = !preferencias[clave]
    setPreferencias((p) => ({ ...p, [clave]: nuevoValor }))
    guardarCampo({ [clave]: nuevoValor })
  }

  function elegirPais(codigo) {
    setPais(codigo)
    guardarCampo({ pais: codigo })
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!perfil) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para continuar.</p>

  const { nivelActual } = calcularNivelYProgreso(puntos)

  return (
    <div
      className="font-body px-5 pb-10"
      style={{ background: 'var(--color-fondo-app)', paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--gradiente-dorado)', padding: 2 }}>
          <div className="w-full h-full rounded-full" style={{ background: 'var(--color-accent)' }} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-ink)' }}>{nombre || 'Sin nombre'}</p>
          <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>{paciente?.telefono ? '' : ''}</p>
          <span
            className="inline-block mt-1 px-2 py-0.5 rounded-sm"
            style={{ background: 'var(--gradiente-dorado)', color: 'var(--color-ink)', font: "500 9px/1 var(--font-body)", letterSpacing: '0.14em', textTransform: 'uppercase' }}
          >
            Nivel {nivelActual.nombre}
          </span>
        </div>
      </div>

      <form onSubmit={guardarDatos} className="flex flex-col gap-3 mb-6">
        <div>
          <label className="text-[11px] block mb-1" style={{ color: 'var(--color-texto-terciario)' }}>Nombre completo</label>
          <input
            className="w-full rounded-xl px-4 py-3 text-sm bg-white"
            style={{ border: '1px solid var(--color-borde-tarjeta)' }}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-[11px] block mb-1" style={{ color: 'var(--color-texto-terciario)' }}>Teléfono</label>
          <input
            className="w-full rounded-xl px-4 py-3 text-sm bg-white"
            style={{ border: '1px solid var(--color-borde-tarjeta)' }}
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-[10px] py-3 text-white mt-1 disabled:opacity-60 shadow-boton-primario"
          style={{ background: 'var(--gradiente-primario)', font: "500 13px/1 var(--font-body)" }}
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {mensaje && <p className="text-center text-xs" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
      </form>

      <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-terciario)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        País y moneda
      </p>
      <div className="flex gap-2 mb-6">
        {PAISES_APP.map((p) => {
          const activo = pais === p.codigo
          return (
            <button
              key={p.codigo}
              onClick={() => elegirPais(p.codigo)}
              className="flex-1 rounded-xl px-3.5 py-3 text-left"
              style={
                activo
                  ? { background: 'var(--gradiente-primario)', color: '#FFFFFF', boxShadow: '0 3px 8px rgba(201,59,121,0.3)' }
                  : { background: '#FFFFFF', border: '1px solid var(--color-borde-tarjeta)', color: 'var(--color-ink)' }
              }
            >
              <p className="text-[10px] font-medium">{p.codigo}</p>
              <p className="text-sm font-medium mt-0.5">{p.nombre}</p>
              <p className="text-[11px] mt-0.5" style={{ opacity: 0.85 }}>{p.moneda}</p>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-terciario)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Preferencias
      </p>
      <div className="flex flex-col gap-2 mb-6">
        <FilaToggle etiqueta="Recordatorios de cita" valor={preferencias.recordatorios_citas} onChange={() => togglePreferencia('recordatorios_citas')} />
        <FilaToggle etiqueta="Promociones y ofertas" valor={preferencias.promociones_ofertas} onChange={() => togglePreferencia('promociones_ofertas')} />
        <FilaToggle etiqueta="Compartir fotos de progreso" valor={preferencias.compartir_fotos_progreso} onChange={() => togglePreferencia('compartir_fotos_progreso')} />
      </div>

      <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-terciario)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Mi actividad
      </p>
      <div className="flex flex-col gap-2 mb-6">
        <FilaNavegacion etiqueta="Mi historial" onClick={() => onNavigate?.('historial')} />
        <FilaNavegacion etiqueta="Referidos" onClick={() => onNavigate?.('referidos')} />
        {esSuperAdmin && <FilaNavegacion etiqueta="Panel de Melissa" onClick={() => onNavigate?.('melissa')} />}
      </div>

      <p className="text-[11px] mb-2" style={{ color: 'var(--color-texto-terciario)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Cuenta
      </p>
      <div className="flex flex-col gap-2">
        <FilaNavegacion etiqueta="Datos personales" proximamente />
        <FilaNavegacion etiqueta="Métodos de pago" proximamente />
        <FilaNavegacion etiqueta="Consentimientos firmados" proximamente />
      </div>

      <button
        onClick={() => onCerrarSesion?.()}
        className="w-full text-center text-sm mt-8"
        style={{ color: 'var(--color-primary)' }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}

function FilaNavegacion({ etiqueta, onClick, proximamente }) {
  return (
    <button
      onClick={proximamente ? undefined : onClick}
      className="w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-sm"
      style={{
        background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)',
        border: '1px solid var(--color-borde-tarjeta)',
        color: proximamente ? 'var(--color-texto-terciario)' : 'var(--color-ink)',
      }}
    >
      <span>{etiqueta}{proximamente && <span className="text-[10px] ml-2">(próximamente)</span>}</span>
      <span style={{ color: 'var(--color-dorado)' }}>›</span>
    </button>
  )
}

function FilaToggle({ etiqueta, valor, onChange }) {
  return (
    <div className="w-full flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)', border: '1px solid var(--color-borde-tarjeta)' }}>
      <span className="text-sm" style={{ color: 'var(--color-ink)' }}>{etiqueta}</span>
      <button
        onClick={onChange}
        className="relative rounded-full transition-all"
        style={{
          width: 44,
          height: 26,
          padding: 3,
          background: valor ? 'var(--gradiente-primario)' : 'linear-gradient(160deg,#F0D8E1,#E4C4D0)',
        }}
      >
        <div
          className="rounded-full bg-white transition-all"
          style={{ width: 20, height: 20, marginLeft: valor ? 18 : 0, background: 'linear-gradient(160deg,#FFFFFF,#F6E3EA)' }}
        />
      </button>
    </div>
  )
}
