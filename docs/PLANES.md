# Planes de suscripción y funciones

Tres planes: **Starter**, **Pro** y **Clinic+**. Cada plan desbloquea funciones; el servidor **bloquea de verdad** lo que el plan no incluye y la app lo refleja.

## Qué incluye cada plan
Fuente de las funciones por plan: la web de Melissa (`Melissa-Web/src/pages/Clinica.jsx`). Lo que la web no menciona (marcado *) lo asignó Claude con un criterio: **Starter opera el negocio, Pro lo hace crecer, Clinic+ suma sucursales**. Cambiarlo es una línea de SQL (ver abajo).

| Función (clave) | Starter | Pro | Clinic+ | Dónde se nota |
|---|:-:|:-:|:-:|---|
| Agenda y reservas (`agenda`) | ✓ | ✓ | ✓ | Citas (panel) · Agenda (cliente) |
| Clientes (`clientes`) | ✓ | ✓ | ✓ | Clientes y perfil 360 |
| Empleados (`empleados`), Servicios (`servicios`) | ✓ | ✓ | ✓ | Panel |
| Historial con antes/después (`historial`) | ✓ | ✓ | ✓ | Progreso del cliente |
| Beauty Points (`fidelizacion`) | ✓ | ✓ | ✓ | Puntos y saldo |
| Marca (`marca`) | ✓ | ✓ | ✓ | Logo y colores |
| Tienda integrada (`tienda`) | | ✓ | ✓ | Productos (panel), Tienda y «Para ti» (cliente) |
| Niveles Plata/Oro/Platino (`membresias`) | | ✓ | ✓ | Nivel y progreso (cliente) |
| Recompensas y canjes (`canjes`)* | | ✓ | ✓ | Canjes (panel y cliente) |
| Programa de referidos (`referidos`) | | ✓ | ✓ | Referidos (cliente) |
| Caja y reportes (`caja`) | | ✓ | ✓ | Caja (panel) |
| Promociones (`promociones`)* | | ✓ | ✓ | Promociones y avisos |
| Clientes por reactivar (`reactivacion`)* | | ✓ | ✓ | Por reactivar + WhatsApp asistido |
| Varias sucursales (`sucursales`) | | | ✓ | **No construido todavía** |
| Soporte prioritario (`soporte_prioritario`) | | | ✓ | No es software |

\* Criterio de Claude: *canjes* depende de Caja (el descuento se aplica allí); *promociones* y *reactivación* son herramientas de crecimiento.

## Cómo funciona
1. **Base de datos (fuente de verdad):** tabla `plan_funciones` (plan → funciones). `clinicas.plan` ya existía (`starter` · `pro` · `clinic_plus`). Solo Super Administración cambia el plan (un trigger lo exige).
2. **Servidor:** 17 funciones de los módulos Pro empiezan con `exigir_funcion(...)` y cortan con «Tu plan no incluye esta función»; 12 tablas tienen una política *restrictiva* (se suma a las existentes; el super admin queda fuera del bloqueo).
3. **App:** `funciones_de_mi_clinica()` entrega el plan y las funciones; `lib/FuncionesContext.jsx` las reparte. El **administrador** ve las pestañas no incluidas con un candado y, al abrirlas, un aviso con su plan y desde cuál está disponible. El **cliente** simplemente no ve lo que no está incluido (sin mensajes de venta). Si la consulta falla, no se desbloquea nada.

Funciones del servidor protegidas: `crear_pedido`, `completar_pedido` (tienda) · `registrar_venta_producto`, `anular_pago` (caja) · `solicitar_canje`, `cancelar_canje`, `rechazar_canje`, `aplicar_canje` (canjes) · `mis_promociones`, `promocion_para_banner`, `marcar_promocion`, `promociones_resumen`, `promociones_aplicables`, `aplicar_promocion` (promociones) · `reactivacion_oportunidades`, `reactivacion_resumen`, `registrar_contacto_reactivacion` (reactivación).
Tablas: `productos`, `pedidos` (tienda) · `referidos` · `promociones`, `promocion_clientes` · `recompensas`, `canjes` · `crm_reactivaciones` · `pagos`, `claves_supervisor` (caja) · `membresias`, `paciente_membresias`.

## Operación
- **Cambiar el plan de un negocio:** Panel de Melissa → selector «Plan» de cada negocio (o al crearlo).
- **Mover una función de plan** (sin tocar código): `delete from plan_funciones where funcion = 'promociones' and plan = 'starter';` o `insert into plan_funciones values ('starter', 'promociones');`. Si agregas una función nueva, también va su etiqueta en `lib/planes.js` (una prueba exige que coincidan).
- **Al bajar de plan** los datos se conservan; solo quedan bloqueados. Al volver a subir, reaparecen.
- La **Clínica Demo** está en `clinic_plus` (para mostrar todo en las demostraciones).

## Pruebas
`supabase/tests/planes.sql` (19 comprobaciones: cada plan, las 17 funciones, tablas, cambio de plan, permisos). Las pruebas SQL anteriores ahora activan su negocio y le dan el plan completo al inicio (dentro de la prueba, se revierte). Interfaz: `planes.test.jsx` (22).

## Límites conocidos
- No hay **precios** de los planes en el app ni en la base; la web tampoco los muestra.
- `generar_codigo_referido` no tiene guardia propia (es una función simple); queda cubierta por la tabla `referidos` y porque la pantalla no se ofrece sin plan.
- No se revisó si el CRM / Cliente 360 del administrador muestra el nivel Plata/Oro/Platino en Starter: hoy no está condicionado.
- La web de marketing todavía no menciona promociones, reactivación ni canjes en los planes.
