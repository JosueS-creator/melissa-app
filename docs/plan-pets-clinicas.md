# Plan incremental: Melissa Pets y Melissa Clínicas

**Corte de auditoría:** 11 de noviembre de 2026  
**Alcance:** diseño y preparación. No se ejecutaron migraciones ni cambios de datos en Supabase para Pets o Clínicas.

## 1. Estado real de partida

### Repositorio y despliegues

- Producción de Vercel sigue desplegando `main` (commit `214d9fe`).
- `feature/melissa-multisector` contiene la configuración sectorial y este plan; tiene cambios propios pendientes de integrar.
- `feature/notificaciones-push-citas` contiene el trabajo de push y correcciones recientes de su PWA; también tiene cambios propios pendientes de integrar.
- Las dos ramas parten de `main`, pero están divergidas entre sí. No se debe fusionar una esperando que la otra esté incluida. La integración debe hacerse en una rama nueva o mediante una fusión explícita y revisada.
- Los previews de ambas ramas compilan, pero no tienen configuradas `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` para Preview. Por tanto, no permiten probar autenticación ni operaciones contra Supabase. No copiar las variables de producción al Preview sin definir antes un tenant y datos de prueba seguros.

### Supabase

- La tabla `clinicas` ya tiene `tipo_negocio`, marca, país, moneda y configuración de fidelización.
- La restricción actual de `clinicas.tipo_negocio` solo acepta `clinica_estetica`, `salon_belleza`, `salon_unas`, `spa` y `otro`. No acepta aún `barberia`, `veterinaria` ni `clinica_medica`.
- `temas_base` contiene cuatro temas: Rosa y Oro, Elegante Dorado, Clínico Minimal y Spa Natural. Las dos paletas Barber están preparadas en la migración de la rama multisector, pero todavía no están registradas en la base de datos.
- `perfiles.rol` solo admite `paciente`, `especialista` y `admin`.
- `pacientes` representa a la persona/cliente y contiene algunos campos de belleza, como `tipo_piel`.
- `citas` ya relaciona clínica, paciente, especialista, fecha, estado y servicio.
- `servicios` es suficientemente genérica para reutilizar nombre, descripción, precio y duración.
- `especialistas` solo tiene clínica, nombre, especialidad y estado; no tiene `perfil_id` para vincular de forma segura a una cuenta de acceso.
- `tratamientos_paciente` es un historial estético (procedimiento, productos, recomendaciones y fotos antes/después). No debe convertirse en expediente médico ni veterinario.
- La autorización multi-tenant existente se apoya en `clinica_actual()`, `paciente_actual()`, `es_admin_clinica()` y políticas RLS por `clinica_id`. Las tablas nuevas deben seguir el mismo límite.
- La comprobación de datos actual no encontró citas cuyo paciente o especialista pertenezca a otra clínica. Aun así, las claves foráneas de `citas` para paciente y especialista son simples; a diferencia de servicio y promoción, no obligan a que la relación corresponda a la misma clínica.

### Límites actuales de agenda y producto

- La agenda de cliente usa una lista fija de horas; no calcula disponibilidad real por profesional, duración, bloqueos ni solapamientos.
- La pantalla de agenda muestra el precio con prefijo `L`, aunque la clínica ya almacena su moneda. Esto debe corregirse antes de ofrecer el producto a clínicas de otros países.
- Hay textos y conceptos de Beauty (por ejemplo, Beauty Score/Beauty Points) que necesitan etiquetas sectoriales o neutrales.
- `plan_funciones` controla funciones comerciales por plan. No debe usarse como sustituto de `tipo_negocio`: el sector decide qué módulo tiene sentido y el plan decide qué capacidades comerciales puede usar.

## 2. Principios que no se deben romper

