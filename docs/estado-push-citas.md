# Estado y checklist: notificaciones push de citas

**Corte:** 11 de noviembre de 2026  
**Producción:** sin cambios de código ni despliegues nuevos desde esta revisión.

## 1. Estado real de Supabase

- La Edge Function `send-appointment-reminders` existe, está `ACTIVE`, versión 1 y `verify_jwt = false`.
- El cron `melissa-send-appointment-reminders` está activo cada cinco minutos.
- El cron envía `x-melissa-cron-secret`; el token interno `melissa_push_cron_secret` existe en Vault y se valida mediante `validar_melissa_push_cron`.
- La función requiere `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT` es opcional y tiene un valor predeterminado.
- En las últimas 24 horas de logs consultadas hubo 285 respuestas HTTP 503 y ninguna 200 para esta función. El código devuelve 503 cuando falta al menos una variable requerida. Los logs no permiten identificar cuál variable falta.
- `push_subscriptions` tiene 0 registros y `push_reminder_deliveries` tiene 0 registros. Todavía no hay ningún dispositivo registrado ni un envío confirmado.

**Importante:** la consulta de Vault solo confirma el secreto del cron. Los secretos de Edge Functions se gestionan aparte; no se puede deducir desde `vault.secrets` si están o no cargados. Antes de atribuir el 503 exclusivamente a VAPID, confirmar también que la función recibe `SUPABASE_SERVICE_ROLE_KEY`. Si el proyecto ya desactivó las claves legacy y usa las nuevas secret keys, la función debe adaptarse al modelo nuevo de Supabase antes de probar el envío.

## 2. Estado de Vercel y PWA

- `VITE_VAPID_PUBLIC_KEY` está configurada únicamente para Preview de `feature/notificaciones-push-citas`.
- La clave pública no está configurada en el entorno Production de Vercel.
- El Preview de push no tiene `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`; por eso compila, pero no puede iniciar sesión ni consultar Supabase.
- No copiar las variables de producción al Preview hasta definir un entorno/datos de prueba seguros. Un Preview conectado a producción podría crear o modificar datos reales.
- El último Preview de push quedó en estado `READY`: `https://melissa-g65iujdnv-enerpetrol.vercel.app`.

### Correcciones de código realizadas solo en la rama push

1. Se importó `PushRecordatorios` en `Perfil.jsx`; el componente se usaba sin importar.
2. Se registró `/sw.js` desde `main.jsx`; antes no había registro, por lo que `navigator.serviceWorker.ready` podía quedarse esperando.
3. Se enlazó `/manifest.webmanifest` en `index.html`.
4. Se corrigió el `apple-touch-icon` para usar el archivo público existente.

El build de Vercel terminó correctamente. No se probó todavía la interfaz desde un navegador ni un dispositivo físico.

## 3. Secretos que deben quedar configurados

En **Supabase Dashboard → Edge Functions → Secrets**:

- `VAPID_PUBLIC_KEY`: debe ser exactamente la misma clave pública que `VITE_VAPID_PUBLIC_KEY` del entorno que se prueba.
- `VAPID_PRIVATE_KEY`: clave privada correspondiente a esa misma pareja. No subirla a Git, Vercel ni al chat.
- `VAPID_SUBJECT`: opcional; usar una URL HTTPS o un correo de contacto. Si no se define, el código usa `https://danelilabs.lat`.

Si no se conserva la clave privada correspondiente a la pública que ya está en Preview, no mezclar claves: generar una pareja nueva y actualizar ambas variables para que coincidan.

Al configurar los secretos de Edge Functions no hace falta volver a desplegar la función; Supabase los pone disponibles inmediatamente.

## 4. Prueba de dispositivo real

Precondiciones:

- Entorno de prueba conectado a una base segura o autorización explícita para usar un tenant de pruebas en producción.
- Cuenta de prueba vinculada a un paciente de la clínica.
- Navegador compatible en HTTPS; en iPhone, instalar la PWA en la pantalla de inicio antes de solicitar permiso.
- `recordatorios_citas = true` en el perfil.

Pasos:

1. Abrir Melissa en el dispositivo y entrar a Perfil → Preferencias.
2. Activar «Recordatorios de cita» y después «Activar notificaciones».
3. Confirmar que aparece una fila en `push_subscriptions` para ese usuario, paciente y clínica.
4. Crear una cita de prueba en estado `confirmada`, dentro de la ventana de dos horas, y verificar que pertenece al mismo tenant del paciente.
5. Esperar el siguiente ciclo del cron (cada cinco minutos).
6. Confirmar que llega la notificación al dispositivo y que `push_reminder_deliveries` registra `status = 'sent'` para el tipo `2h`.
7. Confirmar que el siguiente ciclo no duplica el envío.
8. Probar después la ventana `24h` y la desactivación de la suscripción.
9. Verificar que endpoints expirados (404/410) se eliminan y que no se envían recordatorios si el usuario desactiva su preferencia.

## 5. Puesta en producción

No promover la rama push a `main` hasta que:

- los secretos estén completos y el cron deje de responder 503;
- el Preview tenga un backend de prueba seguro;
- el dispositivo real reciba un envío `2h` y otro `24h`;
- se valide la deduplicación y la baja de suscripción;
- se configure `VITE_VAPID_PUBLIC_KEY` también en Vercel Production;
- se integre explícitamente esta rama con `feature/melissa-multisector`, que hoy está divergida y no contiene estos cambios.

La producción de Vercel sigue en `main`; esta rama no se ha promovido.
