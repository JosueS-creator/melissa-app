import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

const CATEGORIAS = [
  { id: 'todo', nombre: 'Todo' },
  { id: 'facial', nombre: 'Facial', valores: ['cremas', 'sueros'] },
  { id: 'corporal', nombre: 'Corporal', valores: ['kits'] },
  { id: 'solar', nombre: 'Solar', valores: ['protector_solar'] },
]

export default function Tienda() {
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('todo')
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
      if (nuevaCantidad <= 0) delete copia[id]
      else copia[id] = nuevaCantidad
      return copia
    })
  }

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideTexto = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
      const cat = CATEGORIAS.find((c) => c.id === categoria)
      const coincideCategoria = categoria === 'todo' || cat?.valores?.includes(p.categoria)
      return coincideTexto && coincideCategoria
    })
  }, [productos, busqueda, categoria])

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
    <div className="font-body pb-28" style={{ background: 'var(--color-fondo-app)' }}>
      <div className="px-5 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--color-ink)' }}>Tienda</p>
        {items > 0 && (
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
            style={{ border: '1px solid var(--color-dorado-claro)', color: 'var(--color-primary)' }}
          >
            {items}
          </span>
        )}
      </div>

      <div className="px-5 pt-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar sérum, protector solar..."
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
        />
      </div>

      <div className="px-5 pt-3 flex gap-2 overflow-x-auto">
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(c.id)}
            className="px-4 py-1.5 rounded-full text-xs flex-shrink-0"
            style={
              categoria === c.id
                ? { background: 'var(--gradiente-primario)', color: '#FFFFFF' }
                : { background: '#FFFFFF', color: 'var(--color-ink)', border: '1px solid var(--color-borde-tarjeta)' }
            }
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {productosFiltrados.length === 0 && (
        <p className="px-5 pt-8 text-sm text-center" style={{ color: 'var(--color-texto-secundario)' }}>
          No se encontraron productos.
        </p>
      )}

      <div className="px-5 pt-4 grid grid-cols-2 gap-3">
        {productosFiltrados.map((p) => (
          <div key={p.id} className="rounded-[14px] bg-white overflow-hidden border" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
            <div className="h-24 flex items-center justify-center" style={{ background: '#FDEFF4' }}>
              {p.imagen_url ? (
                <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Foto producto</span>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-[13px]" style={{ color: 'var(--color-ink)' }}>{p.nombre}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p style={{ font: "500 12px/1 var(--font-body)", color: 'var(--color-primary)' }}>L {Number(p.precio).toFixed(0)}</p>
                {carrito[p.id] > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => quitarUno(p.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ border: '1px solid var(--color-dorado-claro)', color: 'var(--color-primary)' }}>−</button>
                    <span className="text-xs" style={{ color: 'var(--color-ink)' }}>{carrito[p.id]}</span>
                    <button onClick={() => agregar(p.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: 'var(--gradiente-primario)' }}>+</button>
                  </div>
                ) : (
                  <button onClick={() => agregar(p.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: 'var(--gradiente-primario)' }}>+</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items > 0 && (
        <div
          className="fixed left-0 right-0 max-w-sm mx-auto px-5"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={confirmarPedido}
            disabled={enviando}
            className="w-full rounded-[10px] py-3 text-white shadow-boton-primario disabled:opacity-50"
            style={{ background: 'var(--gradiente-primario)', font: "500 13px/1 var(--font-body)", letterSpacing: '0.04em' }}
          >
            {enviando ? 'Procesando...' : `Confirmar pedido — L ${total.toFixed(2)}`}
          </button>
        </div>
      )}

      {mensaje && <p className="text-center text-xs mt-4" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
    </div>
  )
}
