import { useEffect, useState } from 'react'
import { ApiError } from '../context/AuthContext'
import { api } from '../services/api'

type Session = {
  id: number
  createdAt: string
  expiresAt: string
  ipAddress: string | null
  userAgent: string | null
  isCurrent: boolean
}

function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Dispositivo desconocido'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Navegador'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'SO desconocido'
  return `${browser} · ${os}`
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'hace instantes'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

export default function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | 'others' | null>(null)

  const load = () => {
    api
      .get<Session[]>('/auth/sessions')
      .then(setSessions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar las sesiones'))
  }

  useEffect(load, [])

  const handleRevoke = async (id: number) => {
    setMessage('')
    setError('')
    setBusyId(id)
    try {
      await api.post(`/auth/sessions/${id}/revoke`)
      setMessage('✅ Sesión cerrada')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cerrar la sesión')
    } finally {
      setBusyId(null)
    }
  }

  const handleRevokeOthers = async () => {
    if (!window.confirm('¿Cerrar todas las demás sesiones activas?')) return
    setMessage('')
    setError('')
    setBusyId('others')
    try {
      const result = await api.post<{ message: string }>('/auth/sessions/revoke-others')
      setMessage(`✅ ${result.message}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cerrar las sesiones')
    } finally {
      setBusyId(null)
    }
  }

  const otherSessionsCount = sessions?.filter((s) => !s.isCurrent).length ?? 0

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Sesiones activas</h2>
        {otherSessionsCount > 0 && (
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={busyId !== null}
            className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Cerrar todas las demás sesiones
          </button>
        )}
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-green-400 bg-green-100 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!sessions && !error && <p className="text-slate-500">Cargando...</p>}

      {sessions && (
        <ul className="divide-y divide-slate-100">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {describeUserAgent(s.userAgent)}
                  {s.isCurrent && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Sesión actual
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Iniciada {relativeTime(s.createdAt)}
                  {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                </p>
              </div>
              {!s.isCurrent && (
                <button
                  type="button"
                  onClick={() => handleRevoke(s.id)}
                  disabled={busyId !== null}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  {busyId === s.id ? 'Cerrando...' : 'Cerrar sesión'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
