import { supabase } from './supabaseClient'

/**
 * Registra un paciente nuevo. La creación de sus filas en `perfiles` y
 * `pacientes` NO se hace aquí: la maneja un trigger en la base de datos
 * (`crear_perfil_y_paciente`) que se dispara al crearse el usuario en
 * Supabase Auth. Esto evita el problema de RLS cuando la confirmación
 * de correo está activada (sin sesión activa, el navegador no puede
 * insertar directamente, pero el trigger corre con privilegios de sistema).
 *
 * NOTA: por ahora asume una sola clínica (slug 'demo'). Cuando haya más
 * clínicas, el slug debe resolverse por subdominio y pasarse como parámetro.
 */
export async function registrarPaciente({ email, password, nombre, telefono, pais }) {
  const { data: clinica, error: errorClinica } = await supabase
    .from('clinicas')
    .select('id')
    .eq('slug', 'demo')
    .single()

  if (errorClinica || !clinica) {
    throw new Error('No se pudo identificar la clínica. Intenta de nuevo.')
  }

  const { data: authData, error: errorAuth } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, telefono, pais, clinica_id: clinica.id },
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
