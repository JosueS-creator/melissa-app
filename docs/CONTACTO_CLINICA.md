# Datos de contacto de la clínica

Tarea acotada: Super Administración registra el teléfono y el WhatsApp de cada negocio; el cliente los usa cuando necesita comunicarse con él.
Costo incremental $0. Sin API de WhatsApp, sin mensajería, sin horarios, disponibilidad, reprogramación ni cancelación.

## Decisión de arquitectura (y por qué)
Los datos viven en una **tabla aparte**, `clinica_contacto` (`clinica_id`, `telefono_contacto`, `whatsapp_contacto`), **no** como columnas de `clinicas`.
Motivo comprobado en la base: la política `lectura_publica_clinicas_activas` deja leer **todas las columnas de todas las clínicas activas** a un visitante anónimo
y a cualquier cliente (un cliente de una clínica ve la fila de la otra). Columnas nuevas ahí habrían quedado públicas. En la tabla nueva solo existe una política:
**Super Administración lee y escribe**; clientes y administradores normales no la leen ni la escriben directamente.

## Cómo funciona
- **Super Administración (Panel de Melissa):** el formulario de crear negocio tiene la sección «Datos de contacto» (ambos campos opcionales, con sus ayudas) y cada negocio de la
  lista tiene un botón **Contacto** que abre un editor pequeño (hasta ahora no existía formulario de editar negocios). Dejar ambos vacíos borra el registro.
- **Validación:** teléfono con 7 a 15 dígitos (números, espacios, guiones, paréntesis, «+» solo al inicio). El WhatsApp debe poder usarse en `wa.me`: con «+» o «00» se respeta el código
  escrito; sin código se completa solo con el país del negocio (Honduras: 8 dígitos que empiezan por 2, 3, 7, 8 o 9 → 504 · España: 9 dígitos que empiezan por 6 a 9 → 34), reutilizando la
  normalización de la Fase C. Si no se puede, la base lo rechaza. El formulario avisa antes con las mismas reglas.
- **Cliente:** `contacto_de_mi_clinica()` no recibe parámetros y devuelve solo el contacto de **su** clínica, con el número listo para `tel:` (tal como lo escribió el negocio: no se adivina país)
  y para `https://wa.me/<número>` (sin texto, sin API). El componente `ContactoNegocio` muestra **Llamar** y/o **WhatsApp** debajo de «Para cambiar o cancelar… comunícate con el negocio»
  (Home, en la próxima cita; Agenda, en Mis citas). Sin datos: no muestra nada. Sin caché en el navegador.
- **Administrador normal:** no puede cambiar el contacto (ni su pantalla de personalización lo menciona); puede consultar el de su negocio (solo lectura) con la misma función.

## Archivos
**Migración:** `20261014000001_contacto_de_la_clinica.sql`. **Pruebas:** `supabase/tests/contacto_clinica.sql`.
**Código:** `lib/contacto.js`, `components/ContactoNegocio.jsx`; modificados `PanelMelissa.jsx`, `Home.jsx`, `Agenda.jsx`.

## Observaciones (no se cambiaron)
- La política que hace públicas todas las columnas de las clínicas activas existe por la resolución de `/slug` y el registro; hoy solo expone datos de marca/ajustes, pero conviene revisarla si
  se agregan datos sensibles a `clinicas`.
- El teléfono se marca tal como está escrito: un número local sin «+» llamará bien dentro del país pero no desde el extranjero.
- Todavía no hay contactos registrados: Super Administración debe cargarlos para que aparezcan los botones.
