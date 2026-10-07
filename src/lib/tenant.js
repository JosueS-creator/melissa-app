/**
 * Resolución del negocio (tenant) desde la URL — un solo punto para toda la app.
 * Cadena: slug → clínica → clinica_id (la consulta la hacen aplicarTema/auth).
 *
 * Hoy:        https://melissa.app/<slug>        y  ?clinica=<slug> (QR ya impresos)
 * Preparado:  https://<slug>.<VITE_BASE_DOMAIN>  (se activa definiendo esa variable)
 *
 * Devuelve null si la URL no indica ningún negocio. No hay negocio por defecto:
 * ninguna función nueva debe asumir 'demo'.
 */
const RUTAS_RESERVADAS = new Set(['', 'assets', 'index.html', 'favicon.ico', 'robots.txt'])
const FORMATO_SLUG = /^[a-z0-9][a-z0-9-]*$/

export function resolverSlugClinica(location = window.location) {
  const porQuery = new URLSearchParams(location.search).get('clinica')?.toLowerCase()
  if (porQuery && FORMATO_SLUG.test(porQuery)) return porQuery

  const dominioBase = import.meta.env.VITE_BASE_DOMAIN
  if (dominioBase && location.hostname.endsWith('.' + dominioBase)) {
    const subdominio = location.hostname.slice(0, -(dominioBase.length + 1)).toLowerCase()
    if (subdominio !== 'www' && FORMATO_SLUG.test(subdominio)) return subdominio
  }

  const segmento = (location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase()
  if (!RUTAS_RESERVADAS.has(segmento) && FORMATO_SLUG.test(segmento)) return segmento

  return null
}
