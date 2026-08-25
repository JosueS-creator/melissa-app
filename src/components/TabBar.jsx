const ITEMS = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5 12 3.5l8 7V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    ),
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3v4M16 3v4M3.5 10.5h17" />
      </svg>
    ),
  },
  {
    id: 'tarjeta',
    label: 'Tarjeta',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5.5" width="19" height="13.5" rx="2.5" />
        <path d="M2.5 10.5h19M6 15h4" />
      </svg>
    ),
  },
  {
    id: 'tienda',
    label: 'Tienda',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l1 12.5H5z" />
        <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
      </svg>
    ),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: (color) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </svg>
    ),
  },
]

export default function TabBar({ activo, onNavigate, mostrarAdmin }) {
  const colorActivo = 'var(--color-primary)'
  const colorInactivo = 'var(--color-texto-terciario)'

  return (
    <div
      className="flex items-end justify-between px-4 pt-2.5"
      style={{
        background: 'var(--color-fondo-app)',
        borderTop: '1px solid var(--color-borde-tarjeta)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
      }}
    >
      {ITEMS.map((item) => {
        const esActivo = activo === item.id
        const color = esActivo ? colorActivo : colorInactivo
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex flex-col items-center gap-1.5"
            style={{ width: 56 }}
          >
            {item.icon(color)}
            <span style={{ font: "500 9px/1 var(--font-body)", letterSpacing: '0.06em', color }}>{item.label}</span>
          </button>
        )
      })}
      {mostrarAdmin && (
        <button onClick={() => onNavigate('admin')} className="flex flex-col items-center gap-1.5" style={{ width: 56 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={activo === 'admin' ? colorActivo : colorInactivo} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={{ font: "500 9px/1 var(--font-body)", letterSpacing: '0.06em', color: activo === 'admin' ? colorActivo : colorInactivo }}>Panel</span>
        </button>
      )}
    </div>
  )
}
