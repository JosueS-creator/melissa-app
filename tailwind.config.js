/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        ink: 'var(--color-ink)',
        'fondo-app': 'var(--color-fondo-app)',
        'fondo-oscuro': 'var(--color-fondo-oscuro)',
        dorado: 'var(--color-dorado)',
        'dorado-claro': 'var(--color-dorado-claro)',
        'texto-secundario': 'var(--color-texto-secundario)',
        'texto-terciario': 'var(--color-texto-terciario)',
        'borde-tarjeta': 'var(--color-borde-tarjeta)',
      },
      backgroundImage: {
        'gradiente-fondo-oscuro': 'var(--gradiente-fondo-oscuro)',
        'gradiente-primario': 'var(--gradiente-primario)',
        'gradiente-dorado': 'var(--gradiente-dorado)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
      boxShadow: {
        'tarjeta-oscura': '0 14px 30px rgba(74,14,43,0.28), inset 0 1px 0 rgba(255,255,255,0.16)',
        'boton-primario': 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)',
        'tarjeta-blanca': '0 2px 10px rgba(74,14,43,0.05)',
      },
    },
  },
  plugins: [],
}
