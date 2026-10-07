# Canjes con aprobación del negocio y descuento justificado en Caja

Adelanto de la Fase F, pedido por el dueño del producto tras probar el canje: el cliente descontaba
puntos al instante, el negocio no veía ni aprobaba nada y Caja no sabía del descuento.

## Requisitos (decisiones tomadas)

1. El cliente **solicita** el canje desde su Tarjeta. Queda **Pendiente** con un código corto de 5 caracteres.
2. Los puntos se **reservan al solicitar** (no se pueden gastar dos veces) y se **devuelven** si el negocio rechaza o el cliente cancela.
3. El negocio ve las solicitudes en la pestaña **Canjes** (con contador de pendientes) y puede **aprobar y aplicar en Caja** o **rechazar** (el motivo es obligatorio y lo ve el cliente).
4. Al aprobar se registra **un cobro en Caja** con: monto total del servicio o venta, descuento por canje, y la **justificación** (`<concepto> · Canje <código>: <recompensa>`). Si la recompensa tiene valor fijo (p. ej. "L 100 de descuento"), el descuento no puede superarlo; si no lo tiene (p. ej. "servicio gratis"), lo define quien aprueba.
5. **`pagos.monto` pasa a significar lo realmente cobrado**; el descuento va en su propia columna (bruto = monto + descuento). Por eso los totales y el cuadre de efectivo de Caja no cambian de lógica.
6. **Un descuento solo puede existir ligado a un canje aprobado**: lo exige la base (restricción `pagos_descuento_con_canje` y permisos por columna), no solo la pantalla.
7. Todo queda auditado: estado (`pendiente → aplicado / rechazado / cancelado`), quién lo resolvió, cuándo y con qué cobro. Nada se borra.

## Cambios

**Migración:** `supabase/migrations/20261009000001_canjes_con_aprobacion.sql`
- Tabla `canjes` (RLS: el cliente ve los suyos, el admin los de su negocio, el super admin todos; nadie escribe desde la API).
- Columnas: `recompensas.valor_descuento`, `pagos.descuento`, `pagos.canje_id`, `puntos_movimientos.canje_id`.
- Funciones: `solicitar_canje`, `cancelar_canje` (cliente) · `aplicar_canje`, `rechazar_canje` (admin de ese negocio).
- Se **elimina `canjear_recompensa()`**: no debe existir ninguna vía de canje sin aprobación.
- `crm_cliente_360`: "Recompensas canjeadas" cuenta solo canjes aplicados; los pendientes se muestran aparte.

**Frontend:** `pages/Canjes.jsx` (nuevo), `AdminPanel.jsx` (pestaña + contador, Caja muestra el descuento y lo exporta en el CSV), `TarjetaVIP.jsx` ("Mis canjes", solicitar y cancelar), `Cliente360.jsx`.

## Pruebas

- `supabase/tests/canjes_con_aprobacion.sql`: 35 comprobaciones contra la base real (se revierten solas): solicitar/cancelar/rechazar/aprobar, puntos reservados y devueltos, permisos de cliente / admin / admin de otra clínica / anónimo, validaciones del descuento, servicio 100 % canjeado (cobro de 0), imposibilidad de escribir descuentos directo, matemática de Caja.
- Regresión: la suite de la Fase B (46 comprobaciones) se repitió después de reemplazar `crm_cliente_360`: 46/46.
- Interfaz: 12 pruebas con datos simulados (Canjes y Tarjeta), fuera del repositorio.
- **No se probó en un navegador real.**

## Límites conocidos

- Anular un cobro de Caja que tiene descuento **no devuelve los puntos** (la pantalla lo avisa); hay que ajustarlos aparte.
- Los costos y valores de las recompensas siguen siendo los sembrados; la pantalla para administrarlos es el resto de la Fase F. El canje guarda una copia del nombre y los puntos al solicitarlo.
- No se pide clave de supervisor para aplicar un descuento (sí para anular un cobro).
- Las compras de la Tienda no admiten canje todavía (el descuento se aplica en cobros de Caja).
- El CSV de Caja cambió: la última columna se llama "Monto cobrado" y hay una columna nueva "Descuento por canje".
- Mientras el sitio desplegado tenga el código anterior, el botón de canje del cliente falla (la función antigua ya no existe). Se arregla al subir este zip.
