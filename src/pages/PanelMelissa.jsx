import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TIPOS_NEGOCIO, sustantivoNegocio } from '../lib/tiposNegocio'
import { descargarDatosClinica } from '../lib/exportarDatosClinica'
import { validarTelefono, validarWhatsapp } from '../lib/contacto'

const TEMAS = [
  { id: 'elegante_dorado', nombre: 'Elegante Dorado' },
  { id: 'clinico_minimal', nombre: 'Clínico Minimal' },
  { id: 'spa_natural', nombre: 'Spa Natural' },
]

/** Datos de contacto de un negocio (solo Super Administración; la base lo exige). Si ambos quedan vacíos se borra el registro. */
function EditorContacto({ clinica, contacto, onGuardado }) {
  const [telefono, setTelefono] = useState(contacto?.telefono_contacto || '')
  const [whatsapp, setWhatsapp] = useState(contacto?.whatsapp_contacto || '')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function guardar() {
    const problema = validarTelefono(telefono) || validarWhatsapp(whatsapp, clinica.pais)
    if (problema) {
      setMensaje(problema)
      return
    }
    setGuardando(true)
    setMensaje('')
    const tel = telefono.trim() || null
    const wa = whatsapp.trim() || null
    const { error } = tel || wa
      ? await supabase.from('clinica_contacto').upsert({ clinica_id: clinica.id, telefono_contacto: tel, whatsapp_contacto: wa }, { onConflict: 'clinica_id' })
      : await supabase.from('clinica_contacto').delete().eq('clinica_id', clinica.id)
    setGuardando(false)
    if (error) {
      setMensaje('No se pudo guardar: ' + error.message)
      return
    }
    setMensaje('Contacto guardado ✓')
    onGuardado()
  }

  return (
    <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-borde-tarjeta)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>Datos de contacto de {clinica.nombre}</p>
      <label className="flex flex-col gap-1">
        <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Teléfono</span>
        <input type="tel" className="rounded-lg px-3 py-2 text-sm bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+504 2222-3333" />
        <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Los clientes podrán usarlo para llamar al negocio.</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>WhatsApp</span>
        <input type="tel" className="rounded-lg px-3 py-2 text-sm bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+504 9999-0000" />
        <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Los clientes podrán usarlo para contactar al negocio por WhatsApp.</span>
      </label>
      {mensaje && <p className="text-xs" style={{ color: mensaje.endsWith('✓') ? 'var(--color-primary)' : '#B0524A' }}>{mensaje}</p>}
      <button onClick={guardar} disabled={guardando} className="rounded-lg py-2 text-xs font-medium text-white disabled:opacity-60" style={{ background: 'var(--gradiente-primario)' }}>
        {guardando ? 'Guardando...' : 'Guardar contacto'}
      </button>
    </div>
  )
}

function generarSlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function PanelMelissa({ onVolver }) {
  const [clinicas, setClinicas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [descargados, setDescargados] = useState(new Set())
  const [nombre, setNombre] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [pais, setPais] = useState('HN')
  const [tipoNegocio, setTipoNegocio] = useState('clinica_estetica')
  const [temaBase, setTemaBase] = useState('elegante_dorado')
  const [telefonoContacto, setTelefonoContacto] = useState('')
  const [whatsappContacto, setWhatsappContacto] = useState('')
  const [contactos, setContactos] = useState({})
  const [editandoContacto, setEditandoContacto] = useState(null)
  const [creando, setCreando] = useState(false)
  const [linkGenerado, setLinkGenerado] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarClinicas()
  }, [])

  async function cargarClinicas() {
    const { data } = await supabase.from('clinicas').select('*').order('fecha_creacion', { ascending: false })
    const lista = data || []

    const conStats = await Promise.all(
      lista.map(async (c) => {
        const [{ count: pacientes }, { count: citas }] = await Promise.all([
          supabase.from('pacientes').select('id', { count: 'exact', head: true }).eq('clinica_id', c.id),
          supabase.from('citas').select('id', { count: 'exact', head: true }).eq('clinica_id', c.id),
        ])
        return { ...c, _pacientes: pacientes || 0, _citas: citas || 0 }
      })
    )

    const { data: dataContactos } = await supabase.from('clinica_contacto').select('clinica_id, telefono_contacto, whatsapp_contacto')
    setContactos(Object.fromEntries((dataContactos || []).map((r) => [r.clinica_id, r])))
    setClinicas(conStats)
    setCargando(false)
  }

  async function alternarActiva(clinica) {
    await supabase.from('clinicas').update({ activa: !clinica.activa }).eq('id', clinica.id)
    cargarClinicas()
  }

  async function descargarHistorial(clinica) {
    await descargarDatosClinica(clinica.id, clinica.nombre)
    setDescargados((prev) => new Set(prev).add(clinica.id))
  }

  async function eliminarNegocio(clinica) {
    const confirmado = window.confirm(
      `Esto borra "${clinica.nombre}" y TODA su información (clientes, citas, historial, pagos) de forma permanente. ¿Confirmas?`
    )
    if (!confirmado) return
    await supabase.from('clinicas').delete().eq('id', clinica.id)
    cargarClinicas()
  }

  async function crearClinica(e) {
    e.preventDefault()
    setCreando(true)
    setError('')
    setLinkGenerado(null)

    const problemaContacto = validarTelefono(telefonoContacto) || validarWhatsapp(whatsappContacto, pais)
    if (problemaContacto) {
      setError(problemaContacto)
      setCreando(false)
      return
    }

    const slug = generarSlug(nombre) + '-' + Math.random().toString(36).slice(2, 6)

    const { data: nuevaClinica, error: errorClinica } = await supabase
      .from('clinicas')
      .insert({
        nombre,
        ciudad,
        pais,
        slug,
        moneda: pais === 'ES' ? 'EUR' : 'HNL',
        plan: 'starter',
        tema_base_id: temaBase,
        tipo_negocio: tipoNegocio,
      })
      .select()
      .single()

    if (errorClinica || !nuevaClinica) {
      setError('No se pudo crear el negocio: ' + errorClinica?.message)
      setCreando(false)
      return
    }

    let avisoContacto = ''
    if (telefonoContacto.trim() || whatsappContacto.trim()) {
      const { error: errorContacto } = await supabase.from('clinica_contacto').upsert(
        { clinica_id: nuevaClinica.id, telefono_contacto: telefonoContacto.trim() || null, whatsapp_contacto: whatsappContacto.trim() || null },
        { onConflict: 'clinica_id' }
      )
      if (errorContacto) avisoContacto = 'Negocio creado, pero no se pudo guardar el contacto (puedes registrarlo con el botón Contacto): ' + errorContacto.message
    }

    const { data: codigo, error: errorInvitacion } = await supabase.rpc('generar_invitacion_admin', {
      p_clinica_id: nuevaClinica.id,
    })

    if (errorInvitacion) {
      setError('Negocio creado, pero no se pudo generar la invitación: ' + errorInvitacion.message)
    } else {
      const link = `${window.location.origin}/?invitacion=${codigo}`
      setLinkGenerado({ link, clinica: nuevaClinica.nombre })
      setNombre('')
      setCiudad('')
      setTelefonoContacto('')
      setWhatsappContacto('')
      if (avisoContacto) setError(avisoContacto)
    }

    cargarClinicas()
    setCreando(false)
  }

  async function generarNuevaInvitacion(clinicaId, clinicaNombre) {
    const { data: codigo, error: errorInvitacion } = await supabase.rpc('generar_invitacion_admin', {
      p_clinica_id: clinicaId,
    })
    if (!errorInvitacion) {
      const link = `${window.location.origin}/?invitacion=${codigo}`
      setLinkGenerado({ link, clinica: clinicaNombre })
    }
  }

  function copiar(texto) {
    navigator.clipboard?.writeText(texto)
  }

  return (
    <div className="min-h-screen font-body px-5 pb-10" style={{ background: 'var(--color-fondo-app)', paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}>
      {onVolver && (
        <button onClick={onVolver} className="text-xs mb-3" style={{ color: 'var(--color-primary)' }}>‹ Volver al panel</button>
      )}
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-ink)' }}>Panel de Melissa</p>
      <p className="text-xs mb-6" style={{ color: 'var(--color-texto-secundario)' }}>Solo visible para ti — crea negocios y genera sus invitaciones.</p>

      <form onSubmit={crearClinica} className="flex flex-col gap-3 mb-6">
        <input
          className="rounded-xl px-4 py-3 text-sm bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          placeholder="Nombre del negocio"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          className="rounded-xl px-4 py-3 text-sm bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          placeholder="Ciudad"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          required
        />
        <select
          className="rounded-xl px-4 py-3 text-sm bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          value={tipoNegocio}
          onChange={(e) => setTipoNegocio(e.target.value)}
        >
          {TIPOS_NEGOCIO.map((t) => (
            <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
          ))}
        </select>
        <select
          className="rounded-xl px-4 py-3 text-sm bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          value={pais}
          onChange={(e) => setPais(e.target.value)}
        >
          <option value="HN">Honduras</option>
          <option value="ES">España</option>
        </select>
        <select
          className="rounded-xl px-4 py-3 text-sm bg-white"
          style={{ border: '1px solid var(--color-borde-tarjeta)' }}
          value={temaBase}
          onChange={(e) => setTemaBase(e.target.value)}
        >
          {TEMAS.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-ink)' }}>Datos de contacto</p>
        <label className="flex flex-col gap-1">
          <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Teléfono (opcional)</span>
          <input
            type="tel"
            className="rounded-xl px-4 py-3 text-sm bg-white"
            style={{ border: '1px solid var(--color-borde-tarjeta)' }}
            placeholder="+504 2222-3333"
            value={telefonoContacto}
            onChange={(e) => setTelefonoContacto(e.target.value)}
          />
          <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Los clientes podrán usarlo para llamar al negocio.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>WhatsApp (opcional)</span>
          <input
            type="tel"
            className="rounded-xl px-4 py-3 text-sm bg-white"
            style={{ border: '1px solid var(--color-borde-tarjeta)' }}
            placeholder="+504 9999-0000"
            value={whatsappContacto}
            onChange={(e) => setWhatsappContacto(e.target.value)}
          />
          <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Los clientes podrán usarlo para contactar al negocio por WhatsApp.</span>
        </label>
        <button
          type="submit"
          disabled={creando}
          className="rounded-xl py-3 text-white text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
        >
          {creando ? 'Creando...' : 'Crear negocio'}
        </button>
        {error && <p className="text-xs" style={{ color: '#B0524A' }}>{error}</p>}
      </form>

      {linkGenerado && (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--gradiente-dorado)' }}>
          <p className="text-xs" style={{ color: 'rgba(74,14,43,0.7)' }}>Link de invitación para el admin de "{linkGenerado.clinica}"</p>
          <p className="text-xs mt-2 break-all font-mono" style={{ color: 'var(--color-ink)' }}>{linkGenerado.link}</p>
          <button
            onClick={() => copiar(linkGenerado.link)}
            className="mt-2 px-4 py-2 rounded-lg text-white text-xs font-medium"
            style={{ background: 'var(--gradiente-primario)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 14px rgba(201,59,121,0.28)' }}
          >
            Copiar link
          </button>
        </div>
      )}

      <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ink)' }}>Negocios existentes</p>
      {cargando && <p className="text-sm" style={{ color: 'var(--color-texto-secundario)' }}>Cargando...</p>}
      <div className="flex flex-col gap-2">
        {clinicas.map((c) => (
          <div key={c.id} className="rounded-xl px-4 py-3" style={{ background: 'linear-gradient(160deg,#FFFFFF,#FDF7F9)', border: '1px solid var(--color-borde-tarjeta)', opacity: c.activa ? 1 : 0.6 }}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                  {c.nombre} {!c.activa && <span className="text-[10px]" style={{ color: '#B0524A' }}>(bloqueada)</span>}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>
                  {c.ciudad} · {c.pais} · {sustantivoNegocio(c.tipo_negocio)} · {c.plan}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-primary)' }}>
                  {c._pacientes} clientes · {c._citas} citas
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-texto-secundario)' }}>
                  {contactos[c.id]?.telefono_contacto || contactos[c.id]?.whatsapp_contacto
                    ? `Contacto: ${[contactos[c.id].telefono_contacto && `Tel. ${contactos[c.id].telefono_contacto}`, contactos[c.id].whatsapp_contacto && `WhatsApp ${contactos[c.id].whatsapp_contacto}`].filter(Boolean).join(' · ')}`
                    : 'Sin contacto registrado'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <button
                  onClick={() => generarNuevaInvitacion(c.id, c.nombre)}
                  className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}
                >
                  Nueva invitación
                </button>
                <button
                  onClick={() => alternarActiva(c)}
                  className="text-[11px] px-3 py-1.5 rounded-lg text-white"
                  style={{ background: c.activa ? '#B0524A' : 'var(--color-primary)' }}
                >
                  {c.activa ? 'Bloquear' : 'Reactivar'}
                </button>
                <button
                  onClick={() => setEditandoContacto(editandoContacto === c.id ? null : c.id)}
                  className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}
                >
                  Contacto
                </button>
                <button
                  onClick={() => descargarHistorial(c)}
                  className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}
                >
                  Descargar historial
                </button>
                <button
                  onClick={() => eliminarNegocio(c)}
                  disabled={!descargados.has(c.id)}
                  title={!descargados.has(c.id) ? 'Descarga el historial primero' : ''}
                  className="text-[11px] px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                  style={{ background: '#8E2255' }}
                >
                  Eliminar negocio
                </button>
              </div>
            </div>
            {editandoContacto === c.id && (
              <EditorContacto key={c.id} clinica={c} contacto={contactos[c.id]} onGuardado={cargarClinicas} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
