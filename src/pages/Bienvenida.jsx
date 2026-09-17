import logoMelissa from '../assets/melissa-logo-256.png'

export default function Bienvenida({ onSeleccionar, vieneDeQR, clinica }) {
  return (
    <div
      className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6 font-body text-center"
      style={{ background: 'var(--color-fondo-app)' }}
    >
      {clinica?.logo_url ? (
        <div className="flex items-center gap-3 mb-6">
          <img src={logoMelissa} alt="Melissa" className="w-16 h-16 rounded-2xl" />
          <span className="text-2xl" style={{ color: 'var(--color-texto-secundario)' }}>×</span>
          <img src={clinica.logo_url} alt={clinica.nombre} className="w-16 h-16 rounded-2xl object-cover" />
        </div>
      ) : (
        <img src={logoMelissa} alt="Melissa" className="w-24 h-24 rounded-2xl mb-6" />
      )}
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--color-ink)' }}>
        {clinica?.nombre || 'Melissa'}
      </p>
      <p className="text-sm mb-10" style={{ color: 'var(--color-texto-secundario)' }}>
        ¿Cómo quieres ingresar?
      </p>

      <button
        onClick={() => onSeleccionar('paciente')}
        className="w-full rounded-2xl py-4 mb-3 text-white shadow-boton-primario"
        style={{ background: 'var(--gradiente-primario)' }}
      >
        <span style={{ font: "500 15px/1 var(--font-body)" }}>Soy cliente</span>
      </button>

      {!vieneDeQR && (
        <button
          onClick={() => onSeleccionar('clinica')}
          className="w-full rounded-2xl py-4"
          style={{ background: '#FFFDF9', border: '1px solid var(--color-dorado-claro)', color: 'var(--color-ink)' }}
        >
          <span style={{ font: "500 15px/1 var(--font-body)" }}>Soy administrador de negocio</span>
        </button>
      )}
    </div>
  )
}
