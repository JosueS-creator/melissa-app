import { useEffect, useState } from 'react'
import { misPromociones, promocionParaBanner, marcarPromocion, guardarReservaPromo, formatearPorcentaje } from '../lib/promociones'
import { formatearFecha } from '../lib/crm'

/** Promociones para el cliente: un aviso discreto (como mucho uno por ventana de días), una lista plegable
 * "Tus beneficios" y un detalle con "Reservar ahora" y "No mostrar más". Si algo falla, la app sigue igual. */
export default function PromocionesCliente({ onNavigate }) {
  const [lista, setLista] = useState([])
  const [banner, setBanner] = useState(null)
  const [bannerOculto, setBannerOculto] = useState(false)
  const [abierta, setAbierta] = useState(null)
  const [verLista, setVerLista] = useState(false)

  useEffect(() => {
    let vigente = true
    Promise.all([misPromociones(), promocionParaBanner()])
      .then(([l, b]) => {
        if (!vigente) return
        setLista(l)
        setBanner(b)
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  function abrir(promo) {
    setAbierta(promo)
    marcarPromocion(promo.id, 'vista').catch(() => {})
    setLista((l) => l.map((p) => (p.id === promo.id && p.estado === 'disponible' ? { ...p, estado: 'vista' } : p)))
  }

  function dejarDeVer(promo) {
    marcarPromocion(promo.id, 'descartar').catch(() => {})
    setAbierta(null)
    setBanner((b) => (b?.id === promo.id ? null : b))
    setLista((l) => l.filter((p) => p.id !== promo.id))
  }

  function reservar(promo) {
    guardarReservaPromo(promo)
    setAbierta(null)
    onNavigate?.('agenda')
  }

  if (!banner && lista.length === 0) return null

  const mostrarBanner = banner && !bannerOculto
  const otras = lista.length

  return (
    <div className="mb-4">
      {mostrarBanner && (
        <div
          className="rounded-2xl p-4 relative mb-2"
          style={{ background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)', border: '1px solid var(--color-dorado)' }}
        >
          <button onClick={() => setBannerOculto(true)} aria-label="Cerrar aviso" className="absolute top-2.5 right-3 text-xs" style={{ color: 'var(--color-texto-terciario)' }}>✕</button>
          <p style={{ font: '500 10px/1 var(--font-body)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-dorado)' }}>
            ✨ Tenemos algo especial para ti
          </p>
          <p className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.15, color: 'var(--color-ink)' }}>
            {formatearPorcentaje(banner.descuento_porcentaje)} de descuento
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-ink)' }}>
            {banner.titulo}{banner.servicio_nombre ? ` · ${banner.servicio_nombre}` : ''}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => abrir(banner)} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: 'var(--gradiente-primario)' }}>
              Ver promoción
            </button>
            <button onClick={() => dejarDeVer(banner)} className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>
              No mostrar más
            </button>
          </div>
        </div>
      )}

      {otras > 0 && (
        <div>
          <button onClick={() => setVerLista((v) => !v)} className="text-xs" style={{ color: 'var(--color-primary)' }}>
            🎁 Tus beneficios ({otras}) {verLista ? '▴' : '▾'}
          </button>
          {verLista && (
            <div className="flex flex-col gap-2 mt-2">
              {lista.map((p) => (
                <button
                  key={p.id}
                  onClick={() => abrir(p)}
                  className="w-full text-left rounded-xl px-4 py-3 bg-white"
                  style={{ border: '1px solid var(--color-borde-tarjeta)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm" style={{ color: 'var(--color-ink)' }}>{p.titulo}</span>
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: p.estado === 'utilizada' ? 'var(--color-texto-terciario)' : 'var(--color-primary)' }}>
                      {p.estado === 'utilizada' ? 'Ya usada' : formatearPorcentaje(p.descuento_porcentaje)}
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Válida hasta {formatearFecha(p.fin)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(74,14,43,0.45)' }} onClick={() => setAbierta(null)}>
          <div
            role="dialog"
            aria-label={abierta.titulo}
            className="w-full sm:max-w-app rounded-t-3xl p-6 bg-white"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ font: '500 10px/1 var(--font-body)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-dorado)' }}>🎁 Una sorpresa para ti</p>
            <p className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.1, color: 'var(--color-ink)' }}>
              {formatearPorcentaje(abierta.descuento_porcentaje)} OFF
            </p>
            <p className="text-base mt-1" style={{ color: 'var(--color-ink)' }}>{abierta.titulo}</p>
            {abierta.descripcion && <p className="text-sm mt-2" style={{ color: 'var(--color-texto-secundario)' }}>{abierta.descripcion}</p>}
            <div className="text-xs mt-3" style={{ color: 'var(--color-texto-secundario)' }}>
              {abierta.servicio_nombre && <p>Aplica en: {abierta.servicio_nombre}</p>}
              <p>Válida hasta {formatearFecha(abierta.fin)}</p>
              <p>Un uso por cliente. El descuento lo aplica el negocio al cobrar.</p>
            </div>
            {abierta.estado === 'utilizada' ? (
              <p className="text-sm mt-4" style={{ color: 'var(--color-texto-terciario)' }}>Ya usaste esta promoción.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-4">
                <button onClick={() => reservar(abierta)} className="rounded-xl py-3 text-sm font-medium text-white" style={{ background: 'var(--gradiente-primario)' }}>
                  Reservar ahora
                </button>
                <button onClick={() => dejarDeVer(abierta)} className="text-xs py-1" style={{ color: 'var(--color-texto-secundario)' }}>
                  No mostrar más esta promoción
                </button>
              </div>
            )}
            <button onClick={() => setAbierta(null)} className="w-full text-xs mt-2 py-1" style={{ color: 'var(--color-ink)' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
