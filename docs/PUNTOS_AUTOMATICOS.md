# Puntos automáticos y asistente "Sugerir puntos"

Entrega 1 de la extensión de fidelidad. Costo incremental: **$0** (solo React, Supabase y Vercel que ya existen;
sin IA, sin APIs externas, sin servicios de pago).

## Puntos automáticos

El negocio define `puntos_otorga` en cada **producto** y cada **servicio** (0 = no otorga). Los puntos se
abonan solos al libro mayor (`puntos_movimientos`, que sigue siendo la fuente histórica) en tres momentos:

| Momento | Quién lo dispara | Puntos |
|---|---|---|
| Una cita **pasa a "completada"** | trigger de la base (sin importar por qué pantalla se complete) | `puntos_otorga` del servicio de la cita |
| **Venta por escáner** en Caja con un cliente elegido | `registrar_venta_producto()` | `puntos_otorga` × cantidad |
| Pedido de la **tienda pasa a "entregado"** | `completar_pedido()` (botón "Marcar entregado" en Caja) | Σ (cantidad × `puntos_unitarios`) |

- **Nunca por crear una cita** ni por crear un pedido.
- **Idempotencia en Postgres**: cada abono automático guarda su origen (`cita` / `venta` / `pedido` + id) y un
  **índice único** impide un segundo abono del mismo origen: doble clic, refresh, reintento, error de red o
  volver a cambiar el estado (completada → confirmada → completada) no duplican puntos.
- La venta por escáner usa una **clave de operación** (una por venta): reintentar con la misma clave devuelve la
  misma venta, sin duplicar pago ni puntos. El servidor calcula el **precio** (el navegador ya no lo envía).
- Los pedidos guardan los **puntos vigentes al pedir** (`pedido_items.puntos_unitarios`): si el catálogo cambia
  antes de entregarlo, se respeta lo que el cliente vio al comprar.
- Cambiar el catálogo **no toca el historial**; la siguiente operación usa el valor vigente.
- Producto/servicio no editables antes: ahora los puntos se pueden **definir al crear y editar** (edición en línea).

## Valor de referencia del punto (única fuente de verdad)

`clinicas.valor_punto` (por negocio, valor inicial **0.10**). No existe ningún `0.10` fijo en el código.
Solo alimenta las sugerencias: cambiarlo **no modifica** puntos históricos ni los puntos ya definidos en productos
o servicios. El administrador de su negocio lo cambia desde el propio asistente; los clientes no pueden.

## Asistente "✨ Sugerir puntos" (dentro del formulario, sin pantalla aparte)

Cálculo determinista (`src/lib/sugerirPuntos.js`), "sugerencia basada en los datos que ingresaste":

```
margen estimado = precio − costo aproximado
presupuesto     = margen × % destinado a fidelización   (5 % conservador · 10 % balanceado · 15 % agresivo · personalizado 1–100 %)
puntos          = presupuesto ÷ valor de referencia del punto   → redondeo "mitad hacia arriba" (173.5 → 174, 173.4 → 173)
```

Ejemplo: precio L500, costo L300 → margen L200 → 10 % = L20 → ÷ 0.10 = **200 puntos**.
- Margen **cero** → 0 puntos: «No existe margen disponible para destinar a fidelización.»
- Margen **negativo** → no se recomienda nada: «El costo supera el precio de venta. Melissa no puede recomendar puntos con estos datos.»
- Un costo vacío **no** se toma como costo cero. Los puntos nunca son negativos ni decimales.
- Botones: **Usar N puntos** / **Modificar** (el administrador conserva el control del número).
- **El costo no se guarda**: `productos` y `servicios` son legibles por los clientes, y guardarlo expondría el margen del negocio. Solo se usa para calcular.
- En servicios se habla de "costo aproximado" y "margen estimado", nunca de "ganancia neta".

## Archivos

**Migración:** `supabase/migrations/20261010000001_puntos_automaticos.sql` · **Pruebas:** `supabase/tests/puntos_automaticos.sql`
**Código:** `lib/sugerirPuntos.js`, `lib/puntos.js`, `components/SugerirPuntos.jsx`, `components/PuntosCatalogo.jsx`; modificado `AdminPanel.jsx`
(formularios y listas de servicios/productos, venta por escáner, pedidos por entregar y aviso de puntos al completar una cita).

## Pruebas

- Base de datos: 34 comprobaciones contra la base real (se revierten solas): servicio/producto con y sin puntos, varias
  unidades y productos, compra, servicio completado, doble intento, refresh, reintento, cambios posteriores del catálogo,
  cliente / admin / admin de otra clínica / anónimo, valor del punto.
- Interfaz: 24 pruebas del asistente y de los campos (incluye una prueba de propiedades con 2 000 casos al azar: siempre entero,
  nunca negativo, mismo resultado con los mismos datos), fuera del repositorio.
- **No se probó en un navegador real.** La suite de la Fase B y la de canjes se repiten al cerrar toda la fase.

## Límites conocidos

- Las citas anteriores sin `servicio_id` (solo texto) no otorgan puntos: no se adivina el servicio.
- Volver una cita a otro estado, o anular un cobro de Caja, **no devuelve** puntos ya otorgados.
- Los ingresos manuales de Caja (aunque sean de tipo producto) no otorgan puntos: solo la venta por escáner y la tienda.
- Una venta por escáner sin cliente no suma puntos (queda dicho en pantalla).
- La venta por escáner y la tienda siguen sin descontar stock.
- Las pantallas del administrador usan "L" fijo en varios textos antiguos; el asistente usa la moneda del negocio.
