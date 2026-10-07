import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import SugerirPuntos from './SugerirPuntos'

/** Campo "Puntos que genera" con el asistente "✨ Sugerir puntos" debajo. Se usa al crear y al editar. */
export function CampoPuntos({ valor, onCambio, precio, tipo, config }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Puntos que genera</span>
        <input
          className="rounded-lg px-3 py-2 text-sm bg-white"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          aria-label="Puntos que genera"
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
        />
      </label>
      <button type="button" onClick={() => setAbierto((v) => !v)} className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>
        ✨ Sugerir puntos
      </button>
      {abierto && (
        <SugerirPuntos
          tipo={tipo}
          precio={precio}
          moneda={config.moneda}
          valorPunto={config.valorPunto}
          onUsar={(n) => onCambio(String(n))}
          onCerrar={() => setAbierto(false)}
          onGuardarValorPunto={config.guardarValorPunto}
        />
      )}
    </div>
  )
}

/** Muestra los puntos de un producto o servicio ya creado y permite editarlos (no existía edición). */
export function PuntosEnFila({ tabla, fila, tipo, config, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(fila.puntos_otorga ?? 0))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setGuardando(true)
    setError('')
    const puntos = Math.max(0, parseInt(valor, 10) || 0)
    const { error: err } = await supabase.from(tabla).update({ puntos_otorga: puntos }).eq('id', fila.id)
    setGuardando(false)
    if (err) {
      setError('No se pudo guardar: ' + err.message)
      return
    }
    setEditando(false)
    onGuardado?.()
  }

  if (!editando) {
    return (
      <p className="text-[11px] text-ink/50">
        Puntos que genera: <strong>{fila.puntos_otorga ?? 0}</strong>{' '}
        <button type="button" onClick={() => { setValor(String(fila.puntos_otorga ?? 0)); setEditando(true) }} style={{ color: 'var(--color-primary)' }}>Editar</button>
      </p>
    )
  }
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <CampoPuntos valor={valor} onCambio={setValor} precio={fila.precio} tipo={tipo} config={config} />
      {error && <p className="text-[11px]" style={{ color: '#B0524A' }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={guardando} className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-60" style={{ background: 'var(--color-primary)' }}>
          {guardando ? 'Guardando...' : 'Guardar puntos'}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="rounded-lg px-3 py-1.5 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>Cancelar</button>
      </div>
    </div>
  )
}
