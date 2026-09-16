import { useEffect, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Match } from '../../types/match'
import type { Player } from '../../types/player'
import type { Team } from '../../types/team'

type Template = {
  id: number
  name: string
  entity: 'MATCH' | 'PLAYER' | 'TEAM'
  sections: string[]
}

const SECTIONS: Record<string, string[]> = {
  MATCH: ['RESULTADO', 'GOLES', 'TIROS_XG', 'MAPA_TIROS', 'POSESIONES', 'BALON_PARADO', 'CAMBIOS', 'RESUMEN_IA'],
  PLAYER: ['FICHA', 'TECNICA', 'FISICO', 'LESIONES', 'GOLES', 'OBJETIVOS'],
  TEAM: ['CONTEXTO', 'DISCIPLINA', 'OBJETIVOS', 'RACHA', 'GOLEADORES'],
}

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function ReportBuilderPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [entity, setEntity] = useState<'MATCH' | 'PLAYER' | 'TEAM'>('MATCH')
  const [checked, setChecked] = useState<string[]>(SECTIONS.MATCH)

  const [genTemplateId, setGenTemplateId] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [genMatchId, setGenMatchId] = useState('')
  const [genTeamId, setGenTeamId] = useState('')
  const [genPlayerId, setGenPlayerId] = useState('')
  const [output, setOutput] = useState<{ title: string; markdown: string } | null>(null)

  const load = () => {
    api.get<Template[]>('/insights/report-templates').then(setTemplates).catch(() => {})
    api.get<Match[]>('/matches?pageSize=50').then((r: unknown) => {
      const list = Array.isArray(r) ? r : (r as { items?: Match[] }).items ?? []
      setMatches(list)
    }).catch(() => {})
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
    api.get<{ items: Player[] }>('/players?pageSize=100').then((r: unknown) => {
      const list = Array.isArray(r) ? r : (r as { items?: Player[] }).items ?? []
      setPlayers(list)
    }).catch(() => {})
  }

  useEffect(load, [])

  const toggleSection = (s: string) => {
    setChecked((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]))
  }

  const handleCreate = async () => {
    if (!name.trim() || checked.length === 0) {
      setError('Nombre y al menos una sección.')
      return
    }
    try {
      await api.post('/insights/report-templates', { name: name.trim(), entity, sectionsJson: JSON.stringify(checked) })
      setName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear')
    }
  }

  const handleGenerate = async () => {
    if (!genTemplateId) return
    try {
      const res = await api.post<{ title: string; markdown: string }>(
        `/insights/report-templates/${genTemplateId}/generate`,
        {
          matchId: genMatchId ? Number(genMatchId) : undefined,
          teamId: genTeamId ? Number(genTeamId) : undefined,
          playerId: genPlayerId ? Number(genPlayerId) : undefined,
        },
      )
      setOutput(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al generar')
    }
  }

  const download = () => {
    if (!output) return
    const blob = new Blob([output.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${output.title.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">📄 Motor de informes</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">Plantillas ({templates.length})</h2>
          <div className="mb-3 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (Informe de partido)" className={`${inputClass} flex-1`} />
            <select value={entity} onChange={(e) => { setEntity(e.target.value as never); setChecked(SECTIONS[e.target.value]) }} className={inputClass}>
              <option value="MATCH">Partido</option>
              <option value="PLAYER">Jugador</option>
              <option value="TEAM">Equipo</option>
            </select>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {SECTIONS[entity].map((s) => (
              <label key={s} className={`cursor-pointer rounded-full px-2 py-1 text-xs ${checked.includes(s) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <input type="checkbox" checked={checked.includes(s)} onChange={() => toggleSection(s)} className="mr-1" />
                {s.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
          <button type="button" onClick={handleCreate} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Crear plantilla
          </button>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  <strong>{t.name}</strong> <span className="text-xs text-slate-500">({t.entity} · {t.sections.length} secciones)</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar "${t.name}"?`)) return
                    await api.delete(`/insights/report-templates/${t.id}`)
                    load()
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">Generar informe</h2>
          <select value={genTemplateId} onChange={(e) => setGenTemplateId(e.target.value)} className={`${inputClass} mb-2 w-full`}>
            <option value="">Plantilla…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.entity})</option>
            ))}
          </select>
          <div className="mb-2 grid gap-2">
            <select value={genMatchId} onChange={(e) => setGenMatchId(e.target.value)} className={inputClass}>
              <option value="">Partido…</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>{m.homeTeamName} vs {m.awayTeamName}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={genTeamId} onChange={(e) => setGenTeamId(e.target.value)} className={inputClass}>
                <option value="">Equipo…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select value={genPlayerId} onChange={(e) => setGenPlayerId(e.target.value)} className={inputClass}>
                <option value="">Jugador…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="button" onClick={handleGenerate} disabled={!genTemplateId} className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40">
            Generar
          </button>
          {output && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-bold">{output.title}</h3>
                <button type="button" onClick={download} className="text-xs text-blue-600 hover:underline">
                  ⬇ Descargar .md
                </button>
              </div>
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 font-sans text-xs text-slate-700">
                {output.markdown}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
