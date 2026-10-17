/** Cifras REALES del día calculadas con las citas que el panel ya cargó (sin consultas nuevas ni datos de muestra). */
export function resumenDeCitas(citas, ahora = new Date()) {
  const hoy = ahora.toDateString()
  const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  return {
    hoy: citas.filter((c) => new Date(c.fecha_hora).toDateString() === hoy && c.estado !== 'cancelada').length,
    porConfirmar: citas.filter((c) => c.estado === 'pendiente' && new Date(c.fecha_hora) >= inicioDeHoy).length,
  }
}

export default function ResumenDelDia({ citas, onVerAgenda }) {
  const { hoy, porConfirmar } = resumenDeCitas(citas)
  const texto = new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })
  const fecha = texto.charAt(0).toUpperCase() + texto.slice(1)
  // Cifras en la tipografía de datos: el «1» de la tipografía de títulos se confunde con una «l».
  const cifra = { font: '600 34px/1 var(--font-body)' }

  return (
    <section
      aria-label="Resumen del día"
      className="adm-sobre-acero mb-3"
      style={{
        borderRadius: 18,
        padding: '16px 18px',
        background: 'linear-gradient(160deg, var(--admin-acero-2) 0%, var(--admin-acero) 64%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
        color: 'var(--admin-sobre-color)',
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="whitespace-nowrap" style={{ font: '600 12px/1.2 var(--font-body)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--admin-plata)' }}>Resumen del día</p>
        <p className="whitespace-nowrap" style={{ fontSize: 12, color: 'var(--admin-plata)' }}>{fecha}</p>
      </div>
      <div className="flex items-end gap-8 mt-3">
        <div>
          <p style={cifra}>{hoy}</p>
          <p className="mt-1" style={{ fontSize: 13 }}>{hoy === 1 ? 'Cita hoy' : 'Citas hoy'}</p>
        </div>
        <div>
          <p style={cifra}>{porConfirmar}</p>
          <p className="mt-1" style={{ fontSize: 13 }}>Por confirmar</p>
        </div>
      </div>
      <div className="mt-2 pt-1" style={{ borderTop: '1px solid color-mix(in srgb, var(--admin-plata) 28%, transparent)' }}>
        <button onClick={onVerAgenda} className="flex items-center gap-1 text-sm font-medium" style={{ minHeight: 44, color: 'var(--admin-sobre-color)' }}>
          Ver agenda <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  )
}
