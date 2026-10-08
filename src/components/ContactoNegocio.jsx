import { useEffect, useState } from 'react'
import { obtenerContactoNegocio, enlaceLlamada, enlaceWhatsApp } from '../lib/contacto'

/** Acciones para comunicarse con el negocio: "Llamar" y/o "WhatsApp" según lo que Super Administración haya registrado.
 * Si no hay datos (o falla la consulta) no muestra nada: nunca inventa un número. */
export default function ContactoNegocio() {
  const [contacto, setContacto] = useState(null)

  useEffect(() => {
    let vigente = true
    obtenerContactoNegocio()
      .then((c) => vigente && setContacto(c))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  const llamar = enlaceLlamada(contacto)
  const whatsapp = enlaceWhatsApp(contacto)
  if (!llamar && !whatsapp) return null

  return (
    <div className="flex gap-2 mt-2">
      {llamar && (
        <a
          href={llamar}
          className="rounded-lg px-4 py-2 text-xs font-medium"
          style={{ background: '#FFFDF9', border: '1px solid var(--color-dorado-claro)', color: 'var(--color-primary)' }}
        >
          Llamar
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg px-4 py-2 text-xs font-medium text-white"
          style={{ background: 'var(--gradiente-primario)' }}
        >
          WhatsApp
        </a>
      )}
    </div>
  )
}
