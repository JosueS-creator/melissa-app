import { useFunciones } from '../lib/FuncionesContext'
import { ETIQUETA_FUNCION, NOMBRE_PLAN } from '../lib/planes'

/** Lo que ve el administrador al abrir un módulo que su plan no incluye. */
export default function FuncionBloqueada({ funcion }) {
  const { plan, planMinimo } = useFunciones()
  const nombre = ETIQUETA_FUNCION[funcion] || 'Esta función'
  const desde = planMinimo(funcion)

  return (
    <div role="status" className="text-center mx-auto" style={{ maxWidth: 420, background: '#FFFFFF', border: '1px solid var(--color-borde-tarjeta)', borderRadius: 22, padding: '32px 24px' }}>
      <div className="mx-auto flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: 'color-mix(in srgb, var(--color-primary) 8%, var(--color-fondo-app))' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      </div>
      <p className="mt-4" style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.25, color: 'var(--color-ink)' }}>
        {nombre} no está incluida en tu plan
      </p>
      {plan ? (
        <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-texto-secundario)' }}>
          Tu plan actual es {NOMBRE_PLAN[plan] || plan}.
          {desde ? ` Esta función está disponible desde el plan ${NOMBRE_PLAN[desde]}.` : ''}
        </p>
      ) : (
        <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-texto-secundario)' }}>
          No pudimos verificar tu plan. Recarga la página e inténtalo de nuevo.
        </p>
      )}
      {plan && (
        <p className="mt-3" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-texto-secundario)' }}>
          Para activarla, comunícate con Melissa. Tus datos se conservan.
        </p>
      )}
    </div>
  )
}
