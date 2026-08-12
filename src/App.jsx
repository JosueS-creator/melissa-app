import { useEffect, useState } from 'react'
import Home from './pages/Home'
import { aplicarTemaDeClinica } from './lib/aplicarTema'

// TODO: reemplazar por el slug real de la clínica (subdominio, QR, o selección)
const SLUG_CLINICA_DEMO = 'demo'

export default function App() {
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    aplicarTemaDeClinica(SLUG_CLINICA_DEMO).finally(() => setCargando(false))
  }, [])

  if (cargando) return null

  return <Home nombrePaciente="Daniela Chavarria" />
}
