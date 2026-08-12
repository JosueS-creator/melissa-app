import { supabase } from './supabaseClient'

/**
 * Registra un paciente nuevo:
 * 1. Crea el usuario en Supabase Auth.
 * 2. Crea su fila en `perfiles` (ligada a la clínica).
 * 3. Crea su fila en `pacientes` (donde vive su historial, citas, etc.)
 *
 * NOTA: por ahora asume una sola clínica (slug 'demo'). Cuando haya más
 * clínicas, el slug debe resolverse por subdominio y pasarse como parámetro.
 */
export async function registrarPaciente({ email, password, nombre, telefono }) {
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
  })
  if (errorAuth) throw errorAuth

  const usuario = authData.user
  if (!usuario) {
    // Puede pasar si Supabase requiere confirmación de correo antes de crear sesión.
    return { requiereConfirmacion: true }
  }

  const { error: errorPerfil } = await supabase.from('perfiles').insert({
    id: usuario.id,
    clinica_id: clinica.id,
    nombre,
    telefono,
    rol: 'paciente',
  })
  if (errorPerfil) throw errorPerfil

  const { error: errorPaciente } = await supabase.from('pacientes').insert({
    clinica_id: clinica.id,
    perfil_id: usuario.id,
    nombre,
    telefono,
  })
  if (errorPaciente) throw errorPaciente

  return { requiereConfirmacion: false, usuario }
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
