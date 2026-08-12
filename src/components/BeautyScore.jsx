export default function BeautyScore({ valor = 0, tamano = 48 }) {
  const radio = 20
  const circunferencia = 2 * Math.PI * radio
  const offset = circunferencia * (1 - valor / 100)

  return (
    <div className="relative" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radio} fill="none" stroke="var(--color-accent)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={radio}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">
        {valor}
      </div>
    </div>
  )
}
