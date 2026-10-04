import { useEffect, useRef, useState } from 'react'

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']

/** Lee códigos de barras con la cámara usando el BarcodeDetector nativo del
 * navegador (Chrome en Android). Donde no existe, queda la entrada manual,
 * que también sirve para lectores USB/Bluetooth que "teclean" el código. */
export default function EscanerBarras({ onDetectado }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const soportado = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!soportado) return
    let stream
    let temporizador
    let activo = true

    async function iniciar() {
      try {
        const disponibles = await window.BarcodeDetector.getSupportedFormats()
        const detector = new window.BarcodeDetector({ formats: FORMATOS.filter((f) => disponibles.includes(f)) })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!activo || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        const revisar = async () => {
          if (!activo) return
          try {
            const codigos = await detector.detect(videoRef.current)
            if (codigos.length > 0) {
              activo = false
              onDetectado(codigos[0].rawValue)
              return
            }
          } catch {
            // frame no listo todavía, se reintenta
          }
          temporizador = setTimeout(revisar, 250)
        }
        revisar()
      } catch {
        setError('No se pudo acceder a la cámara. Verifica los permisos.')
      }
    }

    iniciar()

    return () => {
      activo = false
      clearTimeout(temporizador)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function enviarManual(e) {
    e.preventDefault()
    if (manual.trim()) onDetectado(manual.trim())
  }

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--color-accent)' }}>
      {soportado ? (
        <div className="rounded-lg overflow-hidden" style={{ aspectRatio: '4/3', background: '#000' }}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        </div>
      ) : (
        <p className="text-xs mb-2" style={{ color: 'var(--color-texto-secundario)' }}>
          Este navegador no puede leer códigos con la cámara (funciona en Chrome para Android).
          Escribe el código o usa un lector externo.
        </p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: '#B0524A' }}>{error}</p>}

      <form onSubmit={enviarManual} className="flex gap-2 mt-2">
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm bg-white"
          placeholder="Escribir código manualmente"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
        />
        <button type="submit" className="rounded-lg px-4 text-sm text-white" style={{ background: 'var(--gradiente-primario)' }}>
          OK
        </button>
      </form>
    </div>
  )
}
