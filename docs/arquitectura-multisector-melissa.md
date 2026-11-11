# Melissa multisectorial — base de arquitectura

## Objetivo

Evolucionar Melissa desde su enfoque inicial de belleza hacia una plataforma multisectorial, conservando una sola aplicación, una sola base técnica y los flujos comunes que ya funcionan. Cada establecimiento activa una especialización y una identidad visual propias.

Esta rama parte de `main`. No incorpora ni modifica el trabajo pendiente de notificaciones push.

## Líneas de producto

- **Melissa Beauty**: salones, spas y clínicas de belleza/estética. Es la línea existente y debe conservar su experiencia actual.
- **Melissa Pets**: veterinarias y hospitales/consultorios veterinarios.
- **Melissa Clínicas**: consultorios médicos y centros de salud.
- **Melissa Barber**: barberías y negocios de cuidado masculino.

No crear cuatro aplicaciones ni duplicar agenda, clientes, autenticación, promociones o fidelización. La especialización se resuelve mediante configuración por establecimiento y módulos habilitados.

## Núcleo compartido

- Multi-tenancy: cada registro operativo pertenece a un `clinica_id` (o al identificador tenant ya establecido) y las consultas se limitan al tenant de la sesión.
- Usuarios, perfiles y roles existentes.
- Agenda, disponibilidad, citas, servicios, personal y notificaciones.
- CRM, historial de visitas, promociones, puntos y comunicación asistida.
- Configuración de marca: nombre, logo, colores y módulos activos.

Los nombres internos actuales de tablas y columnas no se deben renombrar en bloque. La evolución debe ser incremental y compatible con los datos ya existentes.

## Especialización por sector

### Melissa Pets

Entidad principal adicional: **mascota**, vinculada a su propietario/cliente y al tenant.

Datos y funciones propias:
- ficha de mascota: nombre, especie, raza, sexo, fecha de nacimiento aproximada, peso y fotografía opcional;
- propietario y contactos asociados;
- historial de consultas y evolución;
- vacunas, desparasitación y próximos controles;
- tratamientos, recetas e indicaciones;
- agenda por veterinario, tipo de consulta y duración;
- alertas de seguimiento y recordatorios.

No asumir que una mascota equivale a un paciente humano ni reutilizar campos de belleza para almacenar datos veterinarios.

### Melissa Clínicas

Especialización para consultorios médicos:
- ficha de paciente;
- expediente de consultas y evolución;
- antecedentes, alergias y medicamentos;
- diagnósticos, tratamientos y recetas;
- órdenes/resultados de estudios cuando corresponda;
- agenda por profesional, especialidad y duración.

La primera versión debe reutilizar agenda, CRM y perfiles, pero separar claramente la información clínica de los datos comerciales y de fidelización. No incluir diagnósticos automatizados ni decisiones médicas automáticas.

### Melissa Barber

Especialización ligera:
- catálogo de cortes y servicios;
- barberos/profesionales y horarios;
- agenda por profesional;
- preferencias del cliente y notas de servicio;
- historial de visitas, promociones y fidelización.

No requiere un módulo clínico ni campos veterinarios.

## Identidad visual — nuevas paletas Barber

Añadir opciones de tema sin reemplazar Rosa y Oro ni cambiar la identidad de negocios existentes.

### Grafito y acero (opción principal)
- Primario: `#263238`
- Secundario: `#455A64`
- Acento: `#B0BEC5`
- Fondo: `#F4F6F8`
- Acción oscura: `#17232B`
- Detalle metálico: `#A7B0B8`

### Azul noche y plata
- Primario: `#172554`
- Secundario: `#334155`
- Acento: `#CBD5E1`
- Fondo: `#F5F7FA`
- Acción oscura: `#0F172A`
- Detalle: `#94A3B8`

Ambas paletas deben mantener contraste legible, estados de cita semánticos y controles accesibles. Los colores se ofrecen como opciones profesionales para barberías; no se fuerzan a otros sectores.

## Seguridad y aislamiento

La regla esencial indicada para el producto es que un establecimiento nunca pueda leer o modificar datos de otro. Esto debe mantenerse en base de datos, RPC, Edge Functions y cliente; ocultar elementos en la interfaz no es control de acceso.

No se propone añadir fricción innecesaria ni duplicar permisos por país. Sí se conservan controles técnicos mínimos: RLS por tenant, validación de pertenencia en operaciones servidoras, roles existentes y acceso limitado a los expedientes según el establecimiento. La información médica y veterinaria debe mantenerse fuera de mensajes promocionales y de pantallas de fidelización.

## Reglas de evolución

1. No cambiar la experiencia de Beauty que ya funciona.
2. No fusionar esta rama directamente a producción sin pruebas.
3. No ejecutar migraciones sobre Supabase desde esta fase de diseño.
4. No mezclar esta línea de trabajo con la rama de notificaciones push.
5. Implementar primero configuración sectorial y selector de paletas; después los modelos de Pets y Clínicas con migraciones incrementales y pruebas de aislamiento entre dos tenants.
6. Mantener el costo incremental cercano a cero y no incorporar proveedores pagados sin aprobación.

## Orden recomendado

1. Configuración del tipo de establecimiento y paletas visuales.
2. Melissa Barber (principalmente configuración y catálogo, bajo riesgo).
3. Melissa Pets (mascotas, propietarios e historial veterinario).
4. Melissa Clínicas (expediente médico con pruebas más estrictas de acceso).
5. Pruebas de regresión de Beauty y pruebas negativas de aislamiento entre tenants.

## Criterios de aceptación

- Un negocio existente de Beauty sigue funcionando sin cambios de datos ni apariencia.
- Un administrador puede elegir una de las paletas Barber y el tema persiste al recargar.
- Un usuario de un tenant no puede leer, modificar ni enumerar datos de otro tenant, incluso llamando directamente a Supabase.
- Los módulos Pets y Clínicas muestran únicamente sus propios campos y flujos.
- Las funciones compartidas (agenda, CRM y perfiles) siguen funcionando sin duplicarse.
