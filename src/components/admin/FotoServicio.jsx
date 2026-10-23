import {useEffect, useRef, useState} from 'react'
import {supabase} from '../../lib/supabaseClient'
import {borrarFotoPropia, guardarFotoServicio, prepararFotoServicio, validarFotoServicio} from '../../lib/fotosServicios'
import FotoTarjeta from '../FotoTarjeta'

export function SelectorFotoServicio({archivo, onCambio, disabled=false}) {
  const [preview,setPreview]=useState(''), [error,setError]=useState('')
  useEffect(()=>{
    if (!archivo) {setPreview('');return}
    const url=URL.createObjectURL(archivo);setPreview(url)
    return ()=>URL.revokeObjectURL(url)
  },[archivo])
  return <div className="foto-servicio-selector">
    <p>Fotografía principal (opcional)</p>
    <label className="admin-upload">{archivo ? archivo.name : 'Seleccionar fotografía'}
      <input aria-label="Fotografía principal (opcional)" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={e=>{
        const file=e.target.files?.[0]; if(!file)return
        try {validarFotoServicio(file);setError('');onCambio(file)} catch(err){setError(err.message)}
        e.target.value=''
      }}/>
    </label>
    <p>JPEG, PNG o WebP · máximo 8 MB. Se optimiza a 1600 px.</p>
    {preview&&<><img src={preview} alt="Vista previa de la fotografía seleccionada"/><button type="button" disabled={disabled} onClick={()=>onCambio(null)}>Quitar selección</button></>}
    {error&&<p role="alert">{error}</p>}
  </div>
}
export default function FotoServicio({servicio, clinicaId, archivoInicial, onCambio}) {
  const [abierto,setAbierto]=useState(Boolean(archivoInicial)), [archivo,setArchivo]=useState(archivoInicial||null)
  const [ocupado,setOcupado]=useState(false),[mensaje,setMensaje]=useState(''),[pendiente,setPendiente]=useState(null)
  const lock=useRef(false)
  async function guardar(eliminar=false) {
    if(lock.current)return;lock.current=true;setOcupado(true);setMensaje('')
    try {
      const blob=eliminar?null:await prepararFotoServicio(archivo)
      const result=await guardarFotoServicio({client:supabase,baseUrl:import.meta.env.VITE_SUPABASE_URL,clinicaId,servicio,blob})
      setPendiente(result.pendiente);setArchivo(null);setAbierto(false)
      setMensaje(result.pendiente?'Foto guardada; el archivo anterior sigue pendiente de limpieza.':result.externa?'Referencia actualizada. El archivo anterior es externo o antiguo y no se borró automáticamente.':eliminar?'Fotografía eliminada.':'Fotografía guardada.')
      onCambio(result.url)
    } catch(e){setMensaje(e.message)} finally {lock.current=false;setOcupado(false)}
  }
  async function limpiar(){
    if(lock.current)return;lock.current=true;setOcupado(true)
    try {await borrarFotoPropia(supabase,pendiente,clinicaId,servicio.id);setPendiente(null);setMensaje('Archivo anterior eliminado.')}catch(e){setMensaje(e.message)}finally{lock.current=false;setOcupado(false)}
  }
  return <div className="foto-servicio">
    <FotoTarjeta src={servicio.imagen_url} nombre={servicio.nombre} alto={110} tamanoInicial={48} style={{borderRadius:12}}/>
    <button type="button" disabled={ocupado||Boolean(pendiente)} onClick={()=>setAbierto(!abierto)}>{abierto?'Cerrar fotografía':servicio.imagen_url?'Reemplazar fotografía':'Agregar fotografía'}</button>
    {abierto&&<><SelectorFotoServicio archivo={archivo} onCambio={setArchivo} disabled={ocupado}/><button type="button" className="admin-action" disabled={ocupado||!archivo} onClick={()=>guardar()}>{ocupado?'Guardando fotografía…':'Guardar fotografía'}</button></>}
    {servicio.imagen_url&&<button type="button" disabled={ocupado||Boolean(pendiente)} onClick={()=>{if(window.confirm('¿Eliminar la fotografía de este servicio? El servicio se conservará.'))guardar(true)}}>Eliminar fotografía</button>}
    {pendiente&&<button type="button" disabled={ocupado} onClick={limpiar}>Reintentar limpieza del archivo anterior</button>}
    {mensaje&&<p role="status">{mensaje}</p>}
  </div>
}
