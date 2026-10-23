# Melissa: experiencia premium del cliente

Cambios preparados localmente para JosueS-creator/melissa-app, rama main. Referencia del código publicado consultado: origin/main 41521116e36bb41fab19b9698cd6905f86526cde. Se conservaron los cambios locales anteriores del administrador y de fotografías de Servicios. No se hizo push, despliegue ni escritura remota.

## Auditoría

Home ya mostraba servicios y productos mediante FotoTarjeta y calculaba puntos a partir de puntos_movimientos. Su diseño tenía imágenes pequeñas, placeholders sin fotografías de categoría, tarjetas planas y marca de Melissa como reemplazo del logotipo de la clínica. TarjetaVIP usaba también el logo y marca de agua de Melissa y convertía errores de lectura en listas vacías o saldo cero. TabBar ya ofrecía las cuatro rutas existentes. No se necesitaba crear otra galería, lógica de puntos, catálogo o navegación.

Se consultó la referencia de Figma, que contiene principalmente pantallas del administrador. Se adaptó su lenguaje de profundidad, bordes y acciones elevadas al cliente; no se afirma una réplica de un frame de cliente inexistente en esa referencia. No se añadieron bibliotecas de animación ni motores 3D.

## Resultado

- Inicio: portada fotográfica con acceso al flujo existente de citas, catálogo de fotos grandes, productos elevados y tarjeta de fidelización premium.
- Imagen: una sola cadena en FotoTarjeta: foto propia → muestra local de categoría → placeholder. La foto propia y los registros no se modifican. Si falta o falla la foto, el respaldo se distingue como «Imagen ilustrativa».
- Fidelización: relieve, reflejos CSS, borde metálico y gradiente adaptado a la clínica. Los puntos siguen viniendo de los movimientos reales. Beneficios conserva el QR, solicitudes de canje y reglas existentes. No se muestran recompensas ficticias si no existen.
- Marca blanca: logo/nombre del negocio en Inicio, Agenda y Beneficios; sin logo se usan iniciales. Melissa aparece como proveedor en el pie de Inicio.
- Temas: las superficies, botones y acabados derivan de variables existentes. Al cambiar de clínica se retiran los tokens extendidos que hubieran quedado de la anterior; evita heredar una paleta rosa en otra marca. Se comprobaron champán/ciruela y verde.
- Accesibilidad: acciones táctiles, foco visible, texto blanco sobre acciones oscurecidas a partir de la paleta, estados vacíos y errores recuperables; microinteracciones solo con prefers-reduced-motion: no-preference.

## Fotografías y licencias

Siete WebP locales, 960×720, 220.458 bytes en conjunto. Categorías: facial, hidratación, cabello, uñas, spa, productos e instalaciones. Autores y licencia individual documentados en docs/FOTOS_MUESTRA.md; public/images/muestras/creditos.json incluye origen, descarga y hashes. Todas las páginas seleccionadas indican licencia gratuita Pexels. Se inspeccionaron los archivos finales para evitar marcas visibles. Las fotografías no se presentan como pacientes del negocio ni como personas que recomiendan Melissa.

Los registros existentes que ya contienen imágenes externas mantienen esas referencias por prioridad; el respaldo nuevo es local, por lo que no se depende del servidor externo para las muestras de reserva.

## Demo y datos

La consulta de solo lectura identificó Clínica Demo, slug demo, UUID c48eea49-bcd3-4fc8-86db-60faf0610c75. La identificación visual exige UUID y slug juntos. Ya tiene servicios de demostración con fotos externas; se conservaron.

No se añadieron ni modificaron datos de ninguna clínica remota, ni siquiera de demo. Las fotografías se integran en el frontend como respaldo; no requieren actualizar Storage o el esquema. La presentación local del navegador usa respuestas REST sintéticas marcadas expresamente y las mismas pantallas reales de App. Esos fixtures solo están en el laboratorio y no se incorporan al ZIP de aplicación. Los saldos, precios, servicios y recompensas de esas capturas no se trasladan a usuarios reales.

Por tanto, esto prepara el código y prueba la demo local; no certifica que la versión remota de demo ya esté actualizada. Tampoco se han agregado nuevos registros sintéticos al tenant alojado. El usuario podrá publicar la entrega por separado y validar con su cuenta de demostración existente.

## Archivos de esta tarea

