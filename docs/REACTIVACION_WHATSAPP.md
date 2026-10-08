# Fase C · Reactivación asistida por WhatsApp

Costo incremental: **$0**. La única integración con WhatsApp es un enlace `wa.me` que abre el administrador.
Sin WhatsApp Business API, sin envío automático, sin IA, sin servicios externos, sin PWA ni push.

## Idea

Melissa encuentra clientes que podrían volver, los prioriza, explica por qué, prepara un mensaje (editable) y abre WhatsApp.
**Melissa no envía nada y no sabe si se envió.** Lo único que registra es que el administrador inició un contacto.

## Flujo del administrador

1. En **Clientes** aparece la tarjeta *Clientes por reactivar* («Personas que podrían volver a reservar») → **Ver oportunidades**.
2. La pestaña **Por reactivar** muestra las oportunidades de prioridad **alta y media**; la **baja** está plegada. Cada una dice última visita,
   motivos, prioridad, si hay teléfono y la promoción vigente que le corresponde (si la hay).
3. **Preparar WhatsApp** → caja de texto con el mensaje, editable; la promoción es **opcional** (casilla); avisos si el tono suena a spam.
4. **Copiar mensaje** (no registra nada) o **Abrir WhatsApp** (registra *contacto iniciado* y abre `wa.me` con el texto).
5. El cliente sale de la lista 30 días. Si ya se usaron los contactos del día, la base lo impide y dice cuándo se libera.

## Quién es una oportunidad (sin segunda definición)

Se reutiliza `crm_calcular(...).es_inactivo` (≥1 visita completada, sin cita futura pendiente/confirmada, ≥ `dias_inactividad` días).
Además deben cumplirse: **no** estar en pausa de contacto (30 días) y **no** haber apagado «Promociones y ofertas».
Sin teléfono utilizable aparecen aparte («Sin teléfono utilizable») y **sin botón**. Todo se decide en el servidor (`reactivacion_base`).

## Prioridad (sencilla, explicable, solo datos reales)

Puntos: visitas (3 o más: +2 · 2: +1 · 1: 0) · historial de consumo registrado (+1) · lleva ≥ 2× el umbral de inactividad (+1) ·
tiene promoción vigente que le corresponde (+1). **Alta ≥ 3 · Media = 2 · Baja ≤ 1.** Orden: puntos, visitas, días sin volver.
Cada fila muestra los motivos en texto. No hay ningún scoring oculto.

## Protección de contacto (protecciones de Melissa, no límites oficiales de WhatsApp)

Melissa limita las acciones de reactivación **para reducir el riesgo de contacto excesivo**. Son protecciones preventivas de Melissa:
**no** son un límite seguro ni oficial de WhatsApp y **no** prometen que WhatsApp no restringirá una cuenta. Eso no se puede garantizar.

| Control | Cómo |
|---|---|
| Límite diario | 30 contactos iniciados por negocio en una ventana móvil de 24 h. Servidor; bloqueo por clínica (`pg_advisory_xact_lock`) → varios administradores o clics simultáneos no lo saltan |
| Cooldown | 30 días por cliente; no configurable por el negocio; sale de la lista y el servidor rechaza el registro |
| Selección | prioridad alta/media primero; la baja, plegada; «menos contactos, mejor seleccionados» |
| Exclusiones | con cita futura, sin historial, sin teléfono utilizable, no desea promociones, en pausa |
| Registro | `crm_reactivaciones` (sin el texto del mensaje) |
| Sin automatización | no hay envío ni selección masiva; cada contacto lo abre una persona |

Las constantes (30 · 30 · 60) viven en tres funciones SQL (`reactivacion_limite_diario`, `_cooldown_dias`, `_ventana_regreso_dias`).
El cooldown **no** reutiliza `promo_frecuencia_dias` porque es otra cosa (aviso dentro de la app, configurable por el negocio).

## Concurrencia (revisada)

