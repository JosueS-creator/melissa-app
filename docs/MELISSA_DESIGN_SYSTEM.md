# Sistema visual de la app de clientes (rediseño de Inicio)

Alcance: app de clientes. El panel administrativo no se ha tocado; adoptará este sistema después. Estado: **Inicio implementado y validado**; las demás pantallas siguen con el diseño anterior.

## 1. Identidad
- **Logo** (no modificado): icono redondeado crema con listón rosa/magenta, «M» dorada y calendario rosa. Muestreo de píxeles (aprox.): magenta `#C04278–#C64E7E`, dorado `#D8A266–#E4AE72`, crema `#F6F0F0`. Se usa tal cual: cabecera (64 px) y marca de agua de la tarjeta de puntos (256 px, 13 % de opacidad, arriba a la derecha, detrás del texto).
- **Los colores no son fijos: cada negocio tiene su tema** (`temas_base` → variables CSS, ver `lib/aplicarTema.js`). El tema de Melissa es **«Rosa y Oro»**; el de otros negocios puede ser otro (p. ej. «Elegante Dorado»). Regla: los componentes **no escriben colores de marca**; usan las variables. Una prueba automática lo exige.

Valores reales de «Rosa y Oro» (leídos de la base):

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#C93B79` | acciones, enlaces, precios, cifra del aviso |
| `--color-ink` | `#4A0E2B` | texto principal |
| `--color-dorado` / `--color-dorado-claro` | `#C9A24D` / `#EBCB86` | bordes, barras y detalles (nunca texto) / corona del nivel |
| `--color-fondo-app` | `#FEFAF8` | fondo |
| `--color-borde-tarjeta` | `#F0DCE4` | bordes y divisores |
| `--color-texto-secundario` / `--color-texto-terciario` | `#8A6274` / `#A88096` | datos de apoyo / solo ≥18 px o decorativo |
| `--color-accent` | `#F6C2D6` | tinte de mosaicos |
| `--gradiente-puntos` (**nuevo**) | `linear-gradient(135deg,#8E2255 0%,#C93B79 100%)` | tarjeta de Beauty Points |

`--gradiente-puntos` es un token nuevo del tema (migración `20261015000001`). Si un tema no lo define, la tarjeta usa su fondo oscuro de siempre (`--gradiente-fondo-oscuro`): un degradado claro con texto blanco no cumpliría contraste.

**Variantes derivadas** (con `color-mix`, siguen al tema): rosa suave `primary 8 % sobre fondo`; tinte rosa `accent 55 %`; tinte dorado `dorado-claro 55 %`; dorado suave `dorado 16 %`; texto «Solicitada» `dorado 62 % + negro`; «Confirmada»: verde semántico `#4F7A3E` (igual en todos los temas) con texto al 90 %.

**Contraste calculado en «Rosa y Oro»** (mínimo AA 4,5:1): texto principal 14,58 · secundario 4,96 · primario sobre fondo 4,62 · blanco sobre primario 4,79 · dorado claro sobre ciruela 9,66 · «Solicitada» 4,81 · «Confirmada» 4,91 · terciario 3,27 (solo texto grande) · **dorado como texto 2,31 (no usar)**.

## 2. Tipografía
Se mantiene la del tema: **Prata** (títulos, cifras) + **Jost** (datos, formularios). Ya estaban cargadas: no se agregan fuentes. Mínimo de toda la pantalla: **12 px** (antes había textos de 9–11 px). Escala de Inicio: saludo 30 · sección 21–22 · título de tarjeta 17–22 · cifra de puntos 36 · texto 14–15 · apoyo 13 · etiqueta 12.

