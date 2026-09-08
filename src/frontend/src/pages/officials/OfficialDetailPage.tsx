import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import StatusBadge from '../../components/StatusBadge'
import { ApiError } from '../../context/AuthContext'
import { calculateAge } from '../../lib/age'
import { api } from '../../services/api'
import type { Official } from '../../types/official'

const DATA_ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manual',
  imported: 'Importado',
}

export default function OfficialDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [official, setOfficial] = useState<Official | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    api
      .get<Official>(`/officials/${id}`)
      .then(setOfficial)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el oficial'))
  }

  useEffect(load, [id])

  const handleToggleStatus = async () => {
    if (!official) return
    const next = official.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/officials/${official.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async () => {
    if (!official) return
    if (
      !window.confirm(
        `¿Desea eliminar este oficial?\n\n${official.fullName}\n\nEsta acción puede afectar información relacionada.`,
      )
    ) {
      return
    }
    try {
      await api.delete(`/officials/${official.id}`)
      navigate('/oficiales')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>
  if (!official) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const age = calculateAge(official.dateOfBirth)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar photoUrl={official.photoUrl} alt={official.fullName} size={96} />
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{official.fullName}</h1>
              <p className="text-slate-500">{official.officialTypeName ?? 'Sin tipo asignado'}</p>
              <p className="text-sm text-slate-400">{official.nationality ?? 'Sin nacionalidad registrada'}</p>
              <div className="mt-1">
                <StatusBadge status={official.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/oficiales/${official.id}/editar`)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {official.status === 'active' ? 'Desactivar' : 'Activar'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Información personal</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoField
            label="Fecha de nacimiento"
            value={
              official.dateOfBirth
                ? `${official.dateOfBirth.slice(0, 10)}${age !== null ? ` (${age} años)` : ''}`
                : undefined
            }
          />
          <InfoField label="Nacionalidad" value={official.nationality} />
          <InfoField label="Ciudad" value={official.city} />
          <InfoField label="Origen" value={DATA_ORIGIN_LABELS[official.dataOrigin] ?? official.dataOrigin} />
        </dl>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Información como oficial</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoField label="Tipo" value={official.officialTypeName} />
          <InfoField label="Estado" value={official.status === 'active' ? 'Activo' : 'Inactivo'} />
        </dl>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-1 text-lg font-bold">Historial</h2>
        <p className="mb-4 text-sm text-slate-400">Disponible cuando se implemente el módulo de Partidos.</p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatPlaceholder label="Partidos dirigidos" />
          <StatPlaceholder label="Competiciones" />
          <StatPlaceholder label="Temporadas" />
        </dl>
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || '—'}</dd>
    </div>
  )
}

function StatPlaceholder({ label }: { label: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-xl font-bold text-slate-300">--</dd>
    </div>
  )
}
