import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { VenueMatchRow } from '../../types/report'
import type { Venue } from '../../types/venue'

export default function VenueDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [venue, setVenue] = useState<Venue | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Venue>(`/venues/${id}`)
      .then(setVenue)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el estadio'))
  }, [id])

  const handleDelete = async () => {
    if (!venue) return
    if (!window.confirm(`¿Desea eliminar este estadio?\n\n${venue.name}\n\nEsta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/venues/${venue.id}`)
      navigate('/estadios')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>
  if (!venue) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const photoUrl = resolveAssetUrl(venue.photoUrl)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 overflow-hidden rounded-lg bg-white shadow">
        <div className="relative h-48 bg-gradient-to-br from-slate-700 to-slate-900 sm:h-64">
          {photoUrl ? (
            <img src={photoUrl} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl" aria-hidden>🏟️</div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{venue.name}</h1>
            <p className="text-slate-500">
              {[venue.city, venue.country].filter(Boolean).join(', ') || 'Sin ubicación registrada'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/estadios/${venue.id}/editar`)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar
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
        <h2 className="mb-4 text-lg font-bold">Características</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoField label="Capacidad" value={venue.capacity?.toLocaleString('es-PY')} />
          <InfoField label="Año de apertura" value={venue.openedYear?.toString()} />
        </dl>
      </div>

      <VenueMatchesSection venueId={venue.id} />
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

function VenueMatchesSection({ venueId }: { venueId: number }) {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<VenueMatchRow[] | null>(null)

  useEffect(() => {
    api
      .get<VenueMatchRow[]>(`/reports/venues/${venueId}/matches`)
      .then(setMatches)
      .catch(() => setMatches([]))
  }, [venueId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Partidos disputados acá</h2>
      {!matches && <p className="text-slate-500">Cargando...</p>}
      {matches?.length === 0 && <p className="text-slate-500">Todavía no hay partidos registrados en este estadio.</p>}
      <ul className="divide-y divide-slate-100">
        {matches?.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <button
              type="button"
              onClick={() => navigate(`/partidos/${m.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {m.homeTeamName} {m.homeScore != null ? `${m.homeScore} - ${m.awayScore}` : 'vs'} {m.awayTeamName}
            </button>
            <span className="text-sm text-slate-500">
              {m.competitionName} · {new Date(m.matchDate).toLocaleDateString('es-PY')} ·{' '}
              {MATCH_STATUS_LABELS[m.status as keyof typeof MATCH_STATUS_LABELS] ?? m.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
