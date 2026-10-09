// Barra inferior: 4 pestañas. "Citas" abre la Agenda y "Beneficios" la Tarjeta (puntos, recompensas y canjes).
// La Tienda no tiene pestaña: se llega desde "Para ti" en Inicio; estando en la Tienda ninguna pestaña queda marcada.
const trazo = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ITEMS = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: (color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" stroke={color} {...trazo} aria-hidden="true">
        <path d="M4 10.5 12 3.5l8 7V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    ),
  },
  {
    id: 'agenda',
    label: 'Citas',
    icon: (color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" stroke={color} {...trazo} aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M8 3v4M16 3v4M3.5 10.5h17" />
      </svg>
    ),
  },
  {
    id: 'tarjeta',
    label: 'Beneficios',
    icon: (color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" stroke={color} {...trazo} aria-hidden="true">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </svg>
    ),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: (color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" stroke={color} {...trazo} aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </svg>
    ),
  },
]

export default function TabBar({ activo, onNavigate, mostrarAdmin }) {
  const colorActivo = 'var(--color-primary)'
  const colorInactivo = 'var(--color-texto-secundario)'
  const item = 'flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px]'

  return (
    <nav
      aria-label="Navegación principal"
      className="flex px-2 pt-2 sticky bottom-0 z-30"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid var(--color-borde-tarjeta)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
      }}
    >
      {ITEMS.map((it) => {
        const esActivo = activo === it.id
        const color = esActivo ? colorActivo : colorInactivo
        return (
          <button key={it.id} onClick={() => onNavigate(it.id)} aria-current={esActivo ? 'page' : undefined} className={item}>
            {it.icon(color)}
            <span style={{ font: '500 12px/1 var(--font-body)', color }}>{it.label}</span>
          </button>
        )
      })}
      {mostrarAdmin && (
        <button onClick={() => onNavigate('admin')} aria-current={activo === 'admin' ? 'page' : undefined} className={item}>
          <svg width="24" height="24" viewBox="0 0 24 24" stroke={activo === 'admin' ? colorActivo : colorInactivo} {...trazo} aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={{ font: '500 12px/1 var(--font-body)', color: activo === 'admin' ? colorActivo : colorInactivo }}>Panel</span>
        </button>
      )}
    </nav>
  )
}
