import { useEffect, useState } from 'react'
import Cliente360 from './Cliente360'
import NivelBadge from '../components/NivelBadge'
import { formatearFecha } from '../lib/crm'
import {
  obtenerOportunidades, obtenerResumenReactivacion, registrarContacto, elegirPlantilla, construirMensaje,
  crearEnlaceWhatsApp, revisarMensaje, mensajeDeResultado, ETIQUETA_PRIORIDAD,
} from '../lib/reactivacion'
import { formatearPorcentaje } from '../lib/promociones'

const ESTILO_PRIORIDAD = {
  alta: { background: 'var(--gradiente-primario)', color: '#FFFFFF' },
  media: { background: '#F3E6C4', color: '#6B5320' },
  baja: { background: '#EDE7EA', color: '#5C4A53' },
}
const hora = (iso) => new Date(iso).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Prioridad({ valor }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-sm flex-shrink-0" style={{ ...ESTILO_PRIORIDAD[valor], font: '500 9px/1.3 var(--font-body)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      Prioridad {ETIQUETA_PRIORIDAD[valor]}
    </span>
  )
}

/** Clientes por reactivar: oportunidades priorizadas, con el motivo, una promoción opcional y un mensaje que el
 * administrador revisa antes de abrir WhatsApp. Melissa no envía nada y no sabe si se envió. */
