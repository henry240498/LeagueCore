const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4001/api/v1'
const BACKEND_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '')

/** Los uploads (logos/fondos) los sirve el backend en /uploads, no el dev server del frontend. */
export function resolveAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http')) return path
  return `${BACKEND_ORIGIN}${path}`
}
