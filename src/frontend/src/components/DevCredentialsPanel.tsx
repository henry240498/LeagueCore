// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
//
// Panel OCULTO de la pantalla de login que lista credenciales de prueba.
// Está pensado para desarrollo únicamente:
//  - Este archivo sólo se renderiza cuando `import.meta.env.DEV` es true. En un build
//    de producción (`vite build`), la rama queda eliminada por tree-shaking y este
//    componente NO se incluye en el bundle.
//  - Los datos vienen del backend en /dev/test-credentials, que responde 404 en prod.
//
// Cómo mostrar/ocultar el panel (atajos ocultos, ninguno visible a simple vista):
//  1) Teclado: Ctrl + L + 9  (alterna: la 1ª vez lo muestra, la 2ª lo oculta)
//  2) Teclado: Ctrl + Alt + K
//  3) Toque/clic: 3 clics rápidos en la esquina inferior derecha de la pantalla.
// Escape también lo cierra.
//
// Por seguridad, el backend sólo entrega la lista a accesos LOCALES (no por el túnel de
// Cloudflare). Ver src/backend/src/dev/dev.controller.ts.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

/** Ventana (ms) en la que un 9 todavía cuenta como parte del atajo tras soltar la L. */
const CHORD_WINDOW_MS = 1500

/**
 * Detecta Ctrl + L + 9 con Ctrl mantenido, en cualquier orden entre L y 9 (mantenidas a la
 * vez, o L y luego 9 dentro de una ventana corta). Usa `code` (posición física de la tecla)
 * para que no dependa de la distribución del teclado.
 *
 * Ctrl+L en el navegador enfoca la barra de direcciones y Ctrl+9 salta a la última pestaña;
 * se cancela su acción por defecto para que el 9 llegue a la página.
 */
function useCtrlL9(onChord: () => void) {
  useEffect(() => {
    const held = new Set<string>()
    let lastL = 0

    const onDown = (e: KeyboardEvent) => {
      held.add(e.code)
      if (e.ctrlKey && e.code === 'KeyL') {
        e.preventDefault()
        lastL = Date.now()
        return
      }
      const isNine = e.code === 'Digit9' || e.code === 'Numpad9'
      if (isNine && e.ctrlKey && !e.repeat && (held.has('KeyL') || Date.now() - lastL < CHORD_WINDOW_MS)) {
        e.preventDefault()
        lastL = 0
        onChord()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      held.delete(e.code)
    }
    const onBlur = () => held.clear()

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [onChord])
}

type TestCredential = {
  label: string
  username: string
  password: string
  role?: string
  note?: string
}

type Props = {
  /** Autocompleta el formulario de login con la credencial elegida. */
  onPick?: (username: string, password: string) => void
}

export default function DevCredentialsPanel({ onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<TestCredential[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState<string>('')
  const cornerClicks = useRef<number[]>([])

  const load = useCallback(async () => {
    if (loaded) return
    try {
      const data = await api.get<TestCredential[]>('/dev/test-credentials')
      setItems(data)
    } catch {
      setError(
        'No disponible. Las credenciales de prueba solo se muestran al usar el sistema desde este equipo ' +
          '(no por el acceso remoto) y con el backend en modo desarrollo.',
      )
    } finally {
      setLoaded(true)
    }
  }, [loaded])

  // Único punto por el que se muestra/oculta el panel. Al mostrarlo por primera vez carga la
  // lista. `openRef` refleja `open` para que los atajos de teclado (listeners fuera de React)
  // alternen sobre el valor actual.
  const openRef = useRef(false)
  const setPanel = useCallback(
    (next: boolean) => {
      openRef.current = next
      setOpen(next)
      if (next) void load()
    },
    [load],
  )
  const toggle = useCallback(() => setPanel(!openRef.current), [setPanel])

  // Atajo principal: Ctrl + L + 9 (alterna mostrar/ocultar)
  useCtrlL9(toggle)

  // Atajos secundarios: Ctrl + Alt + K (alterna) y Escape (cierra)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape') setPanel(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, setPanel])

  // Atajo táctil/clic: 3 clics rápidos (<600ms entre sí) en la esquina inferior derecha.
  const handleCornerClick = () => {
    const now = Date.now()
    cornerClicks.current = [...cornerClicks.current, now].filter((t) => now - t < 1200)
    if (cornerClicks.current.length >= 3) {
      cornerClicks.current = []
      setPanel(true)
    }
  }

  const pick = (c: TestCredential) => {
    onPick?.(c.username, c.password)
    setPanel(false)
  }

  const copy = async (c: TestCredential) => {
    try {
      await navigator.clipboard.writeText(`${c.username} / ${c.password}`)
      setCopied(c.username)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      // clipboard no disponible; ignorar
    }
  }

  return (
    <>
      {/* Hotspot invisible en la esquina inferior derecha */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={handleCornerClick}
        className="fixed bottom-0 right-0 z-40 h-10 w-10 cursor-default opacity-0"
        title=""
      />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPanel(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 text-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">🔑 Credenciales de prueba</h2>
              <button
                type="button"
                onClick={() => setPanel(false)}
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-amber-700">
              Solo desarrollo — este panel se elimina antes de publicar el sistema.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {!error && items.length === 0 && (
              <p className="text-sm text-slate-500">No hay credenciales cargadas.</p>
            )}

            <ul className="space-y-2">
              {items.map((c) => (
                <li
                  key={`${c.username}-${c.label}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.label}
                        {c.role && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                            {c.role}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-sm text-slate-700">
                        {c.username} / {c.password}
                      </p>
                      {c.note && <p className="mt-1 text-xs text-slate-500">{c.note}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {onPick && (
                        <button
                          type="button"
                          onClick={() => pick(c)}
                          className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                        >
                          Usar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void copy(c)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                      >
                        {copied === c.username ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[11px] text-slate-400">
              Atajos: Ctrl+L+9 (mostrar/ocultar) · Ctrl+Alt+K · 3 clics en la esquina inferior derecha.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
