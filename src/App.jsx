import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Agenda from './pages/Agenda'
import Tienda from './pages/Tienda'
import TarjetaVIP from './pages/TarjetaVIP'
import Historial from './pages/Historial'
import AdminPanel from './pages/AdminPanel'
import Login from './pages/Login'
import Registro from './pages/Registro'
import { aplicarTemaDeClinica } from './lib/aplicarTema'
import { obtenerSesionActual, obtenerPerfilActual, cerrarSesion } from './lib/auth'
import { supabase } from './lib/supabaseClient'

const SLUG_CLINICA_DEMO = 'demo'

export default function App() {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [pantalla, setPantalla] = useState('inicio') // 'inicio' | 'agenda' | 'tienda' | 'tarjeta' | 'personalizacion' | 'login' | 'registro'

  useEffect(() => {
    aplicarTemaDeClinica(SLUG_CLINICA_DEMO)
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

  return (
    <div>
      {pantalla === 'agenda' && <Agenda />}
      {pantalla === 'tienda' && <Tienda />}
      {pantalla === 'tarjeta' && <TarjetaVIP />}
      {pantalla === 'historial' && <Historial />}
      {pantalla === 'admin' && <AdminPanel />}
      {pantalla === 'inicio' && <Home nombrePaciente={sesion.user.email} />}

      <div className="max-w-sm mx-auto flex justify-around py-3 border-t border-ink/10 bg-white flex-wrap gap-y-2">
        <button onClick={() => setPantalla('inicio')} className={`text-xs ${pantalla === 'inicio' ? 'text-ink font-medium' : 'text-ink/40'}`}>Inicio</button>
        <button onClick={() => setPantalla('agenda')} className={`text-xs ${pantalla === 'agenda' ? 'text-ink font-medium' : 'text-ink/40'}`}>Agenda</button>
        <button onClick={() => setPantalla('historial')} className={`text-xs ${pantalla === 'historial' ? 'text-ink font-medium' : 'text-ink/40'}`}>Historial</button>
        <button onClick={() => setPantalla('tienda')} className={`text-xs ${pantalla === 'tienda' ? 'text-ink font-medium' : 'text-ink/40'}`}>Tienda</button>
        <button onClick={() => setPantalla('tarjeta')} className={`text-xs ${pantalla === 'tarjeta' ? 'text-ink font-medium' : 'text-ink/40'}`}>Mi tarjeta</button>
        {perfil?.rol === 'admin' && (
          <button onClick={() => setPantalla('admin')} className={`text-xs ${pantalla === 'admin' ? 'text-ink font-medium' : 'text-ink/40'}`}>Panel</button>
        )}
        <button onClick={() => cerrarSesion()} className="text-xs text-ink/40">Salir</button>
      </div>
    </div>
  )
}
