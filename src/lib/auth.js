import { supabase } from './supabaseClient'

/**
 * Registra un paciente nuevo. La creación de sus filas en `perfiles` y
 * `pacientes` NO se hace aquí: la maneja un trigger en la base de datos
 * (`crear_perfil_y_paciente`) que se dispara al crearse el usuario en
 * Supabase Auth. Esto evita el problema de RLS cuando la confirmación
 * de correo está activada (sin sesión activa, el navegador no puede
 * insertar directamente, pero el trigger corre con privilegios de sistema).
 *
 * `slugClinica` lo resuelve lib/tenant.js desde el link o QR que cada negocio
 * comparte con sus clientes. Sin negocio no hay registro (no existe un negocio
 * por defecto).
 */
export async function registrarPaciente({ email, password, nombre, telefono, pais, slugClinica, fechaNacimiento }) {
  if (!slugClinica) {
    throw new Error('Para crear tu cuenta necesitas el link o el QR de tu negocio.')
  }

  const { data: clinica, error: errorClinica } = await supabase.rpc('clinica_publica_por_slug', { p_slug: slugClinica })

  if (errorClinica || !clinica) {
    throw new Error('No se pudo identificar la clínica. Verifica el link que usaste para registrarte.')
  }

  const { data: authData, error: errorAuth } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El email lo guarda el servidor desde auth; la fecha de nacimiento es opcional.
      data: { nombre, telefono, pais, clinica_id: clinica.id, ...(fechaNacimiento ? { fecha_nacimiento: fechaNacimiento } : {}) },
    },
  })
  if (errorAuth) throw errorAuth

  const requiereConfirmacion = !authData.session
  return { requiereConfirmacion, usuario: authData.user }
}

export async function iniciarSesion({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function obtenerSesionActual() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Obtiene la fila de `perfiles` del usuario autenticado (incluye rol y
 * clinica_id) — necesaria para saber si puede acceder al panel de admin.
 */
export async function obtenerPerfilActual() {
  const { data: sesion } = await supabase.auth.getSession()
  const usuario = sesion.session?.user
  if (!usuario) return null

  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', usuario.id)
    .single()

  if (error) return null
  return data
}

/**
 * Obtiene la fila de `pacientes` correspondiente al usuario autenticado
 * (necesaria para reservar citas, ver historial, etc.)
 */
export async function obtenerPacienteActual() {
  const { data: sesion } = await supabase.auth.getSession()
  const usuario = sesion.session?.user
  if (!usuario) return null

  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('perfil_id', usuario.id)
    .single()

  if (error) return null
  return data
}
