import { useCallback, useEffect, useRef, useState } from 'react'
import { setRequestErrorHandler } from '../services/api'

/**
 * Avisos globales de fallo de infraestructura (API caída o error 5xx).
 *
 * Se monta una sola vez y escucha el punto central de `api.ts`. Sin esto, los fallos quedaban
 * invisibles: la mayoría de las pantallas descarta el error y muestra una sección vacía, así que
 * el usuario no distinguía "no hay datos" de "el servidor no responde".
 *
 * Se agrupa por mensaje (el polling en vivo puede fallar cada 10 s y no debe apilar avisos) y se
 * limita a un aviso a la vez, con cierre manual y auto-cierre a los 8 s.
 */
const AUTO_DISMISS_MS = 8000

export default function GlobalErrorToasts() {
  const [message, setMessage] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setMessage(null)
    setCount(0)
  }, [])

  useEffect(() => {
    setRequestErrorHandler((incoming) => {
      setMessage((prev) => {
        // Mismo fallo repetido (p. ej. el polling reintentando): se cuenta, no se apila.
        setCount((c) => (prev === incoming ? c + 1 : 1))
        return incoming
      })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setMessage(null), AUTO_DISMISS_MS)
    })
    return () => {
      setRequestErrorHandler(null)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!message) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[60] flex max-w-md -translate-x-1/2 items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
    >
      <span aria-hidden>⚠️</span>
      <div className="min-w-0">
        <p className="font-medium">{message}</p>
        {count > 1 && <p className="text-xs text-red-600">Ocurrió {count} veces.</p>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded px-1 text-red-500 hover:bg-red-100"
      >
        ✕
      </button>
    </div>
  )
}