| Archivo | Cambio |
|---|---|
| src/pages/Home.jsx | Portada, catálogo, respaldo de fotos y fidelización visual |
| src/pages/TarjetaVIP.jsx | Identidad propia, tarjeta premium, estado vacío y error de lectura sin saldo falso |
| src/pages/Tienda.jsx | Reutiliza FotoTarjeta con respaldo de productos |
| src/pages/Agenda.jsx | Identidad del negocio en lugar de la marca de agua de Melissa |
| src/App.jsx | Contenedor premium, props de identidad y distintivo persistente del tenant demo |
| src/components/TabBar.jsx | Clase visual compartida sin cambiar rutas |
| src/components/FotoTarjeta.jsx | Cadena de imágenes y etiqueta de muestra, conserva comportamiento anterior sin muestra |
| src/components/MarcaNegocio.jsx | Logo o iniciales reutilizables |
| src/components/clientePremium.css | Componentes visuales, reflejos, sombras, foco y movimiento reducido |
| src/lib/imagenesMuestra.js | Categorías conservadoras e identificación de demo |
| src/lib/aplicarTema.js | Limpieza de tokens anteriores antes de aplicar los del tenant actual |
| public/images/muestras/* | Siete fotos WebP y registro de créditos |
| docs/FOTOS_MUESTRA.md | Fuentes, licencias y transformaciones |
| tests/imagenesMuestra.test.js | Categorías, demo y comprobación de assets/hashes |
| tests/cliente-contratos.mjs | Comparación de consultas/RPC y archivos protegidos |
| work/pg-lab/cliente-premium.mjs | Pruebas de navegador con datos sintéticos y captura real de App |

No se tocaron autenticación, Historial, Perfil, RLS, tablas, políticas o estados. El calendario del administrador se conserva. Se mantiene el esquema actual, sin activar columnas de la migración pendiente.

## Validación

- Compilación Vite correcta; permanece la advertencia de bundle principal >500 kB (aprox. 789 kB sin gzip, 228 kB gzip). No se añadieron dependencias. Esto no equivale a una auditoría Lighthouse ni a una prueba en un teléfono físico.
- 22 pruebas unitarias correctas: calendario, errores, fotografías de servicios y muestras/licencias locales.
- Prueba AST cliente: consultas y RPC iguales a origin/main en App, Home, Agenda, Tienda, TarjetaVIP y aplicarTema. Auth, Historial y Perfil idénticos al normalizar CRLF.
- Pruebas de contratos del administrador correctas; tres archivos del calendario permanecen iguales a origin/main.
- 11 escenarios de regresión del calendario correctos.
- 9 comprobaciones de fotografías de Servicios correctas, incluida creación, reemplazo, eliminación, reintento sin duplicación y catálogo cliente.
- Navegador del cliente: muestras decodificadas a 960×720, dos marcas, saldo obtenido de respuestas de movimientos, fotos propias prioritarias, fallback de URL rota, placeholder desconocido, recompensas vacías, error/reintento de puntos, navegación a citas, movimiento reducido y limpieza de tokens al cambiar tenant. Sin errores JavaScript ni escrituras. Capturas de 390×844 y 1440×1000.

Se conserva lazy loading para fotos fuera de pantalla; para las capturas largas se esperó su decodificación. Solo la imagen de portada se carga con prioridad. No hay requests de Pexels para servir las muestras locales.

## Límites pendientes

No se probaron RLS ni operaciones de canje/pedido con dos usuarios reales contra el backend alojado; las pruebas interceptan REST y no certifican permisos nuevos. No se creó un bypass de autenticación ni se incluyeron claves de producción en fixtures. En el laboratorio se provocan intencionadamente errores 404/503 para comprobar recuperación.

La clasificación de muestras se basa en nombres porque no existe un campo de categoría de servicio reutilizable. Para servicios desconocidos no se inventa una foto. Una clínica debería sustituir las imágenes ilustrativas por sus propias fotografías para representar instalaciones, productos o resultados específicos.

No se sincronizaron nuevos commits remotos durante esta tarea: revisar los archivos antes de reemplazarlos si el repositorio cambió después de la entrega anterior. No se publicó ni se afirma que la demo alojada ya muestre el rediseño.

## Entrega y recuperación

El ZIP melissa-premium-completo.zip contiene src y public, incluyendo los cambios previos de administrador y fotografías de Servicios para evitar omitir componentes requeridos. También contiene la documentación de licencias. No incluye .env, node_modules, SQL, datos sintéticos, tests ni dist.

Descomprimir y subir src, public y docs respetando rutas a la raíz de melissa-app. No subir el ZIP directamente. Vercel puede desplegar al hacer commit en su rama conectada; esta tarea no realiza ese commit.

Para recuperar, conservar el commit anterior de GitHub antes de subir y revertir el commit de esta entrega si fuera necesario. Los datos no requieren recuperación porque no se modificaron. Las propuestas SQL del calendario y la garantía de exclusión concurrente permanecen fuera de este trabajo.
