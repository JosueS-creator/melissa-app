import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerPacienteActual } from '../lib/auth'
import { calcularNivelYProgreso, obtenerUmbrales } from '../lib/fidelidad'
import { textoFechaHora } from '../lib/citas'
import PromocionesCliente from '../components/PromocionesCliente'
import ContactoNegocio from '../components/ContactoNegocio'
import FotoTarjeta, { TINTES } from '../components/FotoTarjeta'
import logoMelissa from '../assets/melissa-logo-64.png'
import logoMelissaMarcaAgua from '../assets/melissa-logo-256.png'

const BORDE = '1px solid var(--color-borde-tarjeta)'
const SOMBRA = '0 1px 2px rgba(74,14,43,0.04)'
const VERDE = '#4F7A3E' // estado "confirmada" (color semántico, igual en todos los temas)

const primerNombre = (nombre) => {
  const t = (nombre || '').trim()
  return t.includes('@') ? t : t.split(/\s+/)[0] || 'Cliente'
}
const precio = (n) => (n != null && Number(n) > 0 ? `L ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null)
const servicioDeCita = (cita, servicios) =>
  servicios.find((s) => s.id === cita.servicio_id) || servicios.find((s) => s.nombre === cita.tratamiento) || null

const Flecha = ({ tam = 16, color = 'currentColor' }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

function EnlaceSeccion({ children, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-none items-center gap-1 text-sm whitespace-nowrap" style={{ minHeight: 44, color: 'var(--color-texto-secundario)' }}>
      {children} <Flecha />
    </button>
  )
}

function Cabecera({ nombre, clinica, onNavigate }) {
  return (
    <header className="px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
      <div className="flex items-center justify-between">
        <span style={{ width: 44 }} />
        <div className="flex flex-col items-center gap-1.5">
          <img src={clinica?.logo_url || logoMelissa} alt="" className="w-9 h-9 rounded-[10px] object-cover" />
          <span style={{ font: '500 13px/1.2 var(--font-body)', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
            {clinica?.nombre || 'Melissa'}
          </span>
        </div>
        <button onClick={() => onNavigate?.('perfil')} aria-label="Mi perfil" className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3.2" />
            <path d="M5.8 18.6c1.3-2.3 3.5-3.6 6.2-3.6s4.9 1.3 6.2 3.6" />
          </svg>
        </button>
      </div>
      <h1 className="mt-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 30, lineHeight: 1.15, color: 'var(--color-ink)' }}>
        Hola, {primerNombre(nombre)}
      </h1>
      <p className="mt-1.5" style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--color-texto-secundario)' }}>
        Tu próximo momento de bienestar empieza aquí.
      </p>
    </header>
  )
}

function Cargando() {
  return (
    <div className="px-5 pb-8 flex flex-col gap-7" aria-busy="true">
      <p className="sr-only" role="status">Cargando tu información</p>
      <div className="mt-2" style={{ background: '#FFFFFF', border: BORDE, borderRadius: 22, padding: 20, display: 'flex', gap: 16, minHeight: 196 }}>
        <div className="sk flex-none" style={{ width: 60, height: 76, borderRadius: 14 }} />
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="sk" style={{ width: '80%', height: 20, borderRadius: 8 }} />
          <div className="sk" style={{ width: '60%', height: 14, borderRadius: 7 }} />
          <div className="sk" style={{ width: 120, height: 28, borderRadius: 999 }} />
        </div>
      </div>
      <div>
        <div className="sk mb-4" style={{ width: 210, height: 22, borderRadius: 8 }} />
        <div className="flex gap-3.5 overflow-hidden -mx-5 px-5">
          {[0, 1].map((i) => (
            <div key={i} className="flex-none" style={{ width: 164, background: '#FFFFFF', border: BORDE, borderRadius: 18, overflow: 'hidden' }}>
              <div className="sk" style={{ height: 118 }} />
              <div className="flex flex-col gap-2" style={{ padding: '12px 14px 14px' }}>
                <div className="sk" style={{ width: '85%', height: 16, borderRadius: 8 }} />
                <div className="sk" style={{ width: '65%', height: 13, borderRadius: 7 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="sk" style={{ height: 130, borderRadius: 22 }} />
    </div>
  )
}

function ErrorCarga({ onReintentar }) {
  return (
    <div className="px-5 pb-8">
      <div role="alert" className="mt-2 text-center" style={{ background: '#FFFFFF', border: BORDE, borderRadius: 22, padding: '28px 20px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.25, color: 'var(--color-ink)' }}>No pudimos cargar tu información</p>
        <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-texto-secundario)' }}>Revisa tu conexión e inténtalo de nuevo.</p>
        <button onClick={onReintentar} className="mt-4 rounded-xl px-6 text-sm font-medium text-white" style={{ minHeight: 48, background: 'var(--color-primary)' }}>
          Reintentar
        </button>
      </div>
    </div>
  )
}

function ProximaVisita({ cita, servicio, indiceServicio, onNavigate }) {
  const confirmada = cita.estado === 'confirmada'
  const titulo = cita.tratamiento || 'Cita agendada'
  const cuando = textoFechaHora(cita.fecha_hora)
  const detalle = confirmada ? 'confirmada por el negocio' : 'solicitada, esperando confirmación del negocio'
  const chip = confirmada
    ? { fondo: `color-mix(in srgb, ${VERDE} 12%, var(--color-fondo-app))`, texto: `color-mix(in srgb, ${VERDE} 90%, black)`, etiqueta: 'Confirmada' }
    : { fondo: 'color-mix(in srgb, var(--color-dorado) 16%, var(--color-fondo-app))', texto: 'color-mix(in srgb, var(--color-dorado) 62%, black)', etiqueta: 'Solicitada' }

  return (
    <section aria-label="Tu próxima visita">
      <a
        href="#agenda"
        onClick={(e) => { e.preventDefault(); onNavigate?.('agenda') }}
        aria-label={`Ver mis citas. Próxima visita: ${titulo}, ${cuando}, ${detalle}`}
        className="block relative overflow-hidden"
        style={{ minHeight: 196, borderRadius: 22, background: '#FFFFFF', border: BORDE, boxShadow: SOMBRA }}
      >
        <FotoTarjeta
          src={servicio?.imagen_url}
          nombre={titulo}
          tinte={TINTES[(indiceServicio >= 0 ? indiceServicio : 0) % TINTES.length]}
          tamanoInicial={96}
          inicialDerecha
          prioridad
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '54%', height: 'auto' }}
        />
        <div aria-hidden="true" className="absolute top-0 right-0 bottom-0" style={{ width: '54%', background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0) 48%)' }} />
        <div className="relative" style={{ padding: 20, width: '64%' }}>
          <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)' }}>Tu próxima visita</p>
          <p className="mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.2, color: 'var(--color-ink)' }}>{titulo}</p>
          <p className="mt-2.5 flex items-start gap-2" style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--color-ink)' }}>
            <svg className="flex-none mt-px" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-texto-secundario)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
              <path d="M8 3v4M16 3v4M3.5 10.5h17" />
            </svg>
            <span>
              {cuando}
              {cita.especialistas?.nombre && <span className="block" style={{ color: 'var(--color-texto-secundario)' }}>{cita.especialistas.nombre}</span>}
            </span>
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 rounded-full" style={{ padding: '6px 12px', background: chip.fondo, color: chip.texto, font: '500 13px/1.2 var(--font-body)' }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: chip.texto }} />
            {chip.etiqueta}
          </span>
        </div>
        <span aria-hidden="true" className="absolute flex items-center justify-center rounded-full" style={{ right: 16, bottom: 16, width: 40, height: 40, background: 'rgba(255,255,255,0.92)' }}>
          <Flecha tam={20} color="var(--color-ink)" />
        </span>
      </a>
      <div className="mt-3 px-1">
        {!confirmada && (
          <>
            <p style={{ font: '500 14px/1.4 var(--font-body)', color: chip.texto }}>Esperando confirmación del negocio</p>
            <p className="mt-0.5" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-texto-secundario)' }}>El negocio te confirmará o te propondrá otro horario.</p>
          </>
        )}
        <p className={confirmada ? '' : 'mt-2.5'} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-texto-secundario)' }}>
          Para cambiar o cancelar esta cita, comunícate con el negocio.
        </p>
        <ContactoNegocio />
      </div>
    </section>
  )
}

function SinCita({ onNavigate }) {
  return (
    <section aria-label="Tu próxima visita">
      <div className="relative overflow-hidden" style={{ borderRadius: 22, background: '#FFFFFF', border: BORDE, boxShadow: SOMBRA }}>
        <div aria-hidden="true" className="absolute top-0 right-0 bottom-0" style={{ width: '34%', background: TINTES[2] }}>
          <svg className="absolute" style={{ right: 20, bottom: 20 }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
            <path d="M8 3v4M16 3v4M3.5 10.5h17" />
          </svg>
        </div>
        <div className="relative" style={{ padding: '22px 20px 20px', width: '72%' }}>
          <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)' }}>Tu próxima visita</p>
          <p className="mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.2, color: 'var(--color-ink)' }}>Aún no tienes citas próximas</p>
          <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-texto-secundario)' }}>Elige un servicio y solicita tu cita. El negocio te la confirmará.</p>
          <button onClick={() => onNavigate?.('agenda')} className="mt-4 rounded-xl px-6 text-[15px] font-medium text-white" style={{ minHeight: 48, background: 'var(--color-primary)' }}>
            Solicitar cita
          </button>
        </div>
      </div>
    </section>
  )
}

function Servicios({ servicios, onNavigate }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="min-w-0 flex-1 pr-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 21, lineHeight: 1.2, color: 'var(--color-ink)' }}>Descubre nuestros servicios</h2>
        <EnlaceSeccion onClick={() => onNavigate?.('agenda')}>Ver todos</EnlaceSeccion>
      </div>
      <div className="flex gap-3.5 overflow-x-auto -mx-5 px-5 pb-1">
        {servicios.map((s, i) => {
          const meta = [s.duracion_minutos ? `${s.duracion_minutos} min` : null, precio(s.precio)].filter(Boolean)
          return (
            <a
              key={s.id}
              href="#agenda"
              onClick={(e) => { e.preventDefault(); onNavigate?.('agenda') }}
              className="flex-none block overflow-hidden"
              style={{ width: 164, background: '#FFFFFF', border: BORDE, borderRadius: 18, boxShadow: SOMBRA }}
            >
              <FotoTarjeta src={s.imagen_url} nombre={s.nombre} tinte={TINTES[i % TINTES.length]} alto={118} />
              <div style={{ padding: '12px 14px 14px' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.2, color: 'var(--color-ink)' }}>{s.nombre}</p>
                {s.descripcion && (
                  <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--color-texto-secundario)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.descripcion}
                  </p>
                )}
                {meta.length > 0 && (
                  <p className="mt-2.5" style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--color-ink)' }}>
                    {meta.map((m, k) => (
                      <span key={k}>
                        {k > 0 && <span style={{ color: 'var(--color-texto-secundario)', fontWeight: 400 }}> · </span>}
                        <span style={{ color: m.startsWith('L ') ? 'var(--color-primary)' : undefined }}>{m}</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function TarjetaPuntos({ puntos, umbrales, onNavigate }) {
  const { nivelActual, siguienteNivel, progreso, puntosParaSiguiente } = calcularNivelYProgreso(puntos, umbrales)
  const pie = siguienteNivel ? `${puntosParaSiguiente.toLocaleString()} pts para ${siguienteNivel.nombre}` : umbrales ? 'Nivel más alto alcanzado' : null

  return (
    <section>
      <a
        href="#tarjeta"
        onClick={(e) => { e.preventDefault(); onNavigate?.('tarjeta') }}
        aria-label="Ver mi tarjeta de Beauty Points y beneficios"
        className="relative flex items-center overflow-hidden gap-3.5"
        style={{ background: 'var(--gradiente-puntos)', borderRadius: 22, padding: 20, color: '#FFFFFF', isolation: 'isolate' }}
      >
        <img
          src={logoMelissaMarcaAgua}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ top: -20, right: -30, width: 180, height: 180, opacity: 0.13, objectFit: 'contain', zIndex: -1 }}
        />
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, lineHeight: 1.2 }}>Beauty Points</p>
          <p className="mt-1.5" style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1 }}>{puntos.toLocaleString()}</p>
          <p className="mt-1.5" style={{ fontSize: 13, lineHeight: 1.3 }}>Puntos acumulados</p>
        </div>
        <div aria-hidden="true" className="self-stretch" style={{ width: 1, background: 'rgba(255,255,255,0.28)' }} />
        <div className="flex-none" style={{ width: 128 }}>
          <span className="inline-flex items-center gap-1.5 rounded-[10px]" style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.18)', font: '500 14px/1.2 var(--font-body)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-dorado-claro)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
            </svg>
            <span><span className="sr-only">Nivel </span>{nivelActual.nombre}</span>
          </span>
          {siguienteNivel && (
            <div className="mt-3 overflow-hidden rounded-full" style={{ height: 6, background: 'rgba(255,255,255,0.28)' }}>
              <div className="h-full rounded-full" style={{ width: `${progreso}%`, background: '#FFFFFF' }} />
            </div>
          )}
          {pie && <p className="mt-2" style={{ fontSize: 13, lineHeight: 1.3 }}>{pie}</p>}
        </div>
        <Flecha tam={20} color="#FFFFFF" />
      </a>
      {puntos === 0 && (
        <p className="mt-2.5 px-1" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-texto-secundario)' }}>
          Tus puntos aparecerán aquí a medida que completes servicios y compras.
        </p>
      )}
    </section>
  )
}

function Productos({ productos, onNavigate }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 22, lineHeight: 1.2, color: 'var(--color-ink)' }}>Para ti</h2>
        <EnlaceSeccion onClick={() => onNavigate?.('tienda')}>Ver todas</EnlaceSeccion>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {productos.map((p, i) => (
          <a
            key={p.id}
            href="#tienda"
            onClick={(e) => { e.preventDefault(); onNavigate?.('tienda') }}
            className="block overflow-hidden"
            style={{ background: '#FFFFFF', border: BORDE, borderRadius: 18, boxShadow: SOMBRA }}
          >
            <FotoTarjeta src={p.imagen_url} nombre={p.nombre} tinte={TINTES[(i + 2) % TINTES.length]} alto={110} tamanoInicial={56} />
            <div style={{ padding: '12px 14px 14px' }}>
              <p style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--color-ink)' }}>{p.nombre}</p>
              {precio(p.precio) && <p className="mt-1.5" style={{ font: '500 14px/1.2 var(--font-body)', color: 'var(--color-primary)' }}>{precio(p.precio)}</p>}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

export default function Home({ nombrePaciente = 'Cliente', clinica, onNavigate }) {
  const [puntos, setPuntos] = useState(0)
  const [umbrales, setUmbrales] = useState(null)
  const [proximaCita, setProximaCita] = useState(null)
  const [servicios, setServicios] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(false)
    try {
      const p = await obtenerPacienteActual()
      if (!p) throw new Error('Sin perfil de cliente')

      const [movimientos, citas, destacados, catalogo] = await Promise.all([
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
        supabase.from('servicios').select('*').eq('clinica_id', p.clinica_id).eq('activo', true).order('nombre'),
      ])
      // Puntos y cita son lo esencial: si fallan no se muestran ceros como si fueran reales. Servicios y productos son accesorios.
      if (movimientos.error || citas.error) throw new Error('No se pudieron leer los datos')

      setPuntos((movimientos.data || []).reduce((sum, m) => sum + m.puntos, 0))
      setUmbrales(await obtenerUmbrales(p.clinica_id))
      setProximaCita(citas.data?.[0] || null)
      setProductos(destacados.data || [])
      setServicios(catalogo.data || [])
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const indiceServicio = proximaCita ? servicios.findIndex((s) => s === servicioDeCita(proximaCita, servicios)) : -1

  return (
    <div style={{ background: 'var(--color-fondo-app)' }}>
      <Cabecera nombre={nombrePaciente} clinica={clinica} onNavigate={onNavigate} />

      {cargando ? (
        <Cargando />
      ) : errorCarga ? (
        <ErrorCarga onReintentar={cargar} />
      ) : (
        <div className="px-5 pt-5 pb-8 flex flex-col gap-7">
          {proximaCita ? (
            <ProximaVisita
              cita={proximaCita}
              servicio={servicioDeCita(proximaCita, servicios)}
              indiceServicio={indiceServicio}
              onNavigate={onNavigate}
            />
          ) : (
            <SinCita onNavigate={onNavigate} />
          )}
          {servicios.length > 0 && <Servicios servicios={servicios} onNavigate={onNavigate} />}
          <TarjetaPuntos puntos={puntos} umbrales={umbrales} onNavigate={onNavigate} />
          <PromocionesCliente onNavigate={onNavigate} />
          {productos.length > 0 && <Productos productos={productos} onNavigate={onNavigate} />}
        </div>
      )}
    </div>
  )
}