1. Una sola aplicación y una sola base multi-tenant; no crear una base separada por sector.
2. Toda tabla operativa nueva debe llevar `clinica_id`.
3. Toda relación entre entidades del mismo tenant debe validarse también en base de datos, preferiblemente con claves foráneas compuestas (`id, clinica_id`), no solo con filtros de React o RLS.
4. Mantener los registros existentes de Beauty y las columnas actuales; añadir campos/tablas de forma incremental.
5. No mezclar información clínica con CRM, promociones, puntos ni campañas.
6. No conceder acceso a expedientes médicos por el simple hecho de ser administrador o especialista sin definir antes el alcance de cada rol.
7. No desplegar a producción hasta completar pruebas positivas y negativas de aislamiento entre tenants y regresión de Beauty.

## 3. Melissa Pets — alcance propuesto

### Modelo mínimo

- Mantener `pacientes` como la persona propietaria/tutora y su cuenta de Melissa.
- Crear `mascotas` con `id`, `clinica_id`, `propietario_paciente_id`, nombre, especie, raza, sexo, fecha de nacimiento aproximada, peso, microchip opcional, fotografía y estado.
- Permitir varias mascotas por propietario.
- Añadir `mascota_id` nullable a `citas`; conservar `paciente_id` como tutor para no romper las citas actuales. Validar la mascota con una FK compuesta `(mascota_id, clinica_id)`.
- Crear un historial veterinario separado para consultas, evolución, vacunas, desparasitación, alergias, medicamentos y recetas. No guardar estos datos en `tratamientos_paciente`.
- Reutilizar `servicios` para consulta, vacuna, control y procedimiento; reutilizar agenda y profesionales cuando el modelo de disponibilidad esté listo.

### Acceso

- El tutor ve y gestiona únicamente sus mascotas dentro de su clínica.
- El veterinario ve los expedientes de su clínica según su asignación/permisos.
- El administrador configura el negocio, pero el acceso a información veterinaria debe quedar explícito y auditado.
- No crear una cuenta por mascota: la identidad de acceso es el tutor.

### MVP recomendado

1. Alta y edición de mascotas.
2. Relación tutor–mascota y selector de mascota al solicitar cita.
3. Agenda y ficha de cita con mascota.
4. Consulta veterinaria e historial básico.
5. Vacunas/desparasitación con próximas fechas.
6. Recordatorios push, una vez estabilizado el flujo común de notificaciones.

## 4. Melissa Clínicas — alcance propuesto

### Reutilizar

- `pacientes` como persona atendida.
- `citas`, `servicios` y `especialistas` como base de agenda y catálogo.
- `clinica_id` como tenant y la configuración actual de país/moneda/marca.

### Añadir sin reutilizar el historial estético

- Expediente clínico por paciente.
- Antecedentes, alergias y medicamentos actuales.
- Consultas/evolución vinculadas a cita y profesional.
- Diagnósticos, tratamientos y recetas.
- Estudios, archivos y resultados cuando el alcance lo requiera.
- Consentimientos y registro de auditoría de lectura/modificación del expediente.

### Roles y profesionales

- Antes de abrir expedientes a profesionales, vincular `especialistas` con una cuenta mediante `perfil_id` o una tabla de membresías de personal.
- Definir permisos diferenciados para recepción, médico, enfermería y administración. No ampliar `perfiles.rol` sin revisar las políticas y funciones que hoy esperan exactamente los tres roles existentes.
- El paciente podrá consultar únicamente su propio expediente y documentos que la clínica decida publicar.
- La recepción podrá gestionar citas y datos administrativos, pero no leer notas clínicas privadas por defecto.

### MVP recomendado

1. Vinculación de profesionales con cuentas y permisos.
2. Ficha del paciente y antecedentes básicos.
3. Registro de consulta y evolución.
4. Diagnóstico y receta.
5. Historial cronológico y documentos.
6. Auditoría de acceso y cambios.
7. Agenda con disponibilidad real por profesional.

No incluir diagnóstico automático ni decisiones médicas automatizadas.

