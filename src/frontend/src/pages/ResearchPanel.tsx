import { useEffect, useState } from 'react'
import { ApiError } from '../context/AuthContext'
import { api } from '../services/api'
import { RUN_STATUS_LABELS, type SyncRun, type SyncRunDetail } from '../types/importSync'

const ENTITY_LABELS: Record<string, string> = { player: 'Jugadores', official: 'Oficiales' }

// Motor de Investigación Histórica: la corrida se crea acá con su alcance real (país/competición/
// rango de años/tipo de entidad); la ejecución del descubrimiento en fuentes públicas la hace un
// agente de forma explícita y supervisada, no un crawler desatendido -- ver changelog v49. Este
// panel es la parte real y funcionando: crea la corrida y muestra su progreso/conflictos/log real
// (mismo motor genérico de sync_runs ya usado por el resto del sistema).
export default function ResearchPanel() {
  const [runs, setRuns] = useState<SyncRun[] | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SyncRunDetail | null>(null)
  const [error, setError] = useState('')

  const loadRuns = () => {
    api
      .get<SyncRun[]>('/research/runs')
      .then((r) => {
        setRuns(r)
        if (!selectedRunId && r.length > 0) setSelectedRunId(r[0].id)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar las investigaciones'))
  }

  useEffect(loadRuns, [])

  useEffect(() => {
    if (!selectedRunId) return
    const load = () =>
      api
        .get<SyncRunDetail>(`/research/runs/${selectedRunId}`)
        .then(setDetail)
        .catch(() => {})
    load()
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [selectedRunId])

  const hasActiveRun = runs?.some((r) => r.status === 'running' || r.status === 'pending') ?? false
  useEffect(() => {
    if (!hasActiveRun) return
    const interval = setInterval(loadRuns, 4000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveRun])

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>}

      <StartRunForm
        onStarted={(run) => {
          setRuns((r) => [run, ...(r ?? [])])
          setSelectedRunId(run.id)
        }}
        onError={setError}
      />

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Investigaciones ejecutadas</h2>
        {!runs && <p className="text-slate-500">Cargando...</p>}
        {runs?.length === 0 && <p className="text-slate-500">Todavía no se ejecutó ninguna investigación.</p>}
        <ul className="divide-y divide-slate-100">
          {runs?.map((r) => {
            const scope = (r.scope as any) ?? {}
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRunId(r.id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left ${
                    selectedRunId === r.id ? 'bg-blue-50 px-2' : 'px-2 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    <span className="font-medium text-slate-900">
                      {(scope.entityTypes ?? []).map((t: string) => ENTITY_LABELS[t] ?? t).join(' + ') || 'Investigación'} — {scope.country ?? '—'}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">
                      {scope.yearFrom ?? '?'}–{scope.yearTo ?? 'actualidad'}
                    </span>
                  </span>
                  <StatusPill status={r.status} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {detail && <RunDetailView detail={detail} onFinished={loadRuns} />}
    </div>
  )
}

function StartRunForm({ onStarted, onError }: { onStarted: (run: SyncRun) => void; onError: (m: string) => void }) {
  const [entityTypes, setEntityTypes] = useState<string[]>(['player', 'official'])
  const [country, setCountry] = useState('Paraguay')
  const [competitionName, setCompetitionName] = useState('')
  const [yearFrom, setYearFrom] = useState('1906')
  const [yearTo, setYearTo] = useState(String(new Date().getFullYear()))
  const [saving, setSaving] = useState(false)

  const toggle = (t: string) => setEntityTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const handleStart = async () => {
    onError('')
    if (entityTypes.length === 0) {
      onError('Elegí al menos un tipo de entidad a investigar')
      return
    }
    setSaving(true)
    try {
      const run = await api.post<SyncRun>('/research/runs', {
        entityTypes,
        country,
        competitionName: competitionName || undefined,
        yearFrom: yearFrom ? Number(yearFrom) : undefined,
        yearTo: yearTo ? Number(yearTo) : undefined,
      })
      onStarted(run)
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al iniciar la investigación')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-1 text-lg font-bold">Nueva investigación</h2>
      <p className="mb-4 text-sm text-slate-500">
        Investiga fuentes públicas verificables (Wikipedia, Wikidata y otras) para encontrar y enriquecer jugadores/oficiales
        reales. Nunca inventa datos — lo que una fuente no confirma queda sin completar.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">País</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Competición (opcional)</label>
          <input
            value={competitionName}
            onChange={(e) => setCompetitionName(e.target.value)}
            placeholder="Todas"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Desde</label>
          <input
            type="number"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Hasta</label>
          <input
            type="number"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {Object.entries(ENTITY_LABELS).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={entityTypes.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded border-slate-300" />
            {label}
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={saving}
        className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Iniciando...' : 'Iniciar investigación'}
      </button>
    </div>
  )
}

function StatusPill({ status }: { status: SyncRun['status'] }) {
  const colors: Record<SyncRun['status'], string> = {
    pending: 'bg-slate-100 text-slate-600',
    running: 'bg-blue-100 text-blue-700',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-200 text-slate-600',
    failed: 'bg-red-100 text-red-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{RUN_STATUS_LABELS[status]}</span>
}

function RunDetailView({ detail, onFinished }: { detail: SyncRunDetail; onFinished: () => void }) {
  const [finishing, setFinishing] = useState(false)

  const handleFinish = async (status: 'completed' | 'failed' | 'cancelled') => {
    setFinishing(true)
    try {
      await api.patch(`/research/runs/${detail.id}/finish`, { status })
      onFinished()
    } finally {
      setFinishing(false)
    }
  }

  const pct = detail.currentStagePct ?? (detail.totalAnalyzed > 0 ? Math.round(((detail.totalNew + detail.totalUpdated + detail.totalUnchanged) / detail.totalAnalyzed) * 100) : 0)

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Investigación #{detail.id}</h2>
        {(detail.status === 'running' || detail.status === 'pending') && (
          <button
            type="button"
            onClick={() => handleFinish('completed')}
            disabled={finishing}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Marcar como finalizada
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{detail.currentStage ?? RUN_STATUS_LABELS[detail.status]}</p>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Analizados" value={detail.totalAnalyzed} />
        <Stat label="Nuevos" value={detail.totalNew} />
        <Stat label="Actualizados" value={detail.totalUpdated} />
        <Stat label="Sin cambios" value={detail.totalUnchanged} />
        <Stat label="Conflictos" value={detail.totalConflicts} />
        <Stat label="Errores" value={detail.totalErrors} />
      </dl>

      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Actividad reciente</h3>
      <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
        {detail.log.length === 0 && <li className="text-slate-400">Sin actividad todavía.</li>}
        {detail.log.map((l) => (
          <li key={l.id} className="flex items-start gap-2">
            <span>{l.level === 'success' ? '✓' : l.level === 'warning' ? '⚠' : l.level === 'error' ? '✗' : '·'}</span>
            <span className="text-slate-700">{l.message}</span>
          </li>
        ))}
      </ul>

      {detail.conflicts.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Conflictos ({detail.conflicts.length})</h3>
          <ul className="space-y-2 text-sm">
            {detail.conflicts.slice(0, 20).map((c) => (
              <li key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <span className="font-medium">{ENTITY_LABELS[c.entityType] ?? c.entityType}</span>
                {c.externalValue ? ` — ${c.externalValue}` : ''}
                {c.similarityPct != null && <span className="ml-2 text-xs text-amber-700">{c.similarityPct}% similar</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-xl font-bold text-slate-900">{value}</dd>
    </div>
  )
}
