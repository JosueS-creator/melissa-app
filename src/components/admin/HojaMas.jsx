import { useEffect, useRef } from 'react'
import Candado from './Candado'

/** «Más»: el resto de las secciones y las acciones de cuenta, en una hoja inferior accesible (diálogo modal). */
export default function HojaMas({ abierta, onCerrar, tabs, tab, onSelect, sinPlan, canjesPendientes, cuenta }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!abierta) return undefined
    ref.current?.focus()
    function alTeclear(e) {
      if (e.key === 'Escape') {
        onCerrar()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      // Mantiene el foco dentro del diálogo.
      const foco = [...ref.current.querySelectorAll('button:not([disabled])')]
      if (foco.length === 0) return
      const primero = foco[0]
      const ultimo = foco[foco.length - 1]
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === ref.current)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierta, onCerrar])

  if (!abierta) return null

  const fila = 'w-full flex items-center justify-between text-left rounded-xl px-3'
  return (
    <div className="lg:hidden fixed inset-0 z-40">
      <div aria-hidden="true" className="absolute inset-0" onClick={onCerrar} style={{ background: 'color-mix(in srgb, var(--admin-acero) 55%, transparent)' }} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Más opciones"
        tabIndex={-1}
        className="adm-hoja absolute bottom-0 left-0 right-0 sm:max-w-app mx-auto overflow-y-auto"
        style={{
          background: 'var(--admin-superficie)',
          borderRadius: '22px 22px 0 0',
          maxHeight: '84vh',
          padding: '8px 16px calc(env(safe-area-inset-bottom) + 12px)',
          color: 'var(--admin-texto)',
          outline: 'none',
        }}
      >
        <div aria-hidden="true" className="mx-auto mt-1 rounded-full" style={{ width: 40, height: 4, background: 'var(--admin-plata)' }} />
        <div className="flex items-center justify-between" style={{ minHeight: 48 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--admin-texto)' }}>Más</p>
          <button onClick={onCerrar} className="rounded-xl px-3 text-sm font-medium" style={{ minHeight: 44, color: 'var(--admin-texto-2)' }}>Cerrar</button>
        </div>

        <ul className="flex flex-col gap-0.5">
          {tabs.map((t) => {
            const activa = tab === t.id
            return (
              <li key={t.id}>
                <button
                  onClick={() => onSelect(t.id)}
                  aria-current={activa ? 'page' : undefined}
                  className={fila}
                  style={{ minHeight: 52, background: activa ? 'var(--admin-fondo)' : 'transparent', fontWeight: activa ? 700 : 500, fontSize: 15, borderLeft: `3px solid ${activa ? 'var(--admin-accion)' : 'transparent'}` }}
                >
                  <span>{t.label}{t.id === 'canjes' && canjesPendientes > 0 ? ` (${canjesPendientes})` : ''}{sinPlan(t) && <Candado />}</span>
                  <span aria-hidden="true" style={{ color: 'var(--admin-texto-2)' }}>›</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--admin-borde)' }}>
          <p style={{ font: '600 12px/1 var(--font-body)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--admin-texto-2)', padding: '10px 12px 4px' }}>Cuenta</p>
          {cuenta.onIrAMelissa && (
            <button onClick={cuenta.onIrAMelissa} className={fila} style={{ minHeight: 48, fontSize: 15 }}>Panel de Melissa</button>
          )}
          <button onClick={cuenta.onDescargar} className={fila} style={{ minHeight: 48, fontSize: 15 }}>Mis datos</button>
          <button onClick={cuenta.onSalir} className={fila} style={{ minHeight: 48, fontSize: 15, color: 'var(--adm-cancelada)' }}>Salir</button>
        </div>
      </div>
    </div>
  )
}
