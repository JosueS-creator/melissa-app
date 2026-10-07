# FASE B — CRM de clientes (Melissa 1.0)

Objetivo: **entender a cada cliente y saber cuándo volver a contactarlo.** Sin campañas, sin WhatsApp,
sin automatizaciones, sin dashboard comercial completo, sin paquetes ni membresías nuevas.

## 1. Auditoría de datos (antes de crear nada)

| Necesidad | Fuente existente | Resultado |
|---|---|---|
| cliente / clínica | `pacientes.clinica_id` | ok |
| citas | `citas` (estados pendiente/confirmada/completada/cancelada) | ok; **no guardaba cuándo se creó** |
| servicios | `servicios`; `citas.tratamiento` era texto libre | faltaba el vínculo → `citas.servicio_id` |
| pagos | `pagos` (`paciente_id` opcional, sin `cita_id`) | sirve para "total cobrado", no para ligar visita↔pago |
| puntos / recompensas | `puntos_movimientos`, `recompensas` (Fase A) | ok |
| pedidos / productos | `pedidos`, `pedido_items`, `productos` | ok |
| referidos / membresías | `referidos`, `paciente_membresias`, `membresias` | ok (las membresías no tienen pantalla de gestión todavía) |
| email | solo en `auth.users` | → `pacientes.email` (copiado por el servidor) |
| fecha de nacimiento | existía, nunca se capturaba | → opcional en registro y perfil |

Datos reales al auditar: **2 citas, ambas canceladas** (0 visitas). Con datos reales el CRM se verá vacío
hasta que haya uso; por eso se probó con datos de prueba revertibles.

## 2. Definiciones (una sola vez, en SQL: `crm_clientes`)

| Segmento | Definición |
|---|---|
| Nuevos | registrados en los últimos 30 días |
| Frecuentes | 3 o más visitas completadas en los últimos 90 días |
| VIP | nivel Oro o Platino (por puntos) |
| Inactivos / por reactivar | tuvo ≥1 visita completada, **no** tiene cita futura pendiente o confirmada y lleva ≥ `clinicas.dias_inactividad` días (45 por defecto) sin visitar |
| Sin próxima cita | tuvo ≥1 visita completada y no tiene cita futura pendiente o confirmada |
| Cumpleaños del mes | `fecha_nacimiento` en el mes actual (solo quien la registró) |
| Membresía activa | `paciente_membresias` activa y vigente |
| Con paquete activo | **omitido**: los paquetes llegan en la Fase E |

- **Cita futura = pendiente *o* confirmada** en todas las definiciones: un cliente que ya pidió cita no debe aparecer como "por reactivar".
- **Nivel:** `silver / gold / platinum` en BD y código; la pantalla traduce a Plata/Oro/Platino (`lib/fidelidad.js`). Umbrales por negocio en `clinicas.umbral_oro` / `umbral_platino` (800 / 3.200 por defecto, los valores que ya existían). Una sola función, `nivel_por_puntos()`.
- **Clientes recuperados:** cliente cuya cita **completada** se reservó cuando ya llevaba `dias_inactividad` días sin visitar, y se reservó antes o el mismo día de la visita (así el historial importado a posteriori no cuenta). **Se mide desde que existe `citas.creada_at`**: no se reconstruye el pasado porque no hay forma confiable de saber cuándo se agendó cada cita antigua. La pantalla muestra "desde el <fecha>" o "se mide desde la primera cita nueva".
- **Total cobrado:** suma de los pagos de ingreso no anulados registrados **con ese cliente**. Se dice en pantalla que los cobros sin cliente seleccionado no aparecen. No se suman pedidos de la tienda porque no tienen estado de pago real; se muestran aparte como "compras".
- **Línea de tiempo:** construida con `UNION` de las tablas existentes (citas, pagos, pedidos, puntos, referidos, membresías, tratamientos), sin tabla de eventos. No existe evento "cita creada" porque la base no guarda esa fecha en las citas antiguas: la cita aparece con su fecha y estado actual.

## 3. Cambios

**Migraciones** (`supabase/migrations/`, aditivas; no tocan las de la Fase A):
- `20261008000001_fase_b_crm.sql`
- `20261008000002_fase_b_recuperados_excluye_retroactivos.sql` (corrige un defecto que destapó la propia suite de pruebas)

