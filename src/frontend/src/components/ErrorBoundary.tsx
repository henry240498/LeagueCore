import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Red de seguridad de la interfaz. Sin esto, cualquier error de render deja la pantalla EN BLANCO
 * y el usuario no tiene forma de saber qué pasó ni cómo salir. Acá se muestra un mensaje claro y
 * una salida (reintentar / volver al inicio), sin exponer el stack técnico.
 *
 * React exige una clase para los error boundaries: no existe equivalente con hooks.
 */
type Props = { children: ReactNode }
type State = { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Se registra en consola para diagnóstico en desarrollo; el usuario ve el mensaje amable.
    if (import.meta.env.DEV) {
      console.error('Error no controlado en la interfaz:', error, info.componentStack)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="text-xl font-bold text-slate-800">Algo salió mal en esta pantalla</h1>
        <p className="max-w-md text-sm text-slate-500">
          Ocurrió un error inesperado al mostrar esta sección. Podés reintentar o volver al inicio; el
          resto del sistema sigue funcionando.
        </p>
        {import.meta.env.DEV && this.state.message && (
          <p className="max-w-md break-words rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
            {this.state.message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/dashboard'
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }
}
