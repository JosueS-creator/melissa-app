import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import Tienda from './pages/Tienda'
import TarjetaVIP from './pages/TarjetaVIP'
import Historial from './pages/Historial'
import Referidos from './pages/Referidos'
import Perfil from './pages/Perfil'
import AdminPanel from './pages/AdminPanel'
import Login from './pages/Login'
import Registro from './pages/Registro'
import TabBar from './components/TabBar'
import { aplicarTemaDeClinica } from './lib/aplicarTema'
import { obtenerSesionActual, obtenerPerfilActual, cerrarSesion } from './lib/auth'
import { supabase } from './lib/supabaseClient'

const SLUG_CLINICA_DEMO = 'demo'

// Pantallas visibles en el tab bar principal. Historial y Referidos se
// alcanzan desde Perfil (ver Perfil.jsx), no ocupan un ícono propio.
const PANTALLAS_CON_TABBAR = ['inicio', 'agenda', 'tarjeta', 'tienda', 'perfil', 'admin']

export default function App() {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [clinica, setClinica] = useState(null)
  const [pantalla, setPantalla] = useState('inicio')

  useEffect(() => {
    aplicarTemaDeClinica(SLUG_CLINICA_DEMO).then((c) => setClinica(c))
    obtenerSesionActual().then((s) => {
      setSesion(s)
      setCargando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSesion(nuevaSesion)
      if (nuevaSesion) setPantalla('inicio')
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sesion) {
      obtenerPerfilActual().then(setPerfil)
    } else {
      setPerfil(null)
    }
  }, [sesion])

  if (cargando) return null

  if (!sesion) {
    return pantalla === 'registro' ? (
      <Registro onRegistroExitoso={() => setPantalla('inicio')} irALogin={() => setPantalla('login')} />
    ) : (
      <Login onLoginExitoso={() => setPantalla('inicio')} irARegistro={() => setPantalla('registro')} />
    )
  }

  const mostrarTabBar = PANTALLAS_CON_TABBAR.includes(pantalla)

  return (
    <div className="max-w-sm mx-auto flex flex-col" style={{ background: 'var(--color-fondo-app)', minHeight: '100dvh' }}>
      <div className="flex-1">
        {pantalla === 'inicio' && (
          <Home nombrePaciente={perfil?.nombre || sesion.user.email} clinica={clinica} onNavigate={setPantalla} />
        )}
        {pantalla === 'agenda' && <Agenda />}
        {pantalla === 'tienda' && <Tienda />}
        {pantalla === 'tarjeta' && <TarjetaVIP onNavigate={setPantalla} />}
        {pantalla === 'historial' && <Historial onVolver={() => setPantalla('perfil')} />}
        {pantalla === 'referidos' && <Referidos onVolver={() => setPantalla('perfil')} />}
        {pantalla === 'perfil' && <Perfil onNavigate={setPantalla} onCerrarSesion={cerrarSesion} />}
        {pantalla === 'admin' && <AdminPanel />}
      </div>

      {mostrarTabBar && (
        <TabBar activo={pantalla} onNavigate={setPantalla} mostrarAdmin={perfil?.rol === 'admin'} />
      )}
    </div>
  )
}
