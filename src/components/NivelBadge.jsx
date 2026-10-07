import { ETIQUETA_NIVEL } from '../lib/fidelidad'

const ESTILOS = {
  silver: { background: '#EDE7EA', color: '#5C4A53' },
  gold: { background: 'var(--gradiente-dorado)', color: 'var(--color-ink)' },
  platinum: { background: 'var(--gradiente-fondo-oscuro)', color: '#FFFFFF' },
}

export default function NivelBadge({ nivel }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-sm flex-shrink-0"
      style={{ ...(ESTILOS[nivel] || ESTILOS.silver), font: '500 9px/1.3 var(--font-body)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
    >
      {ETIQUETA_NIVEL[nivel] || ETIQUETA_NIVEL.silver}
    </span>
  )
}
