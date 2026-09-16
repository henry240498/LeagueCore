import { useEffect, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { aiService, type AiQuery, type AskResponse } from '../../services/ai'
import { api } from '../../services/api'
import type { Team } from '../../types/team'

const EXAMPLES = [
  'Resumí el último partido',
  '¿Por qué perdimos el partido?',
  '¿Quiénes están lesionados?',
  '¿Cuándo jugamos?',
  'Goleadores del equipo',
  '¿Cómo venimos?',
  'Compará Juan Pérez vs Pedro Gómez',
  'Busco un extremo menor de 23 años',
  '¿Cómo juega cuando va perdiendo?',
  '¿Qué hay pendiente?',
]

export default function AssistantPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<(AiQuery | AskResponse & { question: string })[]>([])
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
    aiService.listQueries().then(setHistory).catch(() => {})
  }, [])

  const handleAsk = async (q?: string) => {
    const text = (q ?? question).trim()
    if (!text || asking) return
    setAsking(true)
    try {
      const res = await aiService.ask(text, teamId ? Number(teamId) : undefined)
      setHistory((h) => [{ ...res, question: text }, ...h])
      setQuestion('')
    } catch (err) {
      setHistory((h) => [
        {
          question: text,
          intent: 'error',
          answer: err instanceof ApiError ? err.message : 'Error al preguntar',
          sources: [],
        },
        ...h,
      ])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">🤖 Asistente</h1>
      <p className="mb-6 text-sm text-slate-500">
        Responde con datos reales del club (sin inventar). Elegí tu equipo para respuestas contextuales.
      </p>

      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Sin equipo (general)</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <div className="mb-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk()
          }}
          placeholder="¿Por qué perdimos el partido?"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => handleAsk()}
          disabled={asking}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {asking ? '…' : 'Preguntar'}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-1">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => handleAsk(ex)}
            className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {history.map((h, i) => (
          <div key={i} className="rounded-lg bg-white p-4 shadow">
            <p className="font-medium text-slate-900">❓ {h.question}</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-700">{h.answer ?? '…'}</pre>
          </div>
        ))}
        {history.length === 0 && <p className="text-center text-sm text-slate-500">Sin preguntas todavía.</p>}
      </div>
    </div>
  )
}
