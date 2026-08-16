import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPerfilActual } from '../lib/auth'

const TEMAS = [
  { id: 'elegante_dorado', nombre: 'Elegante Dorado', primario: '#C9A24B', secundario: '#FFFFFF', acento: '#F5EFE6' },
  { id: 'clinico_minimal', nombre: 'Clínico Minimal', primario: '#2D6E8E', secundario: '#FFFFFF', acento: '#EAF2F5' },
  { id: 'spa_natural', nombre: 'Spa Natural', primario: '#6B8E5A', secundario: '#FFFFFF', acento: '#EFF3E8' },
]

export default function Personalizacion() {
  const [perfil, setPerfil] = useState(null)
  const [clinica, setClinica] = useState(null)
  const [temaSeleccionado, setTemaSeleccionado] = useState('elegante_dorado')
  const [colorPrimario, setColorPrimario] = useState('')
  const [colorSecundario, setColorSecundario] = useState('')
  const [colorAcento, setColorAcento] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function cargar() {
      const p = await obtenerPerfilActual()
      setPerfil(p)
      if (!p) {
        setCargando(false)
        return
      }
      const { data } = await supabase.from('clinicas').select('*').eq('id', p.clinica_id).single()
      if (data) {
        setClinica(data)
        setTemaSeleccionado(data.tema_base_id || 'elegante_dorado')
        setColorPrimario(data.color_primario || '')
        setColorSecundario(data.color_secundario || '')
        setColorAcento(data.color_acento || '')
        setLogoPreview(data.logo_url || null)
      }
      setCargando(false)
    }
    cargar()
  }, [])

  const temaActivo = TEMAS.find((t) => t.id === temaSeleccionado) || TEMAS[0]
  const previewPrimario = colorPrimario || temaActivo.primario
  const previewAcento = colorAcento || temaActivo.acento

  function elegirLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function guardar() {
    if (!clinica) return
    setGuardando(true)
    setMensaje('')

    let logoUrl = clinica.logo_url

    if (logoFile) {
      const extension = logoFile.name.split('.').pop()
      const ruta = `${clinica.id}/logo.${extension}`
      const { error: errorSubida } = await supabase.storage
        .from('logos-clinicas')
        .upload(ruta, logoFile, { upsert: true })

      if (errorSubida) {
        setMensaje('No se pudo subir el logo: ' + errorSubida.message)
        setGuardando(false)
        return
      }
      const { data: publicUrl } = supabase.storage.from('logos-clinicas').getPublicUrl(ruta)
      logoUrl = publicUrl.publicUrl
    }

    const { error } = await supabase
      .from('clinicas')
      .update({
        tema_base_id: temaSeleccionado,
        color_primario: colorPrimario || null,
        color_secundario: colorSecundario || null,
        color_acento: colorAcento || null,
        logo_url: logoUrl,
      })
      .eq('id', clinica.id)

    if (error) {
      setMensaje('No se pudo guardar: ' + error.message)
    } else {
      setMensaje('Cambios guardados ✓')
      document.documentElement.style.setProperty('--color-primary', colorPrimario || temaActivo.primario)
      document.documentElement.style.setProperty('--color-accent', colorAcento || temaActivo.acento)
    }
    setGuardando(false)
  }

  if (cargando) return <p className="text-center pt-16 text-sm text-ink/60">Cargando...</p>
  if (!perfil) return <p className="text-center pt-16 text-sm text-ink/60">Inicia sesión para continuar.</p>
  if (perfil.rol !== 'admin') {
    return (
      <p className="text-center pt-16 text-sm text-ink/60 px-8">
        Esta sección es solo para administradores de la clínica.
      </p>
    )
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen px-5 pt-8 pb-10 font-body">
      <p className="font-display text-xl text-ink mb-1">Personaliza tu app</p>
      <p className="text-xs text-ink/50 mb-6">Así se verá la app para tus pacientes.</p>

      <p className="text-sm font-medium text-ink mb-2">Logo de tu clínica</p>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-ink/30">Sin logo</span>
          )}
        </div>
        <label className="text-xs font-medium px-4 py-2 rounded-lg cursor-pointer" style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>
          Subir logo
          <input type="file" accept="image/*" onChange={elegirLogo} className="hidden" />
        </label>
      </div>

      <p className="text-sm font-medium text-ink mb-2">Elige un tema base</p>
      <div className="flex flex-col gap-2 mb-6">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemaSeleccionado(t.id)}
            className="flex items-center gap-3 rounded-xl p-3 text-left"
            style={{
              background: '#FAFAFA',
              border: temaSeleccionado === t.id ? `1.5px solid ${t.primario}` : '1.5px solid transparent',
            }}
          >
            <div className="flex gap-1">
              <span className="w-5 h-5 rounded-full" style={{ background: t.primario }} />
              <span className="w-5 h-5 rounded-full border" style={{ background: t.acento }} />
            </div>
            <span className="text-sm text-ink">{t.nombre}</span>
          </button>
        ))}
      </div>

      <p className="text-sm font-medium text-ink mb-2">Ajusta tus colores (opcional)</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div>
          <label className="text-[10px] text-ink/50 block mb-1">Primario</label>
          <input type="color" value={colorPrimario || temaActivo.primario} onChange={(e) => setColorPrimario(e.target.value)} className="w-full h-9 rounded-lg" />
        </div>
        <div>
          <label className="text-[10px] text-ink/50 block mb-1">Secundario</label>
          <input type="color" value={colorSecundario || temaActivo.secundario} onChange={(e) => setColorSecundario(e.target.value)} className="w-full h-9 rounded-lg" />
        </div>
        <div>
          <label className="text-[10px] text-ink/50 block mb-1">Acento</label>
          <input type="color" value={colorAcento || temaActivo.acento} onChange={(e) => setColorAcento(e.target.value)} className="w-full h-9 rounded-lg" />
        </div>
      </div>

      <p className="text-sm font-medium text-ink mb-2">Vista previa</p>
      <div className="rounded-2xl overflow-hidden border border-ink/10 mb-6">
        <div className="p-4" style={{ background: previewAcento }}>
          <div className="flex items-center gap-2">
            {logoPreview && <img src={logoPreview} alt="" className="w-6 h-6 rounded-full object-cover" />}
            <p className="text-xs text-ink/60">Bienvenida a tu clínica</p>
          </div>
          <button className="mt-3 text-xs text-white px-4 py-2 rounded-lg" style={{ background: previewPrimario }}>
            Reservar cita
          </button>
        </div>
      </div>

      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full rounded-xl py-3 text-white text-sm font-medium disabled:opacity-50"
        style={{ background: previewPrimario }}
      >
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {mensaje && <p className="text-center text-xs mt-3 text-ink/60">{mensaje}</p>}
    </div>
  )
}
