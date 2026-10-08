# Ciclo Cliente — funcionalidades actuales (cierre)

Auditoría de la app que VE y USA el cliente final (no el módulo administrativo). Sin fase nueva, sin funcionalidades nuevas, costo incremental $0.

## Regla de citas
El cliente **solicita**; el negocio **confirma, completa o cancela**. «Solicitada» ≠ «Confirmada».
Melissa **no calcula disponibilidad**: los horarios son sugerencias y el negocio confirma o propone otro. El cliente **no puede** cancelar,
reprogramar, confirmar ni completar (el servidor no se lo permite; las pantallas ya no lo prometen).

## Qué se corrigió
- **Home → próxima cita:** muestra su estado real; se quitaron «Ver detalles» y «Reprogramar» (llevaban al mismo sitio y no reprogramaban nada).
- **Agenda:** «Mis citas» (próximas con su estado; anteriores plegadas); «Horarios disponibles» → «Horarios sugeridos» con aviso; «Confirmar cita» /
  «Cita reservada» → «Solicitar cita» / «Solicitud enviada… todavía no está confirmada»; no se pueden elegir horas que ya pasaron hoy.
- **Fechas:** el día se calculaba en UTC (después de las 6 p. m. en Honduras mostraba y guardaba el día siguiente); ahora es local.
- **Servidor (migración `20261013000001`):** el cliente ya no puede solicitar citas en el pasado ni con un especialista de otra clínica.
- **Historial:** «Historial clínico» → «Mi progreso» (tratamientos y fotos; las citas están en Agenda); si una foto no se sube ya no se guarda un registro «exitoso»; aviso de privacidad.
- **Perfil:** cada preferencia dice lo que hace hoy (recordatorios aún no se envían; fotos: el negocio siempre las ve).
- **Referidos:** se quitaron «20 % para ella», «500 Beauty Points», «limpieza facial gratis», «meta del mes» y «+500»: el servidor no otorga nada por referidos. «Invitar» solo guarda el número.
- **Tienda:** «Pedido confirmado» → «Pedido enviado al negocio… aún no se cobra nada»; el pedido nace pendiente.

## Qué NO se tocó (y por qué)
Puntos, niveles, recompensas, canjes, QR, promociones (ya estaban coherentes y probadas); tabs, navegación y módulo administrativo; las opciones «próximamente» del Perfil;
disponibilidad dinámica, reprogramar/cancelar por el cliente, recordatorios, datos de contacto del negocio, sistema de referidos, tracking de pedidos y pagos en línea (serían funcionalidades nuevas).

## Limitaciones conocidas
- ~~No existían datos de contacto del negocio~~ → resuelto en `docs/CONTACTO_CLINICA.md`: ahora la app muestra «Llamar» / «WhatsApp» si Super Administración registró el contacto; si no, queda solo el mensaje.
- El cliente solo puede cambiar o cancelar una cita hablando con el negocio.
- Los horarios sugeridos son fijos (iguales para todos los negocios); no reflejan el horario real.
- Un cliente puede solicitar varias citas en el mismo horario (el negocio decide).
- El estado de un referido («recompensado») lo pone el negocio a mano y no otorga puntos.
- No se probó en un navegador real.
