import { useEffect, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { tacticsService } from '../../services/tactics'
import type { Match } from '../../types/match'
import { METRIC_VARIABLE_LABELS, type CustomMetric, type MetricEvaluation } from '../../types/tactics'
import { api } from '../../services/api'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<CustomMetric[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [formula, setFormula] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [evalMatchId, setEvalMatchId] = useState('')
  const [results, setResults] = useState<MetricEvaluation[]>([])

  const load = () => {
    tacticsService
      .listMetrics()
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar'))
    api.get<Match[]>('/matches?pageSize=20').then((r: unknown) => {
      const list = Array.isArray(r) ? r : (r as { items?: Match[] }).items ?? []
      setMatches(list)
    }).catch(() => {})
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!name.trim() || !formula.trim()) {
      setError('Nombre y fórmula son obligatorios.')
      return
    }
    try {
      await tacticsService.createMetric({ name: name.trim(), formula: formula.trim() })
      setName('')
      setFormula('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear')
    }
  }

  const handleEvaluateAll = async () => {
    if (!evalMatchId) {
      setError('Elegí un partido para evaluar.')
      return
    }
    try {
      const out: MetricEvaluation[] = []
      for (const m of metrics) {
        out.push(await tacticsService.evaluateMetric(m.id, Number(evalMatchId)))
      }
      setResults(out)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al evaluar')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">🧮 Métricas personalizadas</h1>
      <p className="mb-6 text-sm text-slate-500">
        Variables: {Object.entries(METRIC_VARIABLE_LABELS).map(([k, v]) => `${k} (${v})`).join(' · ')}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg bg-white p-4 shadow">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (Índice ofensivo)" className={`${inputClass} min-w-[200px] flex-1`} />
        <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="Fórmula (goles*5+asistencias*4+tiros*2-faltas)" className={`${inputClass} min-w-[280px] flex-[2]`} />
        <button type="button" onClick={handleCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Crear
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-white p-4 shadow">
        <span className="text-sm font-medium text-slate-700">Evaluar en:</span>
        <select value={evalMatchId} onChange={(e) => setEvalMatchId(e.target.value)} className={`${inputClass} min-w-[240px] flex-1`}>
          <option value="">Partido…</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.homeTeamName} vs {m.awayTeamName}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleEvaluateAll} disabled={metrics.length === 0} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40">
          Evaluar todas
        </button>
      </div>

      {results.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <div key={r.id} className="rounded-lg bg-white p-4 shadow">
              <h3 className="font-bold">{r.name}</h3>
              <p className="font-mono text-xs text-slate-500">{r.formula}</p>
              <p className="mt-1 text-3xl font-bold text-blue-700">{r.value}</p>
              <details className="mt-1 text-xs text-slate-500">
                <summary className="cursor-pointer">Ver variables</summary>
                <ul className="mt-1">
                  {Object.entries(r.variables).map(([k, v]) => (
                    <li key={k}>
                      {METRIC_VARIABLE_LABELS[k] ?? k}: <strong>{v}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="font-mono text-xs text-slate-500">{m.formula}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`¿Eliminar "${m.name}"?`)) return
                await tacticsService.removeMetric(m.id)
                load()
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
        {metrics.length === 0 && <p className="text-center text-sm text-slate-500">Sin métricas. Creá tu primera fórmula.</p>}
      </div>
    </div>
  )
}