`registrar_contacto_reactivacion` es VOLATILE y toma un bloqueo transaccional **por clínica** (`pg_advisory_xact_lock`) **antes** de validar cooldown y límite
(hay una prueba que lo comprueba). Quien llega segundo espera, y al seguir ve lo que el primero ya confirmó. Resultado: dos administradores de la misma clínica,
dos clics, dos solicitudes casi simultáneas o un refresh/reintento nunca superan los 30 de 24 h ni contactan dos veces al mismo cliente (el segundo recibe
`en_cooldown`). El frontend solo deshabilita el botón mientras procesa; no es la protección. No se hizo una prueba de carga: no hace falta con este diseño.
Límite de la verificación: se probó la secuencia y la estructura, no una ejecución con dos conexiones simultáneas reales.

## Honestidad

El evento se llama `contacto_iniciado` (la base no admite otro valor). La interfaz nunca dice «enviado», «recibido», «leído» ni «cliente contactado».
La línea de tiempo del Cliente 360 dice: «Se inició un contacto por WhatsApp… (no se sabe si se envió el mensaje)».

## Teléfonos (no se adivina)

`telefono_whatsapp(telefono, pais)`: con `+` o `00` se respeta el código escrito; sin código solo se completa si el cliente tiene país conocido
(HN: 8 dígitos → 504 · ES: 9 dígitos → 34). Todo lo demás → sin botón. No se modifica ningún teléfono guardado.

## Medición (solo desde que existe la función)

`reactivacion_resumen()`: contactos iniciados, oportunidades por prioridad, en pausa, no desean promociones, sin teléfono, clientes con cita
posterior, **clientes que regresaron después del contacto** y promociones usadas después. No hay mensajes enviados/leídos/respondidos, ni
conversión de WhatsApp, ni ingresos atribuidos, ni ROI. **Nunca se dice «WhatsApp recuperó al cliente»**: solo «regresó después del contacto».

**Definición de «regresó después del contacto»** (temporal y objetiva). Existió antes un `contacto_iniciado` y, después, una cita que cumple las tres:
1. es **nueva**: se creó en Melissa después del contacto (una cita que ya existía antes no cuenta);
2. la **visita ocurrió después del contacto** (`fecha_hora` ≥ momento del contacto): un registro retroactivo de una visita anterior no cuenta;
3. está **completada** y la visita ocurrió dentro de la ventana de medición (60 días).

Un cliente cuenta **una sola vez**, aunque tenga varias citas o varios contactos. Copiar el mensaje, abrir la pantalla o preparar el mensaje **no** crean contacto:
solo «Abrir WhatsApp» lo registra (las funciones de lectura son STABLE y sin escrituras; hay pruebas).

### La ventana de 60 días es una decisión inicial de medición
No es una verdad sobre cuánto tarda un cliente en volver: es un corte para no atribuir visitas lejanas. Vive en **una sola función**
(`reactivacion_ventana_regreso_dias`), la pantalla muestra el valor que devuelve la base (no lo tiene escrito), y **se revisará con datos reales**.
El negocio no la configura (decisión: sin más complejidad por ahora). Lo mismo aplica a los 30 días de cooldown y a los 30 contactos/24 h.

## Reutilización

`crm_calcular` (segmentos), `promo_aplica_segmento`, nueva `promociones_vigentes_de` (única definición de «promoción vigente para este cliente»;
`promociones_aplicables` ahora la usa con el mismo comportamiento), `perfiles.promociones_ofertas`, Cliente 360 y su línea de tiempo.

## Archivos

**Migraciones:** `20261012000001_reactivacion_whatsapp.sql`, `20261012000002_fijar_search_path_ayudantes.sql`.
**Pruebas:** `supabase/tests/reactivacion_whatsapp.sql`. **Código:** `lib/reactivacion.js`, `pages/ClientesReactivar.jsx` (reescrita);
modificados `Crm.jsx`, `AdminPanel.jsx`, `Cliente360.jsx`.

