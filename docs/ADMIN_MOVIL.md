# Panel administrativo · rediseño móvil

Alcance: experiencia móvil del panel de cada clínica (y las tarjetas de Citas en todos los anchos). Escritorio conserva su barra lateral. **Sin cambios en base de datos, consultas, RLS, RPC, autenticación ni reglas de negocio.**

## Qué cambió
| Archivo | Cambio |
|---|---|
| `pages/AdminPanel.jsx` | Contenedor `.panel-admin`; cabecera compacta; la fila de pestañas se reemplaza (solo < 1024 px) por navegación inferior + hoja «Más»; `PanelCitas` usa resumen, botón principal y tarjetas nuevas con **los mismos datos y las mismas acciones** |
| `components/admin/*` (nuevos) | `CabeceraAdmin`, `NavInferior`, `HojaMas`, `ResumenDelDia`, `TarjetaCita`, `Candado` |
| `lib/temaAdmin.js` (nuevo) | La paleta metálica y la regla de cuándo se aplica (un solo lugar) |
| `lib/aplicarTema.js` | Inyecta `--tema-admin-*` (y limpia lo de la clínica anterior) + texto de botones por contraste |
| `index.css` | Variables `--admin-*` y estados `--adm-*` acotadas a `.panel-admin`; animación de la hoja solo sin «movimiento reducido» |

## Sistema de colores (configurable, no colores sueltos)
Los componentes solo usan `--admin-fondo · superficie · borde · plata · acero · acero-2 · accion · accion-2 · detalle · texto · texto-2 · sobre-accion` (y `--adm-pendiente|confirmada|completada|cancelada`). Cada variable se resuelve así:
1. Token `admin_*` del tema (`temas_base.tokens`) → personalización por tema desde la base, sin tocar código.
2. Paleta metálica de Melissa → **solo** tema «Rosa y Oro» y **solo** si la clínica no definió colores propios.
3. Si no, se **deriva de las variables normales del tema** (`--color-primary`, `--color-fondo-oscuro`, `--color-ink`…): una clínica con identidad propia nunca recibe colores de Melissa. Si la clínica eligió su color principal, las acciones usan ese color.

El texto de los botones de acción (blanco u oscuro) se calcula por contraste con el color de acción de cada clínica. Cuando quieras mover la paleta metálica a la base, agrega los tokens `admin_*` al tema y borra el mapa de `temaAdmin.js`; no cambia ningún componente.

Contrastes calculados (paleta metálica): texto 13,35:1 · texto secundario 4,61:1 · blanco sobre azul acero 15,23:1 · blanco sobre ciruela 15,12:1 · estados de cita 4,8 a 5,0:1 (antes «pendiente» 3,12:1 y «completada» 3,72:1). El **dorado `#B59A60` es solo detalle** (2,71:1 sobre blanco), nunca texto.

## Navegación móvil
`Citas · Clientes · Más` (barra inferior fija). «Más» abre un diálogo accesible (Escape, foco atrapado y devuelto, fondo que cierra) con Por reactivar, Canjes (con su contador), Promociones, Empleados, Servicios, Productos, Caja y Marca, y la sección **Cuenta** (Panel de Melissa solo para super admin, Mis datos, Salir). Mismos ids, mismo `setTab` y mismo control por plan: las secciones no incluidas llevan candado y abren el aviso de plan. El contador de canjes pendientes también aparece sobre «Más».

## Diferencias con tu descripción (y por qué)
- **Figma no se pudo ver** (el sitio bloquea el acceso automático y no hay herramienta de Figma conectada): se trabajó con la descripción textual. Falta comparar con una captura de la pantalla.
- **No hay sección «Inicio»**: la entrada es Citas. Crear otra sería duplicar navegación; por eso la barra es Citas · Clientes · Más.
- **Resumen del día** muestra solo dos cifras reales, calculadas con las citas ya cargadas (sin consultas nuevas): citas de hoy (sin canceladas) y pendientes desde hoy. «Ver agenda» desplaza a la lista.
- La paleta metálica no se guardó como tema en la base (prohibido en esta tarea): vive en `temaAdmin.js`.
- Las demás secciones (Clientes, Canjes, Promociones, Empleados, Servicios, Productos, Caja, Marca) **conservan su diseño interno**; solo cambia el marco (cabecera y navegación). Siguiente fase propuesta: rediseñar sus tarjetas con las mismas variables.

## Pruebas
`test/admin-movil.test.jsx` (32): colores y aislamiento entre clínicas, navegación, «Más», permisos por plan y rol, resumen, tarjetas, acciones y errores, consultas filtradas por clínica. Verificación visual con navegador sin interfaz a 320, 360, 390, 430 y 1280 px (sin desborde horizontal ni errores de consola).