export default function ClientesReactivar({ clinicaId, HistorialCliente }) {
  const [oportunidades, setOportunidades] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [verBajas, setVerBajas] = useState(false)
  const [verSinTel, setVerSinTel] = useState(false)
  const [aviso, setAviso] = useState('')
  const [preparando, setPreparando] = useState(null)
  const [texto, setTexto] = useState('')
  const [generado, setGenerado] = useState('')
  const [incluir, setIncluir] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [errorContacto, setErrorContacto] = useState('')
  const [enlaceManual, setEnlaceManual] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function cargar() {
    try {
      const [lista, res] = await Promise.all([obtenerOportunidades(), obtenerResumenReactivacion()])
      setOportunidades(lista)
      setResumen(res)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    cargar()
  }, [])

  const accionables = oportunidades.filter((o) => o.telefono_wa)
  const sinTelefono = oportunidades.filter((o) => !o.telefono_wa)
  const principales = accionables.filter((o) => o.prioridad !== 'baja')
  const bajas = accionables.filter((o) => o.prioridad === 'baja')

  function preparar(op) {
    // La promoción es opcional: viene marcada solo si fue creada para clientes inactivos o sin próxima cita.
    const conPromo = Boolean(op.promocion_id) && ['inactivos', 'sin_proxima'].includes(op.promocion_segmento)
    const nuevo = construirMensaje(op, elegirPlantilla(op, conPromo))
    setPreparando(op.paciente_id)
    setIncluir(conPromo)
    setTexto(nuevo)
    setGenerado(nuevo)
    setErrorContacto('')
    setEnlaceManual('')
    setCopiado(false)
  }

  function cambiarPromocion(op, valor) {
    const nuevo = construirMensaje(op, elegirPlantilla(op, valor))
    setIncluir(valor)
    if (texto === generado) setTexto(nuevo)   // si el administrador ya editó el texto, no se lo pisamos
    setGenerado(nuevo)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      setErrorContacto('No se pudo copiar automáticamente: selecciona el texto y cópialo.')
    }
  }

  async function abrirWhatsApp(op) {
    if (procesando || !texto.trim()) return
    setProcesando(true)
    setErrorContacto('')
    setEnlaceManual('')
    // Se abre una pestaña YA, dentro del gesto del usuario: si se esperara a la respuesta del servidor,
    // muchos navegadores (sobre todo en celular) bloquearían la ventana. Luego se le asigna el enlace.
    const ventana = window.open('', '_blank')
    if (ventana) ventana.opener = null
    let r
    try {
      r = await registrarContacto(op.paciente_id, incluir ? op.promocion_id : null, elegirPlantilla(op, incluir))
    } catch {
      r = { resultado: 'error' }
    }
    if (r.resultado === 'ok') {
      const url = crearEnlaceWhatsApp(r.telefono_wa, texto)
      if (ventana && url) ventana.location.href = url
      else if (url) setEnlaceManual(url)
      setAviso(`Contacto iniciado con ${op.nombre}. Melissa no puede saber si enviaste el mensaje: eso lo decides tú en WhatsApp. Te quedan ${r.restantes} contactos de reactivación para estas 24 horas.`)
      setPreparando(null)
      await cargar()
    } else {
      if (ventana) ventana.close()
      setErrorContacto(mensajeDeResultado(r))
      if (['en_cooldown', 'no_oportunidad', 'cliente_invalido'].includes(r.resultado)) cargar()
    }
    setProcesando(false)
  }

  if (abierto) {
    return <Cliente360 pacienteId={abierto} clinicaId={clinicaId} HistorialCliente={HistorialCliente} onVolver={() => { setAbierto(null); cargar() }} />
  }

  const tarjeta = (op) => {
    const avisos = preparando === op.paciente_id ? revisarMensaje(texto) : []
    return (
      <div key={op.paciente_id} className="rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-ink">{op.nombre}</p>
            <p className="text-[11px] text-ink/60">
              Última visita: {formatearFecha(op.ultima_visita)}{op.ultimo_servicio ? ` · ${op.ultimo_servicio}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Prioridad valor={op.prioridad} />
            <NivelBadge nivel={op.nivel} />
          </div>
        </div>
        <ul className="mt-2 text-[11px] list-disc pl-4" style={{ color: 'var(--color-texto-secundario)' }}>
          {op.motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-ink)' }}>
          Teléfono: Disponible · {op.promocion_id
            ? <>Promoción: <strong>{formatearPorcentaje(op.promocion_descuento)}</strong>{op.promocion_servicio ? ` en ${op.promocion_servicio}` : ''} («{op.promocion_titulo}»)</>
            : 'Sin promoción vigente para este cliente'}
        </p>

        {preparando !== op.paciente_id ? (
          <div className="flex items-center gap-3 mt-2.5">
            <button onClick={() => preparar(op)} className="rounded-lg px-4 py-2 text-xs font-medium text-white" style={{ background: 'var(--gradiente-primario)' }}>
              Preparar WhatsApp
            </button>
            <button onClick={() => setAbierto(op.paciente_id)} className="text-[11px]" style={{ color: 'var(--color-primary)' }}>Ver cliente</button>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-col gap-2">
            {op.promocion_id && (
              <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-ink)' }}>
                <input type="checkbox" checked={incluir} onChange={(e) => cambiarPromocion(op, e.target.checked)} className="mt-0.5" />
                <span>Incluir la promoción «{op.promocion_titulo}» (opcional: también puedes contactar sin promoción)</span>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>Mensaje para {op.nombre.split(' ')[0]}</span>
              <textarea
                className="rounded-lg px-3 py-2 text-sm bg-white"
                rows={5}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                aria-label={`Mensaje para ${op.nombre}`}
              />
            </label>
            {avisos.map((a) => <p key={a} className="text-[11px]" style={{ color: '#B08D3E' }}>⚠ {a}</p>)}
            <p className="text-[10px]" style={{ color: 'var(--color-texto-terciario)' }}>
              Melissa no envía el mensaje: se abrirá WhatsApp con este texto y tú decides si enviarlo.
            </p>
            {errorContacto && <p className="text-xs" style={{ color: '#B0524A' }}>{errorContacto}</p>}
            {enlaceManual && (
              <a href={enlaceManual} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: 'var(--color-primary)' }}>
                Tu navegador bloqueó la ventana: toca aquí para abrir WhatsApp
              </a>
            )}
            <div className="flex gap-2">
              <button onClick={copiar} className="rounded-lg px-3 py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>
                {copiado ? 'Mensaje copiado' : 'Copiar mensaje'}
              </button>
              <button
                onClick={() => abrirWhatsApp(op)}
                disabled={procesando || !texto.trim()}
                className="flex-1 rounded-lg py-2 text-xs font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--gradiente-primario)' }}
              >
                {procesando ? 'Abriendo...' : 'Abrir WhatsApp'}
              </button>
              <button onClick={() => setPreparando(null)} className="rounded-lg px-3 py-2 text-xs bg-white" style={{ color: 'var(--color-ink)' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="font-display text-lg text-ink mb-0.5">Clientes por reactivar</p>
      <p className="text-xs mb-3" style={{ color: 'var(--color-texto-secundario)' }}>
        Personas que podrían volver a reservar. Melissa las ordena para que contactes a pocas, bien elegidas.
      </p>

      <div className="rounded-xl p-3 mb-4 bg-white" style={{ border: '1px solid var(--color-dorado)' }}>
        <p className="text-sm font-medium text-ink">Protección de contacto</p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-texto-secundario)' }}>
          Melissa limita las acciones de reactivación para reducir el riesgo de contacto excesivo.
          {resumen && ` Un cliente no vuelve a aparecer hasta ${resumen.cooldown_dias} días después de un contacto, y hay un máximo de ${resumen.limite_diario} contactos de reactivación cada 24 horas por negocio.`}
          {' '}Son protecciones de Melissa, no límites oficiales de WhatsApp.
        </p>
        {resumen && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--color-ink)' }}>
            Contactos iniciados en las últimas 24 horas: <strong>{resumen.contactos_24h} de {resumen.limite_diario}</strong>
            {resumen.restantes === 0 && resumen.libre_desde ? ` · podrás preparar más desde el ${hora(resumen.libre_desde)}` : ` · te quedan ${resumen.restantes}`}
          </p>
        )}
      </div>

      {aviso && <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>{aviso}</p>}
      {cargando && <p className="text-sm text-ink/50">Buscando oportunidades...</p>}
      {error && <p className="text-sm" style={{ color: '#B0524A' }}>No se pudieron cargar las oportunidades: {error}</p>}

      {!cargando && !error && resumen && (
        <p className="text-xs mb-2" style={{ color: 'var(--color-texto-secundario)' }}>
          {resumen.oportunidades} oportunidad{resumen.oportunidades === 1 ? '' : 'es'}{resumen.alta > 0 ? ` · ${resumen.alta} de prioridad alta` : ''}
          {resumen.en_pausa > 0 ? ` · ${resumen.en_pausa} en pausa por contacto reciente` : ''}
          {resumen.no_desean > 0 ? ` · ${resumen.no_desean} no desean promociones` : ''}
        </p>
      )}

      {!cargando && !error && accionables.length === 0 && (
        <div className="rounded-xl p-3 mb-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
          <p className="text-sm font-medium text-ink">Aún no hay clientes para reactivar</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-texto-secundario)' }}>
            Melissa revisará nuevamente tus clientes a medida que pase el tiempo. Esto no es un error: un cliente aparece aquí cuando ya vino al menos una vez, no tiene próxima cita y lleva {resumen?.dias_inactividad ? `${resumen.dias_inactividad} días o más` : 'varias semanas'} sin volver. Sus visitas deben estar marcadas como completadas en Citas.
            {((resumen?.en_pausa || 0) + (resumen?.no_desean || 0) + sinTelefono.length) > 0 && ' Los clientes que quedan fuera por contacto reciente, por su preferencia o por falta de teléfono se cuentan arriba o en «Sin teléfono utilizable»: Melissa no oculta a nadie.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">{principales.map(tarjeta)}</div>

      {bajas.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setVerBajas((v) => !v)} className="text-xs" style={{ color: 'var(--color-primary)' }}>
            Ver también prioridad baja ({bajas.length}) {verBajas ? '▴' : '▾'}
          </button>
          {verBajas && <div className="flex flex-col gap-2 mt-2">{bajas.map(tarjeta)}</div>}
        </div>
      )}

      {sinTelefono.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setVerSinTel((v) => !v)} className="text-xs" style={{ color: 'var(--color-primary)' }}>
            Sin teléfono utilizable ({sinTelefono.length}) {verSinTel ? '▴' : '▾'}
          </button>
          {verSinTel && (
            <div className="flex flex-col gap-2 mt-2">
              {sinTelefono.map((op) => (
                <div key={op.paciente_id} className="rounded-xl p-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
                  <p className="text-sm text-ink">{op.nombre}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-texto-secundario)' }}>
                    {op.telefono ? 'El teléfono registrado no sirve para WhatsApp (revisa que tenga el código de país).' : 'No tiene teléfono registrado.'}
                  </p>
                  <button onClick={() => setAbierto(op.paciente_id)} className="text-[11px] mt-1" style={{ color: 'var(--color-primary)' }}>Ver cliente y corregir</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {resumen && resumen.acciones_total > 0 && (
        <div className="mt-5 rounded-xl p-3 bg-white" style={{ border: '1px solid var(--color-borde-tarjeta)' }}>
          <p className="text-sm font-medium text-ink">Seguimiento desde el {formatearFecha(resumen.medicion_desde)}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-ink)' }}>
            {resumen.acciones_total} contacto{resumen.acciones_total === 1 ? '' : 's'} iniciado{resumen.acciones_total === 1 ? '' : 's'} · {resumen.regresaron} cliente{resumen.regresaron === 1 ? '' : 's'} regresaron después del contacto (completaron una nueva cita dentro de {resumen.ventana_dias} días)
            {resumen.promos_usadas > 0 ? ` · ${resumen.promos_usadas} usaron la promoción después` : ''}
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-texto-terciario)' }}>
            Melissa no sabe qué mensajes se enviaron ni quién respondió, y no atribuye ventas ni ingresos a WhatsApp: que un cliente regrese después del contacto no demuestra que haya sido por él.
          </p>
        </div>
      )}
    </div>
  )
}