## Pruebas (estado de cierre)

Base de datos: reactivación **41**; regresión: Fase B 46 · canjes 35 · puntos 34 · promociones 43 (la de promociones se repitió tras los últimos cambios; las de CRM,
canjes y puntos pasaron justo antes y desde entonces solo cambiaron funciones que ninguna de ellas usa: ver «Cierre»). Interfaz: 97 (27 de reactivación).
Fase A no tiene archivo propio: su aislamiento multi-clínica queda cubierto en cada suite. No se probó en un navegador real ni con WhatsApp real.

## Límites y decisiones cuestionables

- **Sin enlace público de reserva:** no existe uno seguro; el mensaje dice «podemos ayudarte a reservar» sin enlace.
- **Preferencia de promociones (qué significa de verdad):** existe `perfiles.promociones_ofertas`, un interruptor del cliente que **por defecto está activado**:
  es una **baja voluntaria (opt-out) que se respeta**, no un consentimiento. Melissa excluye a quien lo apagó. Quien nunca lo tocó (con cuenta, y también
  los creados por el negocio, que no tienen preferencia guardada) simplemente **no ha dicho que no**. Melissa **no interpreta eso como consentimiento ni lo muestra
  como tal**: la interfaz solo cuenta «no desean promociones» (quien dijo que no) y no afirma en ningún lado que un cliente «aceptó» recibir promociones.
  También se aplica a la reactivación **sin** promoción (decisión conservadora). No hay tabla de consentimiento y no se crea una ahora; quien necesite pruebas
  de consentimiento por ley tendrá que gestionarlo aparte.
- **Copiar el mensaje no cuenta** como contacto: quien lo pegue a mano en otro lado evita el registro (límite y cooldown solo protegen lo que pasa por «Abrir WhatsApp»).
- **El navegador puede bloquear la ventana.** Se abre una pestaña dentro del gesto del usuario antes de esperar al servidor; si aun así se bloquea, se ofrece el enlace
  (el contacto ya quedó registrado como *iniciado*).
- **Ventana de 60 días** para «regresó» (decisión propia, para no atribuir visitas lejanas). «Regresó después del contacto» no demuestra que fuera por el contacto.
- **Límite de 24 h móvil**, no por día calendario. Ambas cifras (30 y 30) son un punto de partida, no un número «seguro».
- La prueba de concurrencia es estructural (el bloqueo por clínica está en la función); no hubo ejecución simultánea real.
- `crm_calcular` se recalcula en cada consulta (sin caché): bien para cientos de clientes, a revisar si crecen a miles.

## Cierre de la fase (auditoría final)

**Corregido en la auditoría:** (1) «regresó» exigía solo que la cita se *creara* después del contacto; un registro retroactivo de una visita anterior se contaba
(reproducido: 2 en vez de 1) → ahora exige también que la visita ocurra después del contacto y dentro de la ventana. (2) El estado vacío decía «Es una buena
señal», que podía ser falso y no aclaraba que no es un error → texto neutral con el criterio real del negocio. (3) La tarjeta de protección decía «evitar» →
«reducir el riesgo de contacto excesivo». (4) Redacción de la documentación sobre preferencias.

**Verificado sin cambios:** migraciones aplicadas y sin problema real hoy; ventana de 60 días aislada en una función; copiar/abrir pantalla no registran; la interfaz
no afirma consentimiento; el límite de 30 se presenta como protección de Melissa; concurrencia garantizada en SQL; `wa.me` (HN/ES/locales/`+`/`00`, codificación de
acentos, emojis, saltos de línea y caracteres especiales); mensajes moderados y sin alertas de spam.

**Mejoras futuras (NO implementadas):** marcar a un cliente como «no volver a contactar» (hoy reaparece a los 30 días si no tiene cuenta); umbral de inactividad por
tipo de servicio; revisar los 30/30/60 con datos reales; enlace público de reserva; caché de `crm_calcular` si hay miles de clientes.
