import { useState } from 'react'

/** Zona de imagen de una tarjeta (servicio, producto, próxima visita). Con foto: la muestra recortada (object-fit: cover).
 * Sin foto, o si la imagen no carga: mosaico con la inicial, en un tono derivado del tema. Alto fijo: sin saltos al cargar. */
export const TINTES = [
  'color-mix(in srgb, var(--color-accent) 55%, var(--color-fondo-app))',
  'color-mix(in srgb, var(--color-dorado-claro) 55%, var(--color-fondo-app))',
  'color-mix(in srgb, var(--color-primary) 8%, var(--color-fondo-app))',
  'color-mix(in srgb, var(--color-dorado) 16%, var(--color-fondo-app))',
]

const LINEA = '1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)'

export default function FotoTarjeta({ src, nombre = '', tinte = TINTES[0], alto, tamanoInicial = 64, inicialDerecha = false, prioridad = false, style }) {
  const [fallo, setFallo] = useState(false)
  const conFoto = Boolean(src) && !fallo
  const inicial = (nombre.trim()[0] || '').toUpperCase()

  return (
    <div className="relative overflow-hidden" style={{ background: tinte, height: alto, ...style }}>
      {!conFoto && (
        <>
          <span aria-hidden="true" className="absolute rounded-full" style={{ right: -30, top: -30, width: 120, height: 120, border: LINEA }} />
          <span
            aria-hidden="true"
            className="absolute"
            style={{ [inicialDerecha ? 'right' : 'left']: inicialDerecha ? 20 : 14, bottom: 4, fontFamily: 'var(--font-display)', fontSize: tamanoInicial, lineHeight: 1, color: 'var(--color-ink)' }}
          >
            {inicial}
          </span>
        </>
      )}
      {conFoto && (
        <img
          src={src}
          alt=""
          loading={prioridad ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFallo(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  )
}
