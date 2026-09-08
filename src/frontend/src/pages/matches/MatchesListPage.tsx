import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import { MATCH_STATUSES, MATCH_STATUS_LABELS } from '../../types/match'
import type { Match, MatchListResponse, MatchStatus } from '../../types/match'
import type { Season } from '../../types/season'

const PAGE_SIZE = 25

export default function MatchesListPage() {
  const [data, setData] = useState<MatchListResponse | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [search, setSearch] = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => {})
  }, [])

  useEffect(() => {
    setSeasonId('')
    if (!competitionId) {
      setSeasons([])
      return
    }
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [competitionId])

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (competitionId) params.set('competitionId', competitionId)
    if (seasonId) params.set('seasonId', seasonId)
    if (status) params.set('status', status)
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    api
      .get<MatchListResponse>(`/matches?${params.toString()}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No fue posible cargar los partidos'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, competitionId, seasonId, status, page])

  useEffect(() => {
    setPage(1)
  }, [search, competitionId, seasonId, status])

  const items = data?.items ?? null
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleExportCsv = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (competitionId) params.set('competitionId', competitionId)
    if (seasonId) params.set('seasonId', seasonId)
    if (status) params.set('status', status)
    params.set('pageSize', String(Math.max(total, 1)))
    try {
      const full = await api.get<MatchListResponse>(`/matches?${params.toString()}`)
      exportToCsv(
        'partidos.csv',
        full.items.map((m) => ({
          ...m,
          statusLabel: MATCH_STATUS_LABELS[m.status],
          resultado: m.score ? `${m.score.homeScore}-${m.score.awayScore}` : '',
          fecha: m.matchDate.slice(0, 10),
        })),
        [
          { key: 'fecha', label: 'Fecha' },
          { key: 'competitionName', label: 'Competición' },
          { key: 'seasonLabel', label: 'Temporada' },
          { key: 'homeTeamName', label: 'Local' },
          { key: 'awayTeamName', label: 'Visitante' },
          { key: 'resultado', label: 'Resultado' },
          { key: 'statusLabel', label: 'Estado' },
        ],
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al exportar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">🎯 Partidos</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!items || items.length === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => navigate('/partidos/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo partido
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por competición o equipo..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las competiciones</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
          disabled={!competitionId}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Todas las temporadas</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          {MATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {MATCH_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-3 font-medium underline">
            Reintentar
          </button>
        </div>
      )}

      {!items && !error && <p className="p-6 text-center text-slate-500">Cargando partidos...</p>}

      {items && items.length === 0 && (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <p className="mb-4 text-slate-500">No hay partidos registrados.</p>
          <button
            type="button"
            onClick={() => navigate('/partidos/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo partido
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((m) => (
              <MatchRow key={m.id} match={m} onClick={() => navigate(`/partidos/${m.id}`)} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 py-1.5">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const STATUS_COLORS: Record<MatchStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  finished: 'bg-green-100 text-green-700',
  postponed: 'bg-amber-100 text-amber-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-slate-200 text-slate-600',
}

function MatchRow({ match: m, onClick }: { match: Match; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-lg bg-white p-4 text-left shadow transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-slate-500">
          {m.competitionName} · {m.seasonLabel}
          {m.round ? ` · ${m.round}` : ''}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <span className="flex-1 truncate text-right font-medium text-slate-900 sm:text-left">{m.homeTeamName}</span>
          <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-900">
            {m.score ? `${m.score.homeScore} - ${m.score.awayScore}` : 'vs'}
          </span>
          <span className="flex-1 truncate font-medium text-slate-900">{m.awayTeamName}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-xs text-slate-500">{m.matchDate.slice(0, 10)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[m.status]}`}>
          {MATCH_STATUS_LABELS[m.status]}
        </span>
      </div>
    </button>
  )
}
