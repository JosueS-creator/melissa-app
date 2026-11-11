import { useEffect, useState } from 'react'
import { activarPush, desactivarPush, obtenerEstadoPush } from '../lib/pushNotifications'
import { supabase } from '../lib/supabaseClient'

export default function PushRecordatorios({ perfil, paciente, habilitado }) {
  const [estado, setEstado] = useState({ compatible: true, permiso: 'default', suscripcion: null })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [enviandoPrueba, setEnviandoPrueba] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function revisar() {
    try {
      const resultado = await obtenerEstadoPush()
      setEstado(resultado)
    } catch {
      setEstado({ compatible: false, permiso: 'unsupported', suscripcion: null })
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { revisar() }, [])

  async function activar() {
    if (!perfil?.id || !paciente?.id || !habilitado) return
    setGuardando(true)
    setMensaje('')
    try {
      await activarPush({ perfil, paciente })
      await revisar()
      setMensaje('Notificaciones activadas en este dispositivo.')
    } catch (error) {
      setMensaje(error.message || 'No se pudieron activar las notificaciones.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar() {
    setGuardando(true)
    setMensaje('')
    try {
      await desactivarPush(perfil.id)
      await revisar()
      setMensaje('Este dispositivo ya no recibirá notificaciones.')
    } catch (error) {
      setMensaje(error.message || 'No se pudo desactivar este dispositivo.')
    } finally {
      setGuardando(false)
    }
  }

  async function enviarPrueba() {
    if (!estado.suscripcion || enviandoPrueba) return
    setEnviandoPrueba(true)
    setMensaje('')
    try {
      const { data, error } = await supabase.functions.invoke('send-push-test', { body: {} })
      if (error) throw error
      if (!data?.sent) throw new Error('Melissa no pudo confirmar la entrega de la notificación.')
      setMensaje('Prueba enviada. Revisa las notificaciones de este dispositivo.')
    } catch (error) {
      setMensaje(error.message || 'No se pudo enviar la notificación de prueba.')
    } finally {
      setEnviandoPrueba(false)
    }
  }

  if (!perfil || !paciente || cargando) return null

  return (
    <div className="rounded-xl px-4 py-3 mt-2 mb-3" style={{ background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)', border: '1px solid var(--color-borde-tarjeta)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>Notificaciones en este dispositivo</p>
      {!habilitado ? (
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-texto-terciario)' }}>Activa primero «Recordatorios de cita» para recibir avisos.</p>
      ) : !estado.compatible ? (
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-texto-terciario)' }}>Este navegador no admite notificaciones push. Prueba con la app instalada o un navegador compatible.</p>
      ) : estado.suscripcion ? (
        <>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-texto-secundario)' }}>Este dispositivo está autorizado para recibir recordatorios.</p>
          <button type="button" onClick={enviarPrueba} disabled={enviandoPrueba || guardando} className="rounded-lg px-3 py-2 mt-2 text-xs text-white disabled:opacity-50" style={{ background: 'var(--gradiente-primario)' }}>
            {enviandoPrueba ? 'Enviando prueba...' : 'Enviar notificación de prueba'}
          </button>
          <button type="button" onClick={desactivar} disabled={guardando || enviandoPrueba} className="block text-xs mt-3 disabled:opacity-50" style={{ color: 'var(--color-primary)' }}>
            {guardando ? 'Guardando...' : 'Desactivar en este dispositivo'}
          </button>
        </>
      ) : estado.permiso === 'denied' ? (
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-texto-terciario)' }}>El navegador bloqueó las notificaciones. Debes permitirlas desde los ajustes del navegador o del dispositivo.</p>
      ) : (
        <>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-texto-secundario)' }}>Autoriza este dispositivo para recibir avisos automáticos antes de tus citas confirmadas.</p>
          <button type="button" onClick={activar} disabled={guardando} className="rounded-lg px-3 py-2 mt-2 text-xs text-white disabled:opacity-50" style={{ background: 'var(--gradiente-primario)' }}>
            {guardando ? 'Activando...' : 'Activar notificaciones'}
          </button>
        </>
      )}
      {mensaje && <p className="text-[10px] mt-2" style={{ color: 'var(--color-primary)' }}>{mensaje}</p>}
    </div>
  )
}