## 3. Componentes de Inicio (implementados)
| Componente | Reglas |
|---|---|
| Cabecera | Logo y nombre del negocio centrados; icono de perfil de 44 px; saludo con el **primer nombre** |
| Próxima visita | Tarjeta completa clicable → Citas. Etiqueta corta («Confirmada» verde / «Solicitada» dorado) y, si es solicitud, «Esperando confirmación del negocio». Foto del servicio de la cita. Debajo: aviso de cambios y botones Llamar / WhatsApp |
| Sin citas | Invita a solicitar; no crea nada |
| Tarjeta de servicio | Foto arriba, nombre, descripción (2 líneas), duración y precio **solo si existen**. Toda la tarjeta es un enlace |
| Foto con respaldo (`FotoTarjeta`) | Alto fijo (sin saltos), `object-fit: cover`, carga diferida; sin foto o si falla → mosaico con inicial |
| Beauty Points | Saldo, nivel real, barra y «N pts para X» **solo si hay siguiente nivel calculable**; nivel máximo lo dice; con 0 puntos explica cuándo aparecerán |
| Aviso de promoción | Solo promociones reales y vigentes; conserva «Ver promoción», «No mostrar más» y «Tus beneficios (n)» |
| Producto («Para ti») | Foto, nombre, precio → Tienda |
| Barra inferior | 4 pestañas, fija abajo, etiquetas de 12 px, áreas de 52 px, `aria-current` |
| Cargando / error | Esqueleto (el brillo solo si no hay «movimiento reducido»); si fallan puntos o cita no se muestran ceros: aviso con «Reintentar» |

**Documentado para fases posteriores** (no se crearon de forma preventiva): botones primario/secundario del resto de pantallas, tarjetas de cita en Agenda, de recompensa, avatares, inputs y formularios, estados vacíos de otras pantallas.

## 4. Principios
Espacio 4·8·12·16·20·24·28; radios 12 (botón), 18 (tarjeta pequeña), 20–22 (tarjeta grande), 999 (etiqueta); borde de 1 px y sombra `0 1px 2px` casi imperceptible; **un solo botón principal por pantalla**; áreas táctiles ≥ 44 px; un solo fondo de color intenso (puntos); sin degradados de relleno salvo el de puntos; sin rebotes.

## 5. Fotografías
- Los **servicios** ahora tienen `servicios.imagen_url` (opcional; ruta del app `/muestras/…` o URL `https://`; la base rechaza cualquier otra cosa). Los **productos** ya tenían `imagen_url`.
- Muestras: `public/muestras/` (ver `LEEME.md`: medidas, reglas y SQL). Créditos en `docs/CREDITOS_FOTOS.md`.
- **Licencia:** solo fotos libres (Pexels, Unsplash gratuita, Pixabay). Las de bancos de pago (iStock, Shutterstock, PNGTree) no se incluyen: el repositorio es público. Aún no hay fotos de muestra cargadas.
- Largo plazo: cada negocio sube las suyas; falta la pantalla del panel para subirlas.

## 6. Navegación
Inicio · **Citas** (Agenda) · **Beneficios** (Tarjeta) · Perfil. La **Tienda ya no tiene pestaña**: se llega desde «Para ti → Ver todas». Estando en la Tienda no se marca ninguna pestaña. El botón del carrito de la Tienda se subió para no chocar con la barra fija.

## 7. Limitaciones conocidas
- Temas con color primario claro (p. ej. «Elegante Dorado»): texto blanco sobre el primario no llega a 4,5:1. Ya ocurría antes; se corrige al definir los temas.
- Tocar un servicio abre la Agenda sin preseleccionarlo.
- «Pendiente» en Agenda sigue usando el dorado como texto (2,31:1) hasta rediseñar esa pantalla.
- Verificado con navegador sin interfaz (Chrome 153) a 360, 411 y 1280 px; no en un teléfono físico.

## 8. Siguientes pantallas (orden propuesto)
1) Citas (Agenda) · 2) Beneficios (Tarjeta, recompensas, canjes) · 3) Perfil · 4) Tienda · 5) Progreso (Historial) · 6) Referidos · 7) Acceso y registro. Después, el panel administrativo.
