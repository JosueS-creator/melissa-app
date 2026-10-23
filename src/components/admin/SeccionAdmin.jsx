/** Presentación compartida. No consulta datos ni interviene en permisos o acciones. */
export default function SeccionAdmin({ titulo, descripcion, children }) {
  return <section className="admin-screen" aria-label={titulo}>
    <header className="admin-encabezado">
      <p className="admin-eyebrow">Panel del negocio</p>
      <h1>{titulo}</h1>
      <p>{descripcion}</p>
    </header>
    {children}
  </section>
}
