// Colores del panel administrativo. UN solo lugar para la paleta metálica de Melissa.
//
// Cómo se decide qué colores usa el panel de cada clínica (de mayor a menor prioridad):
//   1) Tokens `admin_*` del tema (temas_base.tokens) — así se personaliza cada clínica/tema desde la base, sin tocar código.
//   2) La paleta metálica de Melissa, solo para el tema de Melissa y solo si la clínica NO definió colores propios.
//   3) Nada: el panel deriva sus colores de las variables normales del tema (--color-primary, --color-fondo-oscuro, --color-ink…),
//      de modo que una clínica con identidad propia nunca recibe colores de Melissa.
// Los componentes no usan estos valores: usan las variables --admin-* (ver .panel-admin en index.css).

export const PALETA_METALICA = {
  fondo: '#F6F7FA',          // fondo plata muy claro
  superficie: '#FFFFFF',     // tarjetas
  borde: '#D1D8E1',          // bordes plateados
  plata: '#C2CEDD',          // plata fría (divisores, superficies secundarias)
  acero: '#14263F',          // azul acero oscuro (resumen, navegación importante)
  'acero-2': '#304C6A',      // azul acero secundario
  accion: '#4A0E2B',         // ciruela profunda (acción primaria y estado activo)
  'accion-2': '#7A3358',     // ciruela secundaria (reflejo sutil del degradado)
  detalle: '#B59A60',        // dorado discreto: solo detalles, nunca texto
  texto: '#202B3A',
  'texto-2': '#657184',
}

export const CLAVES_ADMIN = Object.keys(PALETA_METALICA)
export const TEMAS_CON_PALETA_METALICA = ['Rosa y Oro']

export const CLAVE_SOBRE_ACCION = 'sobre-accion'

/** Texto legible sobre un color de acción: blanco u oscuro, el que dé más contraste (así un color claro, p. ej. dorado, no deja el botón ilegible). */
export function colorSobre(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return '#FFFFFF'
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const conBlanco = 1.05 / (luz + 0.05)
  const conOscuro = (luz + 0.05) / (0.011 + 0.05) // #1B1B1B
  return conBlanco >= conOscuro ? '#FFFFFF' : '#1B1B1B'
}

const claveDeToken = (clave) => 'admin_' + clave.replace('-', '_')

/** Colores del panel que hay que inyectar como --tema-admin-<clave> para esta clínica (objeto vacío = derivar del tema). */
export function tokensAdminDe(clinica) {
  const tema = clinica?.temas_base
  const delTema = {}
  for (const clave of CLAVES_ADMIN) {
    const valor = tema?.tokens?.[claveDeToken(clave)]
    if (valor) delTema[clave] = valor
  }
  const coloresPropios = Boolean(clinica?.color_primario || clinica?.color_secundario || clinica?.color_acento)
  const base = !coloresPropios && TEMAS_CON_PALETA_METALICA.includes(tema?.nombre) ? PALETA_METALICA : {}
  const resultado = { ...base, ...delTema }
  // Si la clínica eligió su propio color principal, las acciones siguen ese color.
  if (clinica?.color_primario) {
    delete resultado.accion
    delete resultado['accion-2']
  }
  return resultado
}
