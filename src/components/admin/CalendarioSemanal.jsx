import { useEffect, useRef, useState } from 'react'
import { aIsoLocal, fechaLocal } from '../../lib/citas'
import { distribuirSegmentos, duracionCatalogo, horaDe, nombreDia, segmentosDelDia } from '../../lib/calendario'
import { ETIQUETA_ESTADO } from './TarjetaCita'

export function HojaCalendario({ titulo, onCerrar, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialogo = ref.current
    dialogo.showModal()
    return () => dialogo.close()
  }, [])
  return <dialog ref={ref} className="cal-hoja" aria-label={titulo} onCancel={e => { e.preventDefault(); onCerrar() }}>
    <header className="cal-hoja-cabecera"><h2>{titulo}</h2><button type="button" className="cal-boton" onClick={onCerrar} aria-label="Cerrar ventana">×</button></header>
    {children}
  </dialog>
}

export function EstadoCalendario({ estado }) {
  const conocido = ETIQUETA_ESTADO[estado]
  return <span className="cal-estado" style={conocido ? { color: `var(--adm-${estado})`, background: `var(--adm-${estado}-bg)` } : {}}>
    {conocido || 'Sin estado'}
  </span>
}

export default function CalendarioSemanal({ dias, dia, onDia, citas, profesionales, colores, filtro, onFiltro, onCita, onHorario }) {
  const [horaNueva, setHoraNueva] = useState('09:00')
  const deDia = segmentosDelDia(citas, dia)
  const grupos = dias.map(d => distribuirSegmentos(segmentosDelDia(citas, d)))
  const segmentos = grupos.flat()
  const desde = Math.min(8 * 60, ...segmentos.map(s => Math.floor(s.inicio / 60) * 60))
  const hasta = Math.min(1440, Math.max(19 * 60, ...segmentos.map(s => Math.ceil(Math.max(s.fin, s.inicio + 40) / 60) * 60)))
  const horas = Array.from({ length: (hasta - desde) / 60 }, (_, i) => desde + i * 60)
  const colorDe = c => colores[c.especialista_id || 'sin-asignar'] || colores['sin-asignar']
  const textoHora = minuto => `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`
  return <>
    <div className="cal-filtros">
      <label htmlFor="cal-profesional">Profesional</label>
      <select id="cal-profesional" value={filtro} onChange={e => onFiltro(e.target.value)}>
        <option value="todos">Todos los profesionales</option>
        {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo === false ? ' · inactivo' : ''}</option>)}
        <option value="sin-asignar">Sin asignar</option>
      </select>
    </div>
    <ul className="cal-leyenda" aria-label="Colores de profesionales">
      {profesionales.map(p => <li key={p.id}><span className="cal-punto" style={{ background: colores[p.id] }} />{p.nombre}</li>)}
      <li><span className="cal-punto" style={{ background: colores['sin-asignar'] }} />Sin asignar</li>
    </ul>
    <div className="cal-dias" aria-label="Días de la semana">
      {dias.map(d => <button key={d} type="button" aria-pressed={d === dia} onClick={() => onDia(d)} aria-label={nombreDia(d)}
        className={`cal-dia ${d === dia ? 'cal-dia-activo' : ''}`} aria-current={d === aIsoLocal(new Date()) ? 'date' : undefined}>
        <span>{fechaLocal(d).toLocaleDateString('es-HN', { weekday: 'short' }).replace('.', '')}</span>
        <strong>{fechaLocal(d).getDate()}</strong><span className="cal-conteo">{citas.filter(c => aIsoLocal(new Date(c.fecha_hora)) === d).length || '·'}</span>
      </button>)}
    </div>
    <div className="cal-dia-titulo"><h3>{nombreDia(dia)}</h3><span>{deDia.length} {deDia.length === 1 ? 'cita' : 'citas'}</span></div>
    <div className="cal-movil">
      {deDia.length === 0 && <div className="cal-vacio">Sin citas visibles para este día.</div>}
      <ol className="cal-agenda" aria-label="Agenda del día">
        {deDia.map(({ cita: c, continua }) => <li key={c.id}>
          <time dateTime={c.fecha_hora}>{continua ? 'Continúa' : horaDe(c.fecha_hora)}</time>
          <button type="button" className="cal-cita-movil" onClick={() => onCita(c)} style={{ '--profesional': colorDe(c) }}>
            <div className="cal-fila"><strong>{c.pacientes?.nombre || 'Cliente'}</strong><EstadoCalendario estado={c.estado} /></div>
            <p>{c.servicios?.nombre || c.tratamiento || 'Servicio no especificado'}</p>
            <p className="cal-profesional"><span className="cal-punto" style={{ background: colorDe(c) }} />{c.especialistas?.nombre || 'Sin asignar'}</p>
            <small>{duracionCatalogo(c) ? `${duracionCatalogo(c)} min · catálogo actual` : 'Duración no disponible'}</small>
          </button>
        </li>)}
      </ol>
      <label className="cal-horario-movil">Iniciar una cita en este día
        <input type="time" value={horaNueva} onChange={e => setHoraNueva(e.target.value)} />
      </label>
      <button type="button" className="cal-boton cal-boton-principal cal-ancho" onClick={() => onHorario(dia, horaNueva || '09:00')}>+ Crear cita en este horario</button>
    </div>
    <div className="cal-escritorio" role="region" aria-label="Cuadrícula semanal" tabIndex={0}>
      <div className="cal-grid-cabecera"><span>Hora</span>{dias.map(d => <button type="button" onClick={() => onDia(d)} key={d} aria-pressed={d === dia}>
        {fechaLocal(d).toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric' })}
      </button>)}</div>
      <div className="cal-grid-cuerpo" style={{ height: (hasta - desde) * 1.5 }}>
        <div className="cal-horas">{horas.map(h => <time key={h} style={{ top: (h - desde) * 1.5 }}>{textoHora(h)}</time>)}</div>
        {dias.map((d, i) => <div className="cal-columna" key={d} aria-label={nombreDia(d)}>
          {Array.from({ length: (hasta - desde) / 30 }, (_, j) => desde + j * 30).map(m => {
            const ocupado = grupos[i].some(s => s.cita.estado !== 'cancelada' && s.inicio < m + 30 && s.fin > m)
            return <div key={m} className="cal-celda" style={{ top: (m - desde) * 1.5 }}>{!ocupado && <button type="button" aria-label={`Crear cita el ${nombreDia(d)} a las ${textoHora(m)}`} onClick={() => onHorario(d, textoHora(m))}><span>+</span></button>}</div>
          })}
          {grupos[i].map(s => <button key={s.cita.id} type="button" className={`cal-bloque ${s.duracion ? '' : 'cal-sin-duracion'}`} title={s.duracion ? `${s.duracion} min según el catálogo actual` : 'Duración no disponible; marcador de hora de inicio'} onClick={() => onCita(s.cita)} style={{
            '--profesional': colorDe(s.cita), top: (s.inicio - desde) * 1.5,
            height: Math.max(54, (s.fin - s.inicio) * 1.5 - 3),
            left: `calc(${s.carril * 100 / s.carriles}% + 3px)`, width: `calc(${100 / s.carriles}% - 6px)`,
          }} aria-label={`${s.cita.pacientes?.nombre || 'Cliente'}, ${s.cita.especialistas?.nombre || 'Sin asignar'}, ${horaDe(s.cita.fecha_hora)}, ${ETIQUETA_ESTADO[s.cita.estado] || 'Sin estado'}`}>
            <strong>{s.cita.pacientes?.nombre || 'Cliente'}</strong><span>{s.continua ? 'Continúa' : horaDe(s.cita.fecha_hora)} · {s.cita.especialistas?.nombre || 'Sin asignar'}</span>
            <EstadoCalendario estado={s.cita.estado} />
          </button>)}
        </div>)}
      </div>
    </div>
    <p className="cal-nota">La duración mostrada procede del catálogo actual; puede diferir de la histórica. Los huecos no garantizan disponibilidad. La semana incluye citas que comienzan en ella.</p>
    <div className="cal-estados" aria-label="Estados de citas">{Object.keys(ETIQUETA_ESTADO).map(estado => <EstadoCalendario key={estado} estado={estado} />)}</div>
  </>
}
