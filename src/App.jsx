import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import Tienda from './pages/Tienda'
import TarjetaVIP from './pages/TarjetaVIP'
import Historial from './pages/Historial'
import Referidos from './pages/Referidos'
import Perfil from './pages/Perfil'
import AdminPanel from './pages/AdminPanel'
import PanelMelissa from './pages/PanelMelissa'
import Login from './pages/Login'
import Registro from './pages/Registro'
import RegistroAdmin from './pages/RegistroAdmin'
import Bienvenida from './pages/Bienvenida'
import OlvidePassword from './pages/OlvidePassword'
import RestablecerPassword from './pages/RestablecerPassword'
import TabBar from './components/TabBar'
import { aplicarTemaDeClinica, aplicarTemaDeClinicaPorId } from './lib/aplicarTema'
import { obtenerSesionActual, obtenerPerfilActual, cerrarSesion } from './lib/auth'
import { supabase } from './lib/supabaseClient'

const SLUG_CLINICA_DEMO = 'demo'

// Pantallas visibles en el tab bar principal. Historial y Referidos se
// alcanzan desde Perfil (ver Perfil.jsx), no ocupan un ícono propio.
const PANTALLAS_CON_TABBAR = ['inicio', 'agenda', 'tarjeta', 'tienda', 'perfil', 'admin', 'melissa']

function leerParametrosURL() {
  const params = new URLSearchParams(window.location.search)
  return {
    invitacion: params.get('invitacion'),
    slugClinica: params.get('clinica'),
  }
}

export default function App() {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [clinica, setClinica] = useState(null)
  const [pantalla, setPantalla] = useState('bienvenida')
  const [modoEntrada, setModoEntrada] = useState('paciente')
  const [modoRecuperacion, setModoRecuperacion] = useState(false)
  const [parametrosURL] = useState(leerParametrosURL)

  useEffect(() => {
    // Tema por defecto mientras no sabemos a qué clínica pertenece la
    // sesión (antes de login). Si vienen de un link con ?clinica=slug,
    // usamos ese; si no, el de demo.
    aplicarTemaDeClinica(parametrosURL.slugClinica || SLUG_CLINICA_DEMO)

    obtenerSesionActual().then((s) => {
      setSesion(s)
      setCargando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nuevaSesion) => {
      setSesion(nuevaSesion)
      if (event === 'PASSWORD_RECOVERY') {
        // Supabase manda aquí cuando alguien abre el link del correo de
        // "olvidé mi contraseña" — lo forzamos a poner una nueva antes
        // de dejarlo entrar a cualquier otra pantalla.
        setModoRecuperacion(true)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sesion) {
      obtenerPerfilActual().then((p) => {
        setPerfil(p)
        if (p?.clinica_id) {
          // Ya sabemos la clínica real del usuario logueado — aplicamos
          // su tema/marca real (puede ser distinta a la de antes de login).
          aplicarTemaDeClinicaPorId(p.clinica_id).then(setClinica)
        }
        // El admin nunca ve las pantallas de cliente (Beauty Points,
        // reservar cita, tienda) — aterriza directo en su propio panel.
        setPantalla(p?.rol === 'admin' ? 'admin' : 'inicio')
      })
    } else {
      setPerfil(null)
      setClinica(null)
    }
  }, [sesion])

  if (cargando) return null

  if (modoRecuperacion) {
    return (
      <RestablecerPassword
        onListo={() => {
          setModoRecuperacion(false)
          setPantalla('inicio')
        }}
      />
    )
  }

  if (!sesion) {
    if (parametrosURL.invitacion) {
      return (
        <RegistroAdmin
          codigo={parametrosURL.invitacion}
          onRegistroExitoso={() => setPantalla('inicio')}
        />
      )
    }

    if (pantalla === 'registro') {
      return (
        <Registro
          onRegistroExitoso={() => setPantalla('inicio')}
          irALogin={() => setPantalla('login')}
          slugClinica={parametrosURL.slugClinica}
        />
      )
    }

    if (pantalla === 'olvide-password') {
      return <OlvidePassword onVolver={() => setPantalla('login')} />
    }

    if (pantalla === 'login') {
      return (
        <Login
          onLoginExitoso={() => setPantalla('inicio')}
          irARegistro={() => setPantalla('registro')}
          modo={modoEntrada}
          onVolver={() => setPantalla('bienvenida')}
          irAOlvidePassword={() => setPantalla('olvide-password')}
        />
      )
    }

    return (
      <Bienvenida
        onSeleccionar={(modo) => {
          setModoEntrada(modo)
          setPantalla('login')
        }}
        vieneDeQR={!!parametrosURL.slugClinica}
      />
    )
  }

  if (clinica && clinica.activa === false) {
    return (
      <div className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center font-body">
        <p className="font-display text-xl text-ink mb-2">Acceso suspendido</p>
        <p className="text-sm text-ink/60 mb-6">Tu negocio no tiene acceso activo en este momento. Contacta a Melissa para más información.</p>
        <button onClick={cerrarSesion} className="text-sm" style={{ color: 'var(--color-primary)' }}>Cerrar sesión</button>
      </div>
    )
  }

  const esAdmin = perfil?.rol === 'admin'
  const mostrarTabBar = !esAdmin && PANTALLAS_CON_TABBAR.includes(pantalla)

  return (
    <div className="max-w-sm mx-auto min-h-screen flex flex-col" style={{ background: 'var(--color-fondo-app)' }}>
      <div className="flex-1">
        {!esAdmin && pantalla === 'inicio' && (
          <Home nombrePaciente={perfil?.nombre || sesion.user.email} clinica={clinica} onNavigate={setPantalla} />
        )}
        {!esAdmin && pantalla === 'agenda' && <Agenda />}
        {!esAdmin && pantalla === 'tienda' && <Tienda />}
        {!esAdmin && pantalla === 'tarjeta' && <TarjetaVIP onNavigate={setPantalla} />}
        {!esAdmin && pantalla === 'historial' && <Historial onVolver={() => setPantalla('perfil')} />}
        {!esAdmin && pantalla === 'referidos' && <Referidos onVolver={() => setPantalla('perfil')} />}
        {!esAdmin && pantalla === 'perfil' && (
          <Perfil onNavigate={setPantalla} onCerrarSesion={cerrarSesion} esSuperAdmin={perfil?.es_super_admin} />
        )}
        {esAdmin && pantalla === 'melissa' && (
          <PanelMelissa onVolver={() => setPantalla('admin')} />
        )}
        {esAdmin && pantalla !== 'melissa' && (
          <AdminPanel
            onCerrarSesion={cerrarSesion}
            esSuperAdmin={perfil?.es_super_admin}
            onIrAMelissa={() => setPantalla('melissa')}
          />
        )}
      </div>

      {mostrarTabBar && (
        <TabBar activo={pantalla} onNavigate={setPantalla} mostrarAdmin={false} />
      )}
    </div>
  )
}
