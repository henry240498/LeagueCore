import { useEffect, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { scoutingService } from '../../services/scouting'
import { api } from '../../services/api'
import type { Team } from '../../types/team'
import type { RivalHistoryEntry, RivalProfile, RivalReport } from '../../types/scouting'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function RivalsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [profile, setProfile] = useState<RivalProfile | null>(null)
  const [history, setHistory] = useState<RivalHistoryEntry[]>([])
  const [reports, setReports] = useState<RivalReport[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reportTitle, setReportTitle] = useState('')

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
  }, [])

  useEffect(() => {
    if (!teamId) {
      setProfile(null)
      setHistory([])
      setReports([])
      return
    }
    const id = Number(teamId)
    scoutingService.getRivalProfile(id).then(setProfile).catch(() => setProfile(null))
    scoutingService.getRivalHistory(id).then(setHistory).catch(() => {})
    scoutingService.listRivalReports(id).then(setReports).catch(() => {})
  }, [teamId])

  const set = (key: keyof RivalProfile, value: string) =>
    setProfile((p) => ({ ...(p ?? ({ teamId: Number(teamId) } as RivalProfile)), [key]: value || null }))

  const handleSave = async () => {
    if (!teamId || !profile) return
    setSaving(true)
    setError('')
    try {
      const saved = await scoutingService.saveRivalProfile(Number(teamId), profile)
      setProfile(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const buildAutoReport = () => {
    if (!profile || history.length === 0) return ''
    const lines = [
      `RIVAL: ${teams.find((t) => t.id === Number(teamId))?.name ?? ''}`,
      '',
      `Formación habitual: ${profile.usualFormation ?? 'sin registrar'}`,
      '',
      'FORTALEZAS',
      ...(profile.strengths ? profile.strengths.split('\n').map((l) => `• ${l}`) : ['• sin registrar']),
      '',
      'DEBILIDADES',
      ...(profile.weaknesses ? profile.weaknesses.split('\n').map((l) => `• ${l}`) : ['• sin registrar']),
      '',
      'ÚLTIMOS PARTIDOS',
      ...history.slice(0, 5).map((h) => {
        const score = h.score
          ? `${'home_score' in h.score ? h.score.home_score : (h.score as { homeScore: number }).homeScore}-${'away_score' in h.score ? h.score.away_score : (h.score as { awayScore: number }).awayScore}`
          : 's/r'
        const shapes = h.formations.map((f) => f.shape).join('/') || 's/f'
        return `• ${h.homeName} vs ${h.awayName} (${score}) · forma ${shapes} · ${h.goals} goles · xG ${h.xg}`
      }),
    ]
    return lines.join('\n')
  }

  const handleGenerateReport = async () => {
    if (!teamId) return
    const content = buildAutoReport()
    if (!content) {
      setError('Cargá el expediente y necesitás al menos un partido en el historial.')
      return
    }
    try {
      await scoutingService.createRivalReport(Number(teamId), {
        title: reportTitle || `Informe previo ${new Date().toLocaleDateString('es-PY')}`,
        content,
      })
      setReportTitle('')
      scoutingService.listRivalReports(Number(teamId)).then(setReports).catch(() => {})
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al generar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">🔍 Scouting de rivales</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={`${inputClass} mb-6 min-w-[240px]`}>
        <option value="">Elegí un rival…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {!teamId && <p className="text-slate-500">Seleccioná un equipo para ver su expediente, historial e informes.</p>}

      {teamId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-bold">📝 Expediente del rival</h2>
            <div className="space-y-2">
              <input value={profile?.usualFormation ?? ''} onChange={(e) => set('usualFormation', e.target.value)} placeholder="Formación habitual (4-3-3)" className={`${inputClass} w-full`} />
              <textarea value={profile?.strengths ?? ''} onChange={(e) => set('strengths', e.target.value)} placeholder={'Fortalezas (una por línea)\nTransiciones rápidas\nBalón parado'} rows={3} className={`${inputClass} w-full`} />
              <textarea value={profile?.weaknesses ?? ''} onChange={(e) => set('weaknesses', e.target.value)} placeholder={'Debilidades (una por línea)\nEspalda de laterales'} rows={3} className={`${inputClass} w-full`} />
              <div className="grid grid-cols-2 gap-2">
                <input value={profile?.buildup ?? ''} onChange={(e) => set('buildup', e.target.value)} placeholder="Salida de balón" className={inputClass} />
                <input value={profile?.pressing ?? ''} onChange={(e) => set('pressing', e.target.value)} placeholder="Presión" className={inputClass} />
                <input value={profile?.transitions ?? ''} onChange={(e) => set('transitions', e.target.value)} placeholder="Transiciones" className={inputClass} />
                <input value={profile?.setPieces ?? ''} onChange={(e) => set('setPieces', e.target.value)} placeholder="Balón parado" className={inputClass} />
              </div>
              <input value={profile?.dangerousPlayers ?? ''} onChange={(e) => set('dangerousPlayers', e.target.value)} placeholder="Jugadores peligrosos" className={`${inputClass} w-full`} />
              <textarea value={profile?.offensivePatterns ?? ''} onChange={(e) => set('offensivePatterns', e.target.value)} placeholder="Patrones ofensivos" rows={2} className={`${inputClass} w-full`} />
              <textarea value={profile?.defensivePatterns ?? ''} onChange={(e) => set('defensivePatterns', e.target.value)} placeholder="Patrones defensivos" rows={2} className={`${inputClass} w-full`} />
              <button type="button" onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar expediente'}
              </button>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-3 text-lg font-bold">📊 Historial automático ({history.length})</h2>
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">Sin partidos registrados contra este rival.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {history.map((h) => (
                    <li key={h.matchId} className="py-2">
                      <span className="font-medium">
                        {h.homeName} vs {h.awayName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {h.formations.map((f) => f.shape).join('/') || 'sin forma'} · {h.goals} goles · xG {h.xg}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-3 text-lg font-bold">📄 Informes previos ({reports.length})</h2>
              <div className="mb-3 flex gap-2">
                <input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="Título del informe" className={`${inputClass} flex-1`} />
                <button type="button" onClick={handleGenerateReport} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">
                  Generar
                </button>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {reports.map((r) => (
                  <li key={r.id} className="py-2">
                    <p className="font-medium">{r.title}</p>
                    {r.content && <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600">{r.content}</pre>}
                    <button
                      type="button"
                      onClick={async () => {
                        await scoutingService.removeRivalReport(Number(teamId), r.id)
                        setReports((rs) => rs.filter((x) => x.id !== r.id))
                      }}
                      className="mt-1 text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