**Tablas nuevas:** ninguna. **Columnas nuevas:** `pacientes.email`; `clinicas.umbral_oro`, `umbral_platino`, `dias_inactividad`; `citas.servicio_id` (nullable, FK compuesta que impide apuntar al servicio de otra clínica), `citas.creada_at` (la fija un trigger; el cliente no puede falsearla).

**Funciones RPC** (todas `SECURITY INVOKER`: la RLS sigue protegiendo cada tabla, y además validan que seas admin del negocio o super admin): `crm_clientes`, `crm_resumen`, `crm_cliente_360`, `crm_cliente_timeline`, `crm_puede_ver`, `nivel_por_puntos`. Revocadas para `anon`.
Una llamada por pantalla: la lista y los indicadores salen de una sola consulta agregada (sin N+1).

**RLS:** no se cambiaron políticas. `pacientes.email` queda fuera de los permisos de edición del cliente (el email viene de `auth`). Los clientes antiguos sin cuenta quedan con `email` nulo.

**Registro:** el trigger guarda el email (tomado de `auth.users` en el servidor, nunca desde el navegador) y la fecha de nacimiento opcional; una fecha inválida o futura no impide registrarse.

**Frontend:** `lib/crm.js`, `lib/fidelidad.js` (fuente única de niveles), `components/NivelBadge.jsx`, `pages/Crm.jsx`, `pages/Cliente360.jsx`, `pages/ClientesReactivar.jsx`; modificados `AdminPanel.jsx` (el CRM reemplaza la lista de clientes anterior; se conservan el escáner de QR y el historial antes/después; nueva pestaña **Por reactivar**; nueva cita guarda `servicio_id`), `Agenda.jsx`, `Registro.jsx`, `Perfil.jsx`, `Home.jsx`, `TarjetaVIP.jsx`, `auth.js`.

## 4. Pruebas

- `supabase/tests/fase_b_crm.sql`: 46 comprobaciones contra la base real con datos de prueba que se revierten solos. Cubre admin, cliente, super admin y anónimo; cliente sin citas / con citas / sin pagos / con puntos / sin puntos / sin email / sin fecha de nacimiento / con múltiples compras / inactivo / con cita futura; registro; claves foráneas; `creada_at`; umbrales.
- Prueba de humo de la interfaz (18 pruebas con datos simulados, **fuera del repositorio** para no agregar dependencias): segmentos, búsqueda, orden, abrir Cliente 360, volver, caso vacío, caso de error, filtros 45/60/90, niveles.
- **No se probó en un navegador real ni con el sitio desplegado.**

## 5. Deuda técnica restante

- GitHub y Vercel siguen en la versión anterior hasta que se suba el zip (que contiene Fase A + Fase B).
- `crm_clientes` devuelve todos los clientes del negocio en una llamada (bien hasta algunos miles); paginar si un negocio crece más.
- El super admin puede consultar el CRM de cualquier negocio por la API, pero no hay pantalla para hacerlo.
- Sin pantalla para editar `umbral_oro`, `umbral_platino` ni `dias_inactividad` (Fase F y Fase C).
- Citas anteriores a esta fase tienen `creada_at` y `servicio_id` nulos (no se inventó historia ni se vinculó por nombre).
- `dias_inactivo` se calcula con la fecha del servidor (UTC): ±1 día frente a la hora local.
- El saldo de puntos aún se suma en el navegador en Home, Perfil, TarjetaVIP y Admin (Fase F).
- El bundle sigue siendo uno solo (~650 KB); división por rutas pendiente.
- `Cumpleaños del mes` mostrará pocos clientes hasta que registren su fecha.

## 6. Cómo verificar en el navegador (tras subir el zip)

1. Registrar un cliente nuevo por el link `/<slug>` con fecha de nacimiento; en el panel, abrirlo: debe tener email y fecha.
2. Como admin: **Clientes** → indicadores, segmentos, búsqueda y orden.
3. Agendar una cita desde el panel con un servicio, completarla y abrir el **Cliente 360**: última visita, servicio, línea de tiempo.
4. Asignar puntos con el escáner y comprobar nivel y movimientos.
5. Probar **Por reactivar** con los filtros 45+/60+/90+ (requiere clientes con visitas antiguas).
6. Como cliente: no ver ninguna pestaña del panel; Perfil muestra y guarda la fecha de nacimiento.
7. Canje de puntos y compra en la Tienda (cambios de la Fase A).

## 7. Estado
Implementada y verificada en base de datos y en pruebas de interfaz. **No se declara cerrada** hasta completar la verificación 6 en el sitio desplegado.
