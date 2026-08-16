import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

export default function Tienda() {
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState({}) // { producto_id: cantidad }
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function cargar() {
      const paciente = await obtenerPacienteActual()
      if (!paciente) {
        setCargando(false)
        return
      }
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('clinica_id', paciente.clinica_id)
        .eq('activo', true)
      setProductos(data || [])
      setCargando(false)
    }
    cargar()
  }, [])

  function agregar(id) {
    setCarrito((c) => ({ ...c, [id]: (c[id] || 0) + 1 }))
  }

  function quitarUno(id) {
    setCarrito((c) => {
      const nuevaCantidad = (c[id] || 0) - 1
      const copia = { ...c }
      if (nuevaCantidad <= 0) {
        delete copia[id]
      } else {
        copia[id] = nuevaCantidad
      }
      return copia
    })
  }

  const total = productos.reduce((sum, p) => sum + (carrito[p.id] || 0) * Number(p.precio), 0)
  const items = Object.values(carrito).reduce((a, b) => a + b, 0)

  async function confirmarPedido() {
    const paciente = await obtenerPacienteActual()
    if (!paciente || items === 0) return
    setEnviando(true)

    const { data: pedido, error: errorPedido } = await supabase
      .from('pedidos')
      .insert({
        clinica_id: paciente.clinica_id,
        paciente_id: paciente.id,
        total,
        metodo_pago: 'wallet',
        entrega: 'domicilio',
        estado: 'pendiente',
      })
      .select()
      .single()

    if (errorPedido || !pedido) {
      setMensaje('No se pudo procesar el pedido. Intenta de nuevo.')
      setEnviando(false)
      return
    }

    const filasItems = Object.entries(carrito).map(([producto_id, cantidad]) => {
      const producto = productos.find((p) => p.id === producto_id)
      return { pedido_id: pedido.id, producto_id, cantidad, precio_unitario: producto.precio }
    })

    await supabase.from('pedido_items').insert(filasItems)

    setMensaje(`Pedido confirmado — L ${total.toFixed(2)}`)
    setCarrito({})
    setEnviando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando tienda...</p>

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 pb-28 font-body">
      <p className="font-display text-xl text-ink mb-4">Tienda</p>

      {productos.length === 0 && (
        <p className="text-sm text-ink/60">Esta clínica todavía no tiene productos en su catálogo.</p>
      )}

      {productos.map((p) => (
        <div key={p.id} className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">{p.nombre}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-primary)' }}>L {Number(p.precio).toFixed(2)}</p>
          </div>
          {carrito[p.id] > 0 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => quitarUno(p.id)}
                className="w-7 h-7 rounded-lg text-white text-base flex items-center justify-center"
                style={{ background: 'var(--color-primary)' }}
              >
                −
              </button>
              <span className="text-sm font-medium text-ink w-4 text-center">{carrito[p.id]}</span>
              <button
                onClick={() => agregar(p.id)}
                className="w-7 h-7 rounded-lg text-white text-base flex items-center justify-center"
                style={{ background: 'var(--color-ink)' }}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => agregar(p.id)}
              className="w-8 h-8 rounded-lg text-white text-base"
              style={{ background: 'var(--color-ink)' }}
            >
              +
            </button>
          )}
        </div>
      ))}

      {items > 0 && (
        <div className="fixed bottom-16 left-0 right-0 max-w-sm mx-auto px-5">
          <button
            onClick={confirmarPedido}
            disabled={enviando}
            className="w-full rounded-xl py-3 text-white text-sm font-medium shadow-lg disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {enviando ? 'Procesando...' : `Confirmar pedido — L ${total.toFixed(2)}`}
          </button>
        </div>
      )}

      {mensaje && <p className="text-center text-xs mt-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
    </div>
  )
}
