/** Cabecera compacta (solo móvil): saludo breve, título de la sección activa y el plan. Las acciones de cuenta están en «Más». */
export default function CabeceraAdmin({ nombre, titulo, plan }) {
  return (
    <header className="lg:hidden flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        {nombre && <p style={{ fontSize: 13, lineHeight: 1.3, color: 'var(--admin-texto-2)' }}>Hola, {nombre}</p>}
        <h1 className="truncate" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 24, lineHeight: 1.15, color: 'var(--admin-texto)' }}>{titulo}</h1>
      </div>
      {plan && (
        <span className="flex-none rounded-full" style={{ padding: '4px 10px', background: 'var(--admin-superficie)', border: '1px solid var(--admin-borde)', font: '500 12px/1.2 var(--font-body)', color: 'var(--admin-texto-2)' }}>
          Plan {plan}
        </span>
      )}
    </header>
  )
}
