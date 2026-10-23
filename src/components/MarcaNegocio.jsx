import {useState} from 'react'
/** Identidad del tenant. Sin logo, usa iniciales; no sustituye su marca por Melissa. */
export default function MarcaNegocio({clinica, grande=false}) {
  const [fallo,setFallo]=useState(null)
  const nombre=clinica?.nombre || 'Tu negocio'
  return <span className={`marca-negocio ${grande?'marca-negocio-grande':''}`}>
    {clinica?.logo_url && fallo!==clinica.logo_url
      ? <img src={clinica.logo_url} alt={nombre} onError={()=>setFallo(clinica.logo_url)}/>
      : <span aria-hidden="true">{nombre.split(/\s+/).slice(0,2).map(p=>p[0]).join('')}</span>}
  </span>
}
