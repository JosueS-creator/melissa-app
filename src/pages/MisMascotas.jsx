import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'

const TIPOS = { consulta:'Consulta', vacuna:'Vacunación', desparasitacion:'Desparasitación', tratamiento:'Tratamiento', cirugia:'Cirugía', otro:'Otro' }

export default function MisMascotas({ onVolver }) {
  const [mascotas, setMascotas] = useState([])
  const [historial, setHistorial] = useState([])
  const [seleccionada, setSeleccionada] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    async function cargar() {
      const paciente = await obtenerPacienteActual()
      if (!paciente) { if (vivo) { setError('No encontramos tu perfil de propietario.'); setCargando(false) }; return }
      const { data, error: e } = await supabase.from('mascotas').select('id,nombre,especie,raza,sexo,fecha_nacimiento,peso,microchip,observaciones').eq('clinica_id', paciente.clinica_id).eq('propietario_paciente_id', paciente.id).eq('activo', true).order('nombre')
      if (!vivo) return
      if (e) setError('El expediente de mascotas todavía no está habilitado en esta clínica.')
      setMascotas(data || [])
      setCargando(false)
    }
    cargar()
    return () => { vivo = false }
  }, [])

  async function verExpediente(mascota) {
    setSeleccionada(mascota); setHistorial([]); setError('')
    const { data, error: e } = await supabase.from('historial_veterinario').select('id,tipo,fecha,motivo,notas,peso,proxima_fecha').eq('mascota_id', mascota.id).order('fecha', { ascending: false })
    if (e) setError('No se pudo cargar el historial. Solicita a la clínica que habilite el acceso del propietario.')
    setHistorial(data || [])
  }

  return <div className="min-h-screen px-5 pb-10 pt-[calc(env(safe-area-inset-top)+18px)]" style={{background:'var(--color-fondo-app)'}}>
    <button onClick={onVolver} className="text-sm mb-5" style={{color:'var(--color-primary)'}}>← Volver</button>
    <p className="text-xs uppercase tracking-widest" style={{color:'var(--color-texto-secundario)'}}>Melissa Pets</p>
    <h1 className="font-display text-3xl mt-1" style={{color:'var(--color-ink)'}}>Mis mascotas</h1>
    <p className="text-sm mt-2 mb-5" style={{color:'var(--color-texto-secundario)'}}>Consulta las fichas y el seguimiento veterinario de tus compañeros.</p>
    {error && <p role="alert" className="rounded-xl p-3 mb-3 text-sm bg-amber-50 text-amber-800">{error}</p>}
    {cargando ? <p className="text-sm">Cargando tus mascotas…</p> : seleccionada ? <section className="rounded-2xl bg-white border p-4" style={{borderColor:'var(--color-borde-tarjeta)'}}>
      <button onClick={() => setSeleccionada(null)} className="text-xs mb-3" style={{color:'var(--color-primary)'}}>← Todas mis mascotas</button>
      <h2 className="font-display text-2xl" style={{color:'var(--color-ink)'}}>{seleccionada.nombre}</h2>
      <p className="text-sm mt-1" style={{color:'var(--color-texto-secundario)'}}>{seleccionada.especie}{seleccionada.raza ? ' · '+seleccionada.raza : ''}{seleccionada.sexo ? ' · '+seleccionada.sexo : ''}</p>
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        {seleccionada.fecha_nacimiento && <p>Nacimiento: {seleccionada.fecha_nacimiento}</p>}
        {seleccionada.peso != null && <p>Peso: {seleccionada.peso} kg</p>}
        {seleccionada.microchip && <p className="col-span-2">Microchip: {seleccionada.microchip}</p>}
      </div>
      <h3 className="font-semibold text-sm mt-5 mb-2">Historial veterinario</h3>
      {!historial.length ? <p className="text-sm" style={{color:'var(--color-texto-secundario)'}}>No hay atenciones registradas o aún no se ha habilitado su consulta.</p> : <div className="space-y-2">{historial.map(h=><article key={h.id} className="rounded-xl border p-3" style={{borderColor:'var(--color-borde-tarjeta)'}}><div className="flex justify-between text-xs"><b>{TIPOS[h.tipo] || h.tipo}</b><time>{h.fecha}</time></div><p className="text-sm mt-1">{h.motivo}</p>{h.notas && <p className="text-xs mt-1 whitespace-pre-wrap">{h.notas}</p>}{h.proxima_fecha && <p className="text-xs mt-2" style={{color:'var(--color-primary)'}}>Próximo control: {h.proxima_fecha}</p>}</article>)}</div>}
    </section> : <div className="space-y-3">
      {!mascotas.length && <div className="rounded-2xl border border-dashed p-6 text-center"><div className="text-3xl">🐾</div><p className="font-medium mt-2">Aún no tienes mascotas registradas</p><p className="text-xs mt-1" style={{color:'var(--color-texto-secundario)'}}>La clínica podrá crear sus fichas y vincularlas a tu cuenta.</p></div>}
      {mascotas.map(m=><button key={m.id} onClick={()=>verExpediente(m)} className="w-full rounded-2xl bg-white border p-4 flex items-center gap-3 text-left" style={{borderColor:'var(--color-borde-tarjeta)'}}><span className="text-2xl">🐾</span><span className="flex-1"><b className="block text-sm">{m.nombre}</b><small style={{color:'var(--color-texto-secundario)'}}>{m.especie}{m.raza ? ' · '+m.raza : ''}</small></span><span style={{color:'var(--color-primary)'}}>›</span></button>)}
    </div>}
  </div>
}
