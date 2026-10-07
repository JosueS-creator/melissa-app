# Promociones dentro de la app

Entrega 2 de la extensión de fidelidad. Costo incremental: **$0** (Postgres/Supabase/Vercel existentes; sin IA,
sin servicios externos). Push **no** está incluido (entrega 3, solo si es compatible y gratuito).

## Qué es

Un beneficio con **título, descripción, % de descuento, fechas de inicio y fin, segmento objetivo, servicio opcional y estado**.
El negocio la crea (pestaña **Promociones**); el cliente la ve dentro de la app; el descuento lo aplica el negocio al cobrar.

- **Segmentos:** los mismos del CRM de la Fase B (todos, nuevos, frecuentes, VIP, inactivos, sin próxima cita, cumpleaños, membresía activa).
  **Una sola definición**: el cálculo de segmentos se extrajo de `crm_clientes` a `crm_calcular(clínica, cliente opcional)` y las promociones lo
  reutilizan (el resumen del negocio y la lista del CRM nunca pueden discrepar; hay una prueba que lo verifica). Los segmentos de 60/90 días de
  inactividad, "con paquete" y "compró cierto producto" **no** se construyen todavía.
- **Estados:** `borrador / activa / pausada` los pone el negocio; **expirada** y **programada** se deducen de las fechas. Por cliente:
  `disponible → vista → utilizada`, o `descartada`.

## Experiencia del cliente (controlada, no invasiva)

- **Un solo aviso** en Inicio por **ventana de N días** (3 por defecto; el negocio la cambia), sea cual sea la promoción. Refrescar no lo repite.
  Si no actuó, tras la ventana se le vuelve a avisar; una vez **vista**, **descartada** o **utilizada**, deja de ser aviso.
- Respeta su preferencia **"Promociones y ofertas"** del Perfil: apagada → sin avisos (la lista sigue disponible).
- **Tus beneficios (N)**: lista plegable con todas las que le corresponden (sin las descartadas ni las expiradas).
- Detalle con descripción, servicio, vigencia y "un uso por cliente"; botones **Reservar ahora** (lleva a Agenda con el servicio elegido; la cita
  queda marcada con la promoción y el negocio lo ve en Citas) y **No mostrar más**. El ✕ del aviso solo lo oculta en esa sesión.
- Si algo falla, la app sigue como si nada.

## Aplicar en un cobro (pestaña Promociones)

El negocio elige al cliente y ve **solo las promociones vigentes, que le corresponden y no ha usado**. El **servidor calcula el descuento**
(% de la promoción × monto) y registra un cobro con descuento y su justificación («<concepto> · Promoción: <título>»).
Una vez por cliente, garantizado por la base (índice único + bloqueo), con **clave de operación** contra doble clic, refresh y reintentos.
`pagos.monto` sigue siendo lo realmente cobrado, así que los totales y el cuadre de Caja no cambian de lógica.

## Seguridad

Los clientes **no leen** la tabla de promociones ni escriben estados: solo usan funciones (`mis_promociones`, `promocion_para_banner`,
`marcar_promocion`) que devuelven lo suyo y **no pueden marcar "utilizada"**. Solo el admin de ese negocio crea, pausa, elimina o aplica.
Una promoción **ya usada no se puede eliminar** (se pausa). Un descuento solo puede existir ligado a un canje o a una promoción
(restricción en la base + sin permiso de escritura directa en `pagos.descuento`).

## Métricas: solo lo que los datos permiten

Por promoción: **pueden recibirla / la abrieron / la descartaron / la usaron**. No se calcula conversión, ingresos ni ROI: no hay datos
suficientes para hacerlo con honestidad (los avisos no se vinculan a visitas).

## Archivos

**Migraciones:** `20261011000001_promociones.sql`, `20261011000002_promociones_un_aviso_por_ventana.sql` (corrige la política del aviso: la regla inicial
era por promoción y al refrescar habría mostrado otra distinta cada vez). **Pruebas:** `supabase/tests/promociones.sql`.
**Código:** `lib/promociones.js`, `components/PromocionesCliente.jsx`, `pages/Promociones.jsx`; modificados `Home.jsx`, `Agenda.jsx`, `AdminPanel.jsx`.

## Pruebas

- Base de datos: **43** comprobaciones (se revierten solas): activa, expirada, futura, borrador, pausada, elegible, no elegible, vista, descartada,
  utilizada, aviso repetido/refresh/ventana, preferencia apagada, multi-clínica, cliente / admin / admin de otra clínica / anónimo, uso único, reintentos.
- Regresión Fase B (46 comprobaciones) tras la refactorización: 45 OK y 1 con un supuesto frágil de la propia prueba (asumía que todas las citas
  existentes eran anteriores a la fase; ya hay una real posterior). Se reemplazó por la garantía real y se verificó contra los datos reales.
- Interfaz: 17 pruebas nuevas (71 en total), fuera del repositorio. Encontraron un defecto real (el mensaje de confirmación se borraba al aplicar).
- **No se probó en un navegador real.** Las suites de canjes y de puntos se repiten al cerrar toda la fase.

## Límites y deuda

- `crm_clientes` pasó de SECURITY INVOKER a SECURITY DEFINER: se pierde la defensa extra de RLS; la autorización es el control explícito `crm_puede_ver` (probado).
- Las promociones no se editan (se crean nuevas o se pausan); no hay "duplicar".
- Anular un cobro con promoción **no libera** la promoción para ese cliente.
- La promoción se reserva desde la app pero el descuento **no se aplica solo**: lo aplica el negocio al cobrar (no hay pago en línea).
- Cliente 360 y su línea de tiempo aún no muestran el uso de promociones.
- No hay recordatorios fuera de la app: eso es el push (entrega 3).
