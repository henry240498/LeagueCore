import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatRadar from '../../components/stats/StatRadar'
import { ApiError } from '../../context/AuthContext'
import { scoutingService } from '../../services/scouting'
import { TECHNICAL_ATTRIBUTE_LABELS } from '../../types/player'
import {
  RECOMMENDATION_LABELS,
  type ComparedPlayer,
  type ScoutedPlayer,
  type ScoutingReport,
} from '../../types/scouting'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PlayersScoutingPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ search: '', position: '', nationality: '', foot: '', minAge: '', maxAge: '', minHeight: '', minGoals: '', minTechAvg: '' })
  const [results, setResults] = useState<ScoutedPlayer[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [compared, setCompared] = useState<ComparedPlayer[]>([])
  const [reports, setReports] = useState<ScoutingReport[]>([])

  const [repPlayerId, setRepPlayerId] = useState('')
  const [repStrengths, setRepStrengths] = useState('')
  const [repWeaknesses, setRepWeaknesses] = useState('')
  const [repReco, setRepReco] = useState('SEGUIR')
  const [repRating, setRepRating] = useState('')

  const handleSearch = async () => {
    try {
      const out = await scoutingService.searchPlayers({
        search: filters.search || undefined,
        position: filters.position || undefined,
        nationality: filters.nationality || undefined,
        foot: filters.foot || undefined,
        minAge: filters.minAge ? Number(filters.minAge) : undefined,
        maxAge: filters.maxAge ? Number(filters.maxAge) : undefined,
        minHeight: filters.minHeight ? Number(filters.minHeight) : undefined,
        minGoals: filters.minGoals ? Number(filters.minGoals) : undefined,
        minTechAvg: filters.minTechAvg ? Number(filters.minTechAvg) : undefined,
      })
      setResults(out)
      setSelected([])
      setCompared([])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al buscar')
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id)
      if (s.length >= 2) return [s[1], id]
      return [...s, id]
    })
  }

  const handleCompare = async () => {
    if (selected.length !== 2) {
      setError('Elegí 2 jugadores para comparar.')
      return
    }
    try {
      const out = await scoutingService.comparePlayers(selected)
      setCompared(out)
      const [a] = out
      if (a) scoutingService.listScoutingReports(a.id).then(setReports).catch(() => {})
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al comparar')
    }
  }

  const handleAddWatch = async (p: ScoutedPlayer) => {
    try {
      await scoutingService.addWatchItem({ playerId: p.id, priority: 'MEDIA' })
      navigate('/scouting/seguimiento')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al agregar')
    }
  }

  const handleSaveReport = async () => {
    if (!repPlayerId) {
      setError('Elegí un jugador comparado para el informe.')
      return
    }
    try {
      await scoutingService.createScoutingReport({
        playerId: Number(repPlayerId),
        strengths: repStrengths || undefined,
        weaknesses: repWeaknesses || undefined,
        recommendation: repReco,
        rating: repRating ? Number(repRating) : undefined,
      })
      setRepStrengths('')
      setRepWeaknesses('')
      scoutingService.listScoutingReports(Number(repPlayerId)).then(setReports).catch(() => {})
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    }
  }

  const radarData = (() => {
    const attrs = new Map<string, { a: number | null; b: number | null }>()
    for (const t of compared[0]?.technical ?? []) attrs.set(t.attribute, { a: t.value, b: null })
    for (const t of compared[1]?.technical ?? []) {
      const cur = attrs.get(t.attribute) ?? { a: null, b: null }
      attrs.set(t.attribute, { ...cur, b: t.value })
    }
    return [...attrs.entries()].map(([attribute, v]) => ({
      attribute: TECHNICAL_ATTRIBUTE_LABELS[attribute] ?? attribute,
      a: v.a,
      b: v.b,
    }))
  })()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">🎯 Scouting de jugadores</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-white p-4 shadow sm:grid-cols-4">
        <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Nombre…" className={inputClass} />
        <select value={filters.position} onChange={(e) => setFilters({ ...filters, position: e.target.value })} className={inputClass}>
          <option value="">Posición…</option>
          {['Portero', 'Defensor', 'Mediocampista', 'Delantero'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input value={filters.nationality} onChange={(e) => setFilters({ ...filters, nationality: e.target.value })} placeholder="Nacionalidad" className={inputClass} />
        <select value={filters.foot} onChange={(e) => setFilters({ ...filters, foot: e.target.value })} className={inputClass}>
          <option value="">Pie…</option>
          <option value="izquierdo">Izquierdo</option>
          <option value="derecho">Derecho</option>
          <option value="ambidiestro">Ambidiestro</option>
        </select>
        <input value={filters.minAge} onChange={(e) => setFilters({ ...filters, minAge: e.target.value })} placeholder="Edad mín" type="number" className={inputClass} />
        <input value={filters.maxAge} onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })} placeholder="Edad máx" type="number" className={inputClass} />
        <input value={filters.minHeight} onChange={(e) => setFilters({ ...filters, minHeight: e.target.value })} placeholder="Altura mín (cm)" type="number" className={inputClass} />
        <input value={filters.minGoals} onChange={(e) => setFilters({ ...filters, minGoals: e.target.value })} placeholder="Goles mín" type="number" className={inputClass} />
        <button type="button" onClick={handleSearch} className="col-span-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:col-span-4">
          Buscar
        </button>
      </div>

      {results && (
        <div className="mb-6 overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-2">☐</th>
                <th className="px-3 py-2">Jugador</th>
                <th className="px-3 py-2">Edad</th>
                <th className="px-3 py-2">Goles</th>
                <th className="px-3 py-2">Asist.</th>
                <th className="px-3 py-2">Téc.</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((p) => (
                <tr key={p.id} className={selected.includes(p.id) ? 'bg-blue-50' : undefined}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Comparar ${p.fullName}`} />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => navigate(`/jugadores/${p.id}`)} className="font-medium text-blue-600 hover:underline">
                      {p.fullName}
                    </button>
                    <span className="block text-xs text-slate-500">{p.position} · {p.teamName ?? 'libre'}</span>
                  </td>
                  <td className="px-3 py-2">{p.age ?? '—'}</td>
                  <td className="px-3 py-2">{p.goals}</td>
                  <td className="px-3 py-2">{p.assists}</td>
                  <td className="px-3 py-2">{p.techAvg ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => handleAddWatch(p)} className="text-sm text-slate-600 hover:underline">
                      + Seguimiento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && <p className="p-6 text-center text-slate-500">Sin resultados con esos filtros.</p>}
        </div>
      )}

      {results && results.length > 0 && (
        <button type="button" onClick={handleCompare} disabled={selected.length !== 2} className="mb-6 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40">
          Comparar seleccionados ({selected.length}/2)
        </button>
      )}

      {compared.length === 2 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-bold">⚖️ {compared[0].fullName} vs {compared[1].fullName}</h2>
            <StatRadar data={radarData} labelA={compared[0].fullName} labelB={compared[1].fullName} />
            <table className="mt-3 w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">Dato</th>
                  <th className="text-right">{compared[0].fullName.split(' ').slice(-1)}</th>
                  <th className="text-right">{compared[1].fullName.split(' ').slice(-1)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(
                  [
                    ['Partidos', compared[0].matches, compared[1].matches],
                    ['Goles', compared[0].goals, compared[1].goals],
                    ['Asistencias', compared[0].assists, compared[1].assists],
                    ['Vel. máx', compared[0].physicalLatest?.maxSpeedKmh ?? '—', compared[1].physicalLatest?.maxSpeedKmh ?? '—'],
                    ['Distancia', compared[0].physicalLatest?.distanceM ?? '—', compared[1].physicalLatest?.distanceM ?? '—'],
                  ] as [string, unknown, unknown][]
                ).map(([label, a, b]) => (
                  <tr key={label}>
                    <td className="py-1 text-slate-600">{label}</td>
                    <td className="py-1 text-right font-medium">{String(a)}</td>
                    <td className="py-1 text-right font-medium">{String(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-bold">📝 Informe de scouting</h2>
            <select value={repPlayerId} onChange={(e) => setRepPlayerId(e.target.value)} className={`${inputClass} mb-2 w-full`}>
              <option value="">Jugador…</option>
              {compared.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </select>
            <textarea value={repStrengths} onChange={(e) => setRepStrengths(e.target.value)} placeholder="Fortalezas" rows={2} className={`${inputClass} mb-2 w-full`} />
            <textarea value={repWeaknesses} onChange={(e) => setRepWeaknesses(e.target.value)} placeholder="Debilidades" rows={2} className={`${inputClass} mb-2 w-full`} />
            <div className="mb-2 flex gap-2">
              <select value={repReco} onChange={(e) => setRepReco(e.target.value)} className={`${inputClass} flex-1`}>
                <option value="FICHAR">✅ Fichar</option>
                <option value="SEGUIR">👀 Seguir</option>
                <option value="DESCARTAR">❌ Descartar</option>
              </select>
              <input value={repRating} onChange={(e) => setRepRating(e.target.value)} placeholder="Rating 1-10" type="number" min={1} max={10} className={`${inputClass} w-28`} />
            </div>
            <button type="button" onClick={handleSaveReport} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Guardar informe
            </button>
            <ul className="mt-3 space-y-2 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="rounded bg-slate-50 p-2">
                  <p className="font-medium">{r.playerName ?? r.externalName} · {r.recommendation ? RECOMMENDATION_LABELS[r.recommendation] : ''} {r.rating ? `(${r.rating}/10)` : ''}</p>
                  {r.strengths && <p className="text-xs text-slate-600">+ {r.strengths}</p>}
                  {r.weaknesses && <p className="text-xs text-slate-600">− {r.weaknesses}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
