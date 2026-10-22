import { useFunciones } from '../lib/FuncionesContext'

/** Pantallas del cliente que dependen del plan del negocio. Si el plan no las incluye, no se ofrece nada (sin mensajes de venta). */
export default function RequiereFuncion({ funcion, onVolver, children }) {
  const { cargado, tiene } = useFunciones()
  if (!cargado) return null
  if (tiene(funcion)) return children
  return (
    <div className="px-5 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 96px)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.25, color: 'var(--color-ink)' }}>Esta sección no está disponible</p>
      <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-texto-secundario)' }}>Tu negocio no la tiene activa por ahora.</p>
      {onVolver && (
        <button onClick={onVolver} className="mt-5 rounded-xl px-6 text-sm font-medium text-white" style={{ minHeight: 48, background: 'var(--color-primary)' }}>
          Volver al inicio
        </button>
      )}
    </div>
  )
}
