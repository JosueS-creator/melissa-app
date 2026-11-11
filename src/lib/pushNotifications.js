import { supabase } from './supabaseClient'

function convertirClavePublica(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalizada = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binaria = window.atob(normalizada)
  return Uint8Array.from(binaria, (caracter) => caracter.charCodeAt(0))
}

export async function obtenerEstadoPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { compatible: false, permiso: 'unsupported', suscripcion: null }
  }
  const registro = await navigator.serviceWorker.ready
  const suscripcion = await registro.pushManager.getSubscription()
  return { compatible: true, permiso: Notification.permission, suscripcion }
}

export async function activarPush({ perfil, paciente }) {
  const clavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!clavePublica) throw new Error('Las notificaciones aún no están configuradas en Melissa.')
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no admite notificaciones push.')
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    throw new Error(permiso === 'denied'
      ? 'Las notificaciones están bloqueadas en los ajustes del navegador.'
      : 'No se concedió permiso para enviar notificaciones.')
  }

  const registro = await navigator.serviceWorker.ready
  let suscripcion = await registro.pushManager.getSubscription()
  if (!suscripcion) {
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertirClavePublica(clavePublica),
    })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: perfil.id,
    patient_id: paciente.id,
    clinic_id: paciente.clinica_id,
    endpoint: suscripcion.endpoint,
    subscription: suscripcion.toJSON(),
    user_agent: navigator.userAgent.slice(0, 500),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' })

  if (error) {
    await suscripcion.unsubscribe().catch(() => {})
    throw new Error('No pudimos guardar la autorización. Inténtalo de nuevo.')
  }
  return suscripcion
}

export async function desactivarPush(perfilId) {
  const registro = await navigator.serviceWorker.ready
  const suscripcion = await registro.pushManager.getSubscription()
  if (!suscripcion) return

  const { error } = await supabase.from('push_subscriptions')
    .delete()
    .eq('user_id', perfilId)
    .eq('endpoint', suscripcion.endpoint)

  if (error) throw new Error('No pudimos retirar este dispositivo de los recordatorios.')
  await suscripcion.unsubscribe()
}
