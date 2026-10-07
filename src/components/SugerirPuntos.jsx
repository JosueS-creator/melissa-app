import { useState } from 'react'
import { OPCIONES_PORCENTAJE, calcularSugerenciaPuntos } from '../lib/sugerirPuntos'
import { formatearMonto, simboloMoneda } from '../lib/crm'

const numeroCorto = (n) => Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

/** Panel pequeño "✨ Sugerir puntos". No guarda el costo (es un dato sensible del negocio): solo calcula. */
export default function SugerirPuntos({ tipo, precio, moneda, valorPunto, onUsar, onCerrar, onGuardarValorPunto }) {
  const esProducto = tipo === 'producto'
  const [costo, setCosto] = useState('')
  const [opcion, setOpcion] = useState('balanceado')
  const [personalizado, setPersonalizado] = useState('')
  const [modificando, setModificando] = useState(false)
  const [manual, setManual] = useState('')
  const [editandoValor, setEditandoValor] = useState(false)
  const [nuevoValor, setNuevoValor] = useState('')
  const [errorValor, setErrorValor] = useState('')

  const porcentaje = opcion === 'personalizado' ? Number(personalizado) : OPCIONES_PORCENTAJE.find((o) => o.id === opcion).porcentaje
  const precioNumero = Number(precio)
  const r = costo === '' ? null : calcularSugerenciaPuntos({ precio: precioNumero, costo, porcentaje, valorPunto })
  const dinero = (n) => formatearMonto(n, moneda)

  async function guardarValor() {
    setErrorValor('')
    try {
      await onGuardarValorPunto(Number(nuevoValor))
      setEditandoValor(false)
    } catch (e) {
      setErrorValor(e.message)
    }
  }

  const usar = (n) => {
    onUsar(Math.max(0, Math.floor(Number(n) || 0)))
    onCerrar()
  }

  return (
    <div className="rounded-xl p-3 mt-2 bg-white flex flex-col gap-2.5" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>✨ Sugerir puntos</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-xs" style={{ color: 'var(--color-texto-terciario)' }}>✕</button>
      </div>

      {!(precioNumero > 0) ? (
        <p className="text-xs" style={{ color: '#B0524A' }}>
          Primero escribe el precio {esProducto ? 'del producto' : 'del servicio'}: la sugerencia parte de él.
        </p>
      ) : (
        <>
          <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>Precio: {dinero(precioNumero)}</p>

          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
              {esProducto ? '¿Cuánto te cuesta este producto?' : '¿Cuál es el costo aproximado de este servicio?'}
            </span>
            <input
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--color-accent)' }}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder={`Costo (${simboloMoneda(moneda) || moneda})`}
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
          </label>

          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-ink)' }}>¿Qué porcentaje de tu margen quieres destinar a fidelización?</p>
            <div className="flex flex-wrap gap-1.5">
              {OPCIONES_PORCENTAJE.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpcion(o.id)}
                  className="rounded-full px-3 py-1.5 text-[11px]"
                  style={opcion === o.id ? { background: 'var(--gradiente-primario)', color: '#FFFFFF' } : { background: 'var(--color-accent)', color: 'var(--color-ink)' }}
                >
                  {o.porcentaje}% · {o.etiqueta}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOpcion('personalizado')}
                className="rounded-full px-3 py-1.5 text-[11px]"
                style={opcion === 'personalizado' ? { background: 'var(--gradiente-primario)', color: '#FFFFFF' } : { background: 'var(--color-accent)', color: 'var(--color-ink)' }}
              >
                Personalizado
              </button>
            </div>
            {opcion === 'personalizado' && (
              <input
                className="rounded-lg px-3 py-2 text-sm mt-1.5 w-full"
                style={{ background: 'var(--color-accent)' }}
                type="number"
                inputMode="decimal"
                min="1"
                max="100"
                step="0.5"
                placeholder="% de tu margen (1 a 100)"
                value={personalizado}
                onChange={(e) => setPersonalizado(e.target.value)}
              />
            )}
          </div>

          {r?.estado === 'datos_invalidos' && (
            <p className="text-xs" style={{ color: '#B0524A' }}>Revisa los datos: el costo no puede ser negativo y el porcentaje debe estar entre 1 y 100.</p>
          )}
          {r?.estado === 'margen_negativo' && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--color-accent)', color: '#B0524A' }}>
              El costo supera el precio de venta. Melissa no puede recomendar puntos con estos datos.
            </p>
          )}
          {(r?.estado === 'ok' || r?.estado === 'sin_margen' || r?.estado === 'presupuesto_insuficiente') && (
            <div className="rounded-lg px-3 py-3" style={{ background: 'var(--color-accent)' }}>
              <p className="text-[10px] uppercase" style={{ letterSpacing: '0.14em', color: 'var(--color-dorado)' }}>✨ Recomendación de Melissa</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.2, color: 'var(--color-ink)' }}>
                {r.puntos} {r.puntos === 1 ? 'punto' : 'puntos'}
                {r.estado !== 'ok' && <span className="text-xs" style={{ fontFamily: 'var(--font-body)' }}> recomendados</span>}
              </p>
              {r.estado === 'sin_margen' && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-ink)' }}>No existe margen disponible para destinar a fidelización.</p>
              )}
              {r.estado === 'presupuesto_insuficiente' && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-ink)' }}>
                  El presupuesto ({dinero(r.presupuesto)}) no alcanza para 1 punto con el valor de referencia actual.
                </p>
              )}
              <div className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--color-texto-secundario)' }}>
                <p>Basado en:</p>
                <p>Precio: {dinero(precioNumero)} · Costo: {dinero(costo)}</p>
                <p>Margen estimado: {dinero(r.margen)}</p>
                {r.estado !== 'sin_margen' && (
                  <p>Fidelización: {porcentaje}% · Presupuesto: {dinero(r.presupuesto)}</p>
                )}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-texto-terciario)' }}>Sugerencia basada en los datos que ingresaste.</p>

              {!modificando ? (
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => usar(r.puntos)} className="flex-1 rounded-lg py-2 text-xs font-medium text-white" style={{ background: 'var(--gradiente-primario)' }}>
                    Usar {r.puntos} {r.puntos === 1 ? 'punto' : 'puntos'}
                  </button>
                  <button type="button" onClick={() => { setModificando(true); setManual(String(r.puntos)) }} className="rounded-lg px-4 py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>
                    Modificar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <input
                    className="rounded-lg px-3 py-2 text-sm flex-1 bg-white"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    aria-label="Puntos a usar"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                  />
                  <button type="button" onClick={() => usar(manual)} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: 'var(--gradiente-primario)' }}>
                    Usar
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>
        {valorPunto == null ? (
          <p>Cargando el valor de referencia…</p>
        ) : !editandoValor ? (
          <p>
            Valor de referencia: 1 punto ≈ {simboloMoneda(moneda)} {numeroCorto(valorPunto)}{' '}
            <button type="button" onClick={() => { setNuevoValor(String(valorPunto)); setEditandoValor(true) }} style={{ color: 'var(--color-primary)' }}>
              Cambiar
            </button>
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <input
                className="rounded-lg px-3 py-1.5 text-sm flex-1"
                style={{ background: 'var(--color-accent)' }}
                type="number"
                inputMode="decimal"
                min="0.0001"
                step="0.01"
                aria-label="Valor de referencia del punto"
                value={nuevoValor}
                onChange={(e) => setNuevoValor(e.target.value)}
              />
              <button type="button" onClick={guardarValor} className="rounded-lg px-3 py-1.5 text-xs text-white" style={{ background: 'var(--color-primary)' }}>Guardar</button>
              <button type="button" onClick={() => setEditandoValor(false)} className="rounded-lg px-3 py-1.5 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>Cancelar</button>
            </div>
            {errorValor && <p style={{ color: '#B0524A' }}>{errorValor}</p>}
            <p style={{ color: 'var(--color-texto-terciario)' }}>Solo cambia las próximas sugerencias: no modifica puntos históricos ni los puntos que ya tienen tus productos y servicios.</p>
          </div>
        )}
      </div>
    </div>
  )
}
