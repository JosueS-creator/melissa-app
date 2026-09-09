import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import { calcularNivelYProgreso } from '../lib/fidelidad'
import logoMelissa from '../assets/melissa-logo-64.png'
import logoMelissaMarcaAgua from '../assets/melissa-logo-256.png'

export default function Home({ nombrePaciente = 'Cliente', clinica, onNavigate }) {
  const [paciente, setPaciente] = useState(null)
  const [puntos, setPuntos] = useState(0)
  const [proximaCita, setProximaCita] = useState(null)
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const p = await obtenerPacienteActual()
      setPaciente(p)
      if (!p) {
        setCargando(false)
        return
      }

      const [{ data: movimientos }, { data: citas }, { data: destacados }] = await Promise.all([
        supabase.from('puntos_movimientos').select('puntos').eq('paciente_id', p.id),
        supabase
          .from('citas')
          .select('*, especialistas(nombre)')
          .eq('paciente_id', p.id)
          .in('estado', ['pendiente', 'confirmada'])
          .gte('fecha_hora', new Date().toISOString())
          .order('fecha_hora', { ascending: true })
          .limit(1),
        supabase.from('productos').select('*').eq('clinica_id', p.clinica_id).eq('activo', true).limit(2),
      ])

      setPuntos((movimientos || []).reduce((sum, m) => sum + m.puntos, 0))
      setProximaCita(citas?.[0] || null)
      setProductos(destacados || [])
      setCargando(false)
    }
    cargar()
  }, [])

  const { nivelActual, siguienteNivel, progreso, puntosParaSiguiente } = calcularNivelYProgreso(puntos)

  return (
    <div className="" style={{ background: 'var(--color-fondo-app)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="flex items-center gap-2.5">
          <img
            src={clinica?.logo_url || logoMelissa}
            alt={clinica?.nombre || 'Melissa'}
            className="w-11 h-11 rounded-xl object-cover"
          />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.2, color: 'var(--color-ink)' }}>
              Hola, {nombrePaciente}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-texto-secundario)' }}>
              {clinica?.nombre}{clinica?.ciudad ? ` · ${clinica.ciudad}` : ''}
            </p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full" style={{ background: 'var(--color-accent)' }} />
      </div>

      <div className="px-5 pt-4">
        {/* Tarjeta de puntos */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden shadow-tarjeta-oscura"
          style={{ background: 'var(--gradiente-fondo-oscuro)' }}
        >
          <img
            src={logoMelissaMarcaAgua}
            alt=""
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{ top: -20, right: -30, width: 180, height: 180, opacity: 0.13, objectFit: 'contain' }}
          />
          <div className="flex justify-between items-start">
            <p style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-dorado-claro)' }}>
              Beauty Points
            </p>
            <span
              className="px-2 py-1 rounded-sm"
              style={{
                font: "500 9px/1 var(--font-body)",
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#F6C2D6',
                border: '1px solid rgba(235,203,134,0.55)',
              }}
            >
              Nivel {nivelActual.nombre}
            </span>
          </div>

          <p className="mt-3" style={{ fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1, color: '#FFFFFF' }}>
            {puntos.toLocaleString()} <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-dorado-claro)' }}>pts</span>
          </p>

          <div className="mt-4 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: 'var(--gradiente-dorado)' }} />
          </div>
          {siguienteNivel && (
            <p className="mt-2 text-[11px]" style={{ color: 'rgba(233,169,193,0.8)' }}>
              {puntosParaSiguiente} pts para {siguienteNivel.nombre}
            </p>
          )}
        </div>

        {/* Próxima cita */}
        <div className="mt-4 bg-white rounded-2xl p-4 shadow-tarjeta-blanca border" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
          <p style={{ font: "500 10px/1 var(--font-body)", letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-texto-terciario)' }}>
            Tu próxima cita
          </p>
          {proximaCita ? (
            <div className="flex gap-3 mt-2.5 items-start">
              <div className="text-center pr-3" style={{ borderRight: '1px solid #F6E3EA' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--color-primary)', lineHeight: 1 }}>
                  {new Date(proximaCita.fecha_hora).getDate()}
                </p>
                <p className="text-[10px] uppercase mt-0.5" style={{ color: 'var(--color-texto-terciario)' }}>
                  {new Date(proximaCita.fecha_hora).toLocaleDateString('es-HN', { month: 'short' })}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{proximaCita.tratamiento || 'Cita agendada'}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-texto-secundario)' }}>
                  {new Date(proximaCita.fecha_hora).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' })}
                  {proximaCita.especialistas?.nombre ? ` · ${proximaCita.especialistas.nombre}` : ''}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onNavigate('agenda')}
                    className="flex-1 rounded-[10px] py-2.5 text-white shadow-boton-primario"
                    style={{ background: 'var(--gradiente-primario)', font: "500 12px/1 var(--font-body)", letterSpacing: '0.04em' }}
                  >
                    Ver detalles
                  </button>
                  <button
                    onClick={() => onNavigate('agenda')}
                    className="flex-1 rounded-[10px] py-2.5"
                    style={{ background: '#FFFDF9', border: '1px solid var(--color-dorado-claro)', color: 'var(--color-primary)', font: "500 12px/1 var(--font-body)", letterSpacing: '0.04em' }}
                  >
                    Reprogramar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm" style={{ color: 'var(--color-texto-secundario)' }}>No tienes citas próximas.</p>
              <button
                onClick={() => onNavigate('agenda')}
                className="mt-3 w-full rounded-[10px] py-2.5 text-white shadow-boton-primario"
                style={{ background: 'var(--gradiente-primario)', font: "500 12px/1 var(--font-body)", letterSpacing: '0.04em' }}
              >
                Reservar cita
              </button>
            </div>
          )}
        </div>

        {/* Para ti */}
        {productos.length > 0 && (
          <div className="mt-6 pb-8">
            <div className="flex justify-between items-baseline mb-3">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--color-ink)' }}>Para ti</p>
              <button onClick={() => onNavigate('tienda')} className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                Ver todo
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {productos.map((p) => (
                <div key={p.id} className="rounded-[14px] overflow-hidden bg-white border" style={{ borderColor: 'var(--color-borde-tarjeta)' }}>
                  <div className="h-[92px] flex items-center justify-center" style={{ background: '#FDEFF4' }}>
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>Foto producto</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-[13px]" style={{ color: 'var(--color-ink)' }}>{p.nombre}</p>
                    <p className="mt-1" style={{ font: "500 12px/1 var(--font-body)", color: 'var(--color-primary)' }}>
                      L {Number(p.precio).toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
