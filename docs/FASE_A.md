# FASE A — Auditoría y correcciones de arquitectura (Melissa 1.0)

## 1. Diagnóstico (código real + base real)

**Código:** 4.940 líneas JS/JSX, un solo bundle (~640 KB). `AdminPanel.jsx` tiene 1.762 líneas y 12
componentes. Navegación por estado en `App.jsx`. Sin hooks propios ni capa de servicios: cada pantalla
consulta Supabase directamente.

**Estado de cada capacidad**

| Capacidad | Estado |
|---|---|
| Registro/login/recuperación, citas, agenda con servicios, historial con fotos, tienda, tarjeta con QR, caja, panel admin, super admin, theming por negocio | Implementado |
| Referidos | **Parcial/visual**: se genera un código y se registra una invitación, pero nada vincula al nuevo cliente con el código ni otorga puntos |
| Membresías (`membresias`, `paciente_membresias`) | **Solo tablas**: existen y tienen datos de ejemplo, ninguna pantalla las usa. "Plata/Oro/Platino" del código son niveles por puntos, no estas membresías |
| Wallet (`wallet_movimientos`) | **Solo tabla**: la tienda marca `wallet` como método de pago pero no hay saldo |
| Paquetes de tratamientos, CRM, segmentos, inactivos, campañas, dashboard comercial | **No existe** |
| Cumpleaños | `pacientes.fecha_nacimiento` existe, **ninguna pantalla la captura** |
| Email del cliente | No está en `pacientes` (solo en `auth.users`, inaccesible desde el navegador) |
| Roles | `perfiles.rol` ∈ {paciente, especialista, admin}; solo se usa `admin`. No hay recepción |

**Duplicaciones / deuda técnica**
- El saldo de puntos se calcula en 6 lugares con `reduce` en el navegador (uno es código sin uso).
- Dos sistemas de niveles con nombres distintos (`silver/gold/platinum` en BD vs `plata/oro/platino` en código); umbrales y recompensas fijos en código.
- `lib/beautyScore.js` y `components/BeautyScore.jsx` no se usan.
- `productos.categoria` solo admite 5 categorías de estética (limita salones de uñas).
- README desactualizado (decía que `.env.example` y `.gitignore` existían; no existían).

**Datos que NO permiten ciertas métricas hoy**
- `pagos` no tiene `cita_id`: no hay relación confiable visita↔pago. **"Ingresos recuperados" no se puede calcular**; la métrica inicial es "Clientes recuperados".
- `pagos.paciente_id` es opcional: el gasto acumulable por cliente depende de que el negocio lo seleccione al cobrar.
- `citas.tratamiento` es texto libre (no `servicio_id`).

## 2. Hallazgos de seguridad (comprobados contra la base real)

Se ejecutaron ataques como un cliente real, dentro de un bloque que se revierte solo (sin cambios en datos):

| # | Hallazgo | Antes | Después |
|---|---|---|---|
| 1 | Cliente se asigna `rol=admin`, `es_super_admin=true` y cambia de `clinica_id` (ve datos de otra clínica) | **Permitido** | Bloqueado |
| 2 | Cliente se inserta +99.999 puntos | **Permitido** | Bloqueado |
| 3 | Cliente baja a L 0,01 el precio de todos los productos | **Permitido** (5 filas) | 0 filas |
| 4 | Cliente crea una cita ya "completada" en el pasado (falsea visitas/frecuencia) | **Permitido** | Bloqueado |
| 5 | Pedido con total/precios elegidos por el navegador | Posible | Calculado en el servidor |
| 6 | Servicios/productos/especialistas/membresías: cualquier miembro (también clientes) escribe | Posible | Solo admin |
| 7 | El admin no veía productos/servicios ocultos (el botón "Reactivar" nunca aparecía) | Bug | Corregido |
| 8 | "Bloquear negocio" nunca funcionó (la fila desaparecía de la vista y Postgres rechazaba el cambio) y la pantalla "Acceso suspendido" no podía mostrarse | Bug | Corregido |
| 9 | El admin podía cambiar su propio `plan` | Posible | Solo super admin |
| 10 | Registro sin negocio caía silenciosamente en la clínica `demo` | Posible | Rechazado; tampoco se registra en negocios bloqueados |
| 11 | `generar_invitacion_admin` seguía ejecutable por `anon` (el revoke anterior no quitaba el permiso heredado de PUBLIC; la función se protegía por dentro) | Abierto | Cerrado |

Aislamiento entre clínicas medido: un cliente o admin de la clínica A ve **0** filas de la B.
Storage: `fotos-tratamientos` ya estaba correcto (carpeta de su negocio + su paciente).

## 3. Cambios de la fase

**Migraciones** (`supabase/migrations/`): `…01_fase_a_seguridad_rls`, `…02_fase_a_clinicas_visibles_bloqueo_funcional`, `…03_fase_a_cerrar_funciones_de_trigger`.

**Código:** `lib/tenant.js` (nuevo), `App.jsx`, `lib/auth.js`, `pages/Registro.jsx`, `pages/TarjetaVIP.jsx`, `pages/Tienda.jsx`, `pages/Personalizacion.jsx`; `vercel.json`, `.gitignore`, `.env.example`, README.

**Decisiones de producto**
- Un negocio no tiene "cliente por defecto": sin link/QR no hay registro.
- Los links de cliente pasan a `https://<dominio>/<slug>` (los `?clinica=` siguen funcionando).
- Las recompensas pasan a una tabla por negocio, sembrada con las 3 actuales; la pantalla para editarlas va en la FASE F.

## 4. Pendiente / límites conocidos

- "Bloquear" corta el acceso en la app y el registro, pero **no** en la API (un usuario técnico de un negocio bloqueado podría seguir llamándola). Endurecer en FASE J.
- Cliente puede seguir agregando su propio "registro de progreso" con fotos; se rediseña con consentimiento en la FASE I.
- Código de referido derivado del nombre + id (predecible); se reemplaza por token propio en la FASE G.
- El QR contiene solo el identificador opaco del cliente (sin datos personales) pero es estático; un token rotativo queda para FASE J.
- `pedidos` no descuentan stock ni hay pago real (`wallet` es un marcador).
- Los negocios nuevos nacen sin recompensas hasta la FASE F.
- Sin pruebas automatizadas en el repo (las pruebas de seguridad se ejecutaron contra la base y están descritas arriba).

## 5. Siguiente
FASE B — CRM de clientes + Perfil 360.