## 5. Dependencias técnicas compartidas

### A. Integridad multi-tenant de agenda

Antes de añadir mascotas o expedientes:

- Crear claves únicas compuestas `(id, clinica_id)` para pacientes y especialistas.
- Añadir FKs compuestas desde `citas(paciente_id, clinica_id)` y `citas(especialista_id, clinica_id)`.
- Mantener las FKs compuestas que ya existen para servicios y promociones.
- Probar que una cita no puede referenciar paciente, especialista, servicio o mascota de otro tenant, incluso con llamadas directas a Supabase.

### B. Personal y roles

- Añadir vínculo de cuenta a especialista.
- Diseñar invitación de personal por clínica.
- Mantener separación entre el rol global de autenticación y los permisos funcionales del establecimiento, si hace falta granularidad.
- Revisar todas las políticas RLS que actualmente solo reconocen admin/paciente y las funciones que comparan literalmente `perfiles.rol`.

### C. Agenda

- Sustituir las horas fijas por disponibilidad por profesional, duración del servicio, descansos, excepciones y días no laborables.
- Validar solapamientos en servidor/SQL, no solo en la interfaz.
- Formatear moneda con `clinicas.moneda` y localización del tenant.
- Añadir tipo/motivo de cita de forma opcional y compatible con citas existentes.

### D. Configuración sectorial

- Mantener `tipo_negocio` como selector de línea de producto.
- Mantener `plan_funciones` como control de capacidades del plan.
- Definir módulos visibles por sector en un único mapa/configuración, sin duplicar la aplicación.
- El cambio de sector de una clínica existente debe reservarse a Super Administración o a un flujo controlado; no dejarlo como selector libre del administrador de negocio.

## 6. Secuencia de implementación y validación

| Fase | Trabajo | Criterio de salida |
|---|---|---|
| 0 | Integrar explícitamente push y multisector en una rama de integración | Una sola rama contiene ambos trabajos; producción sigue en main |
| 1 | Corregir integridad de citas y vínculo de profesionales | FKs compuestas y pruebas de aislamiento aprobadas |
| 2 | Aplicar configuración sectorial y paletas Barber en una migración revisada | Tipos y temas guardan/recargan; Beauty no cambia |
| 3 | Construir Melissa Pets | Tutor, mascota, cita y expediente aislados por tenant |
| 4 | Construir Melissa Clínicas | Profesional autorizado, expediente, consulta, diagnóstico y receta |
| 5 | Mejorar agenda y moneda compartidas | No hay horas fijas ni solapamientos; moneda correcta |
| 6 | Regresión y seguridad | Pruebas SQL/RLS, pruebas UI y revisión manual antes de producción |

## 7. Matriz mínima de pruebas

- Beauty existente: login, agenda, servicios, CRM, historial estético, puntos y tema sin cambios.
- Tenant A no puede listar, leer, insertar, actualizar ni borrar datos del tenant B.
- Una cita del tenant A no puede apuntar a paciente/especialista/servicio/mascota del tenant B.
- Tutor A solo ve sus mascotas y expedientes.
- Veterinario A solo accede a pacientes/mascotas de su clínica y según su asignación.
- Recepción no puede leer notas clínicas privadas.
- Un profesional no puede cambiar su propio `clinica_id` ni elevar su rol.
- Los datos clínicos no aparecen en CRM, promociones ni notificaciones promocionales.
- Las citas antiguas sin `mascota_id` ni datos clínicos siguen funcionando.

## 8. Estado al cierre de esta auditoría

- Solo se revisaron repositorio, despliegues, esquema, restricciones, políticas RLS, funciones y datos agregados.
- No se ejecutó la migración multisector pendiente.
- No se crearon tablas de Pets ni expedientes clínicos.
- No se modificaron roles, políticas ni registros de producción.
- La rama de notificaciones push sigue separada; su configuración y pruebas se gestionan aparte.
