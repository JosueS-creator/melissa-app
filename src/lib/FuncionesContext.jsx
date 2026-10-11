import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { planMinimo } from './planes'

// Sin proveedor (p. ej. pantallas sueltas) no se restringe nada; en el app siempre hay proveedor.
const Contexto = createContext({ cargado: true, plan: null, planes: null, tiene: () => true, planMinimo: () => null })

/** Carga una vez el plan del negocio y sus funciones. Si la consulta falla, NO se desbloquea nada (el servidor decide igual). */
export function FuncionesProvider({ usuarioId, children }) {
  const [datos, setDatos] = useState(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    let vigente = true
    setCargado(false)
    setDatos(null)
    Promise.resolve(supabase.rpc('funciones_de_mi_clinica'))
      .then(({ data, error }) => {
        if (!vigente) return
        setDatos(error ? null : data)
        setCargado(true)
      })
      .catch(() => {
        if (vigente) setCargado(true)
      })
    return () => {
      vigente = false
    }
  }, [usuarioId])

  const valor = useMemo(() => {
    const incluidas = new Set(datos?.funciones || [])
    return {
      cargado,
      plan: datos?.plan || null,
      planes: datos?.planes || null,
      tiene: (funcion) => incluidas.has(funcion),
      planMinimo: (funcion) => planMinimo(datos?.planes, funcion),
    }
  }, [datos, cargado])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useFunciones = () => useContext(Contexto)
