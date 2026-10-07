import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

/**
 * Configuración de puntos del negocio. El valor de referencia del punto tiene UNA sola
 * fuente de verdad: la columna clinicas.valor_punto. Cambiarlo no modifica puntos históricos
 * ni los puntos ya definidos en productos o servicios: solo alimenta las sugerencias.
 */
export function useConfigPuntos(clinicaId) {
  const [config, setConfig] = useState({ valorPunto: null, moneda: 'HNL' })

  useEffect(() => {
    let vigente = true
    supabase
      .from('clinicas')
      .select('valor_punto, moneda')
      .eq('id', clinicaId)
      .single()
      .then(({ data }) => {
        if (vigente && data) setConfig({ valorPunto: Number(data.valor_punto), moneda: data.moneda || 'HNL' })
      })
    return () => {
      vigente = false
    }
  }, [clinicaId])

  async function guardarValorPunto(nuevo) {
    const valor = Number(nuevo)
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('El valor debe ser mayor que cero.')
    const { error } = await supabase.from('clinicas').update({ valor_punto: valor }).eq('id', clinicaId)
    if (error) throw new Error(error.message)
    setConfig((c) => ({ ...c, valorPunto: valor }))
  }

  return { ...config, guardarValorPunto }
}

/** Clave de operación: identifica UNA venta. Si se reintenta (doble clic, refresh, red caída)
 * con la misma clave, la base devuelve la misma venta en vez de duplicarla. */
export function nuevaClaveOperacion() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
