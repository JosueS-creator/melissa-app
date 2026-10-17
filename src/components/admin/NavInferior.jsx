import Candado from './Candado'

// Secciones de uso diario con acceso directo; el resto vive en «Más». Mismos ids y mismo `setTab` que la navegación de escritorio.
export const PRINCIPALES = ['citas', 'pacientes']

const trazo = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ICONOS = {
  citas: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" stroke={c} {...trazo} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </svg>
  ),
  pacientes: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" stroke={c} {...trazo} aria-hidden="true">
      <circle cx="9.5" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.8a3.2 3.2 0 0 1 0 5.4M17.5 14.3c2.2.5 3.5 2.3 3.5 5.2" />
    </svg>
  ),
  mas: (c) => (
    <svg width="24" height="24" viewBox="0 0 24 24" stroke={c} {...trazo} aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" />
    </svg>
  ),
}

export default function NavInferior({ tabs, tab, onSelect, sinPlan, canjesPendientes, masAbierto, onMas, masRef }) {
  const principales = PRINCIPALES.map((id) => tabs.find((t) => t.id === id)).filter(Boolean)
  const enMas = !PRINCIPALES.includes(tab)
  const item = 'relative flex-1 flex flex-col items-center justify-center gap-1'
  const alto = { minHeight: 58 }

  return (
    <nav
      aria-label="Navegación del panel"
      className="lg:hidden sticky bottom-0 z-30"
      style={{ background: 'var(--admin-superficie)', borderTop: '1px solid var(--admin-borde)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex sm:max-w-app mx-auto">
        {principales.map((t) => {
          const activo = tab === t.id
          const color = activo ? 'var(--admin-accion)' : 'var(--admin-texto-2)'
          return (
            <button key={t.id} onClick={() => onSelect(t.id)} aria-current={activo ? 'page' : undefined} className={item} style={alto}>
              {activo && <span aria-hidden="true" className="absolute top-0 rounded-b" style={{ width: 28, height: 3, background: 'var(--admin-accion)' }} />}
              {ICONOS[t.id](color)}
              <span style={{ font: `${activo ? 700 : 500} 12px/1 var(--font-body)`, color }}>{t.label}{sinPlan(t) && <Candado />}</span>
            </button>
          )
        })}
        <button
          ref={masRef}
          onClick={onMas}
          aria-haspopup="dialog"
          aria-expanded={masAbierto}
          aria-current={enMas ? 'page' : undefined}
          className={item}
          style={alto}
        >
          {enMas && <span aria-hidden="true" className="absolute top-0 rounded-b" style={{ width: 28, height: 3, background: 'var(--admin-accion)' }} />}
          <span className="relative">
            {ICONOS.mas(enMas ? 'var(--admin-accion)' : 'var(--admin-texto-2)')}
            {canjesPendientes > 0 && (
              <span
                aria-label={`${canjesPendientes} canjes pendientes`}
                className="absolute flex items-center justify-center rounded-full"
                style={{ top: -6, right: -10, minWidth: 18, height: 18, padding: '0 4px', background: 'var(--admin-accion)', color: 'var(--admin-sobre-accion)', font: '700 11px/1 var(--font-body)' }}
              >
                {canjesPendientes}
              </span>
            )}
          </span>
          <span style={{ font: `${enMas ? 700 : 500} 12px/1 var(--font-body)`, color: enMas ? 'var(--admin-accion)' : 'var(--admin-texto-2)' }}>Más</span>
        </button>
      </div>
    </nav>
  )
}
