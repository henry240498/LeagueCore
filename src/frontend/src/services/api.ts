export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4001/api/v1'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Manejo global de sesión vencida. Sin esto, cuando el token expira a mitad de sesión el usuario
 * sigue "logueado" en el estado de React y cada pantalla muestra su propio error suelto. El
 * AuthProvider registra acá un handler que limpia la sesión, y ProtectedRoute redirige al login.
 */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/**
 * Aviso global de fallos de infraestructura.
 *
 * Gran parte de la app hace `.catch(() => {})` o cae a un estado vacío, así que cuando la API está
 * caída o rompe, el usuario sólo ve secciones vacías y no distingue "no hay datos" de "falló".
 * Al notificar desde acá —el único punto por el que pasan todas las peticiones— esos fallos se
 * vuelven visibles sin tener que tocar cada llamada.
 *
 * Sólo se avisan fallos de RED y errores 5xx: los 4xx son respuestas esperadas del negocio
 * (validaciones, no encontrado, sin permiso) que cada pantalla ya muestra donde corresponde.
 */
let onRequestError: ((message: string) => void) | null = null

export function setRequestErrorHandler(handler: ((message: string) => void) | null) {
  onRequestError = handler
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : undefined

  if (res.status === 401) onUnauthorized?.()

  if (!res.ok) {
    const message = body?.message ?? `Error ${res.status}`
    const text = Array.isArray(message) ? message.join(', ') : message
    if (res.status >= 500) onRequestError?.(`El servidor respondió con un error (${res.status}).`)
    throw new ApiError(text, res.status)
  }

  return body as T
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
  } catch {
    // fetch sólo rechaza por fallo de red (API caída, sin conexión, CORS): no es un error de negocio.
    onRequestError?.('No se pudo conectar con el servidor. Verificá que la API esté corriendo.')
    throw new ApiError('No se pudo conectar con el servidor', 0)
  }
  return handleResponse<T>(res)
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: async <T>(path: string, file: File, extraFields?: Record<string, string>) => {
    const formData = new FormData()
    formData.append('file', file)
    for (const [key, value] of Object.entries(extraFields ?? {})) {
      formData.append(key, value)
    }
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    return handleResponse<T>(res)
  },
}
