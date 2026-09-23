import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import {
  PLAYER_STAT_FIELDS,
  type Match,
  type MatchLineupEntry,
  type MatchPlayerStats,
} from '../../types/match'

/**
 * Carga de estadísticas individuales por partido (dbo.match_player_stats).
 *
 * Esta tabla existía en el esquema pero no tenía forma de escribirse, así que las métricas
 * individuales (remates, pases, duelos, recuperaciones…) nunca podían cargarse y todo lo que las
 * consume quedaba vacío para siempre: la planilla del jugador y la comparación del Match Center.
 *
 * Se carga de a un jugador por vez: una grilla de 22 jugadores x 16 métricas sería ilegible.
 * Mismo criterio que las estadísticas de equipo: **un campo vacío significa "sin datos", no cero**.
 */
export default function MatchPlayerStatsEditor({
  match,
  onError,
}: {
  match: Match
  onError: (msg: string) => void
}) {
  const [lineups, setLineups] = useState<MatchLineupEntry[] | null>(null)
  const [stats, setStats] = useState<MatchPlayerStats[]>([])
  const [playerId, setPlayerId] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const load = () => {
    api
      .get<MatchLineupEntry[]>(`/matches/${match.id}/lineups`)
      .then(setLineups)
      .catch(() => setLineups([]))
    api
      .get<MatchPlayerStats[]>(`/matches/${match.id}/player-stats`)
      .then(setStats)
      .catch(() => setStats([]))
  }
  useEffect(load, [match.id])

  // Al elegir un jugador se precargan sus valores ya guardados (si los hay).
  useEffect(() => {
    if (!playerId) {
      setForm({})
      return
    }
    const existing = stats.find((s) => String(s.playerId) === playerId)
    setForm(
      Object.fromEntries(
        PLAYER_STAT_FIELDS.map((f) => [f.key, (existing?.[f.key] as number | null | undefined)?.toString() ?? '']),
      ),
    )
  }, [playerId, stats])

  const loadedIds = useMemo(() => new Set(stats.map((s) => s.playerId)), [stats])

  const save = async () => {
    if (!playerId) return
    setSaving(true)
    try {
      // null (no undefined) para un campo vacío: así se puede BORRAR un valor cargado antes, no
      // sólo agregarlo. El backend ignora undefined y no tocaría esa columna.
      const payload: Record<string, number | null> = {}
      for (const f of PLAYER_STAT_FIELDS) {
        const raw = form[f.key]
        payload[f.key as string] = raw === '' || raw == null ? null : Number(raw)
      }
      await api.put(`/matches/${match.id}/player-stats/${playerId}`, payload)
      setSavedAt(new Date().toLocaleTimeString())
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar las estadísticas del jugador')
    } finally {
      setSaving(false)
    }
  }

  if (!lineups) return <p className="text-slate-500">Cargando...</p>

  if (lineups.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        Primero cargá la alineación en la pestaña "Jugadores (alineación)": las estadísticas se
        registran sobre los jugadores que realmente participaron.
      </p>
    )
  }

  const sorted = [...lineups].sort(
    (a, b) => a.teamId - b.teamId || (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99),
  )

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">
        Un campo vacío significa "sin datos", no cero. Ya cargados: {loadedIds.size} de {lineups.length}{' '}
        jugador(es).
      </p>

      <select
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        aria-label="Jugador"
      >
        <option value="">Elegí un jugador…</option>
        {sorted.map((l) => {
          const team = l.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName
          return (
            <option key={l.id} value={l.playerId}>
              {loadedIds.has(l.playerId) ? '✓ ' : ''}
              {l.shirtNumber ? `${l.shirtNumber} · ` : ''}
              {l.playerFullName} ({team})
            </option>
          )
        })}
      </select>

      {!playerId ? (
        <p className="py-2 text-sm text-slate-400">
          Elegí un jugador para cargar o editar sus estadísticas del partido.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PLAYER_STAT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-slate-500" htmlFor={`ps-${f.key}`}>
                  {f.label}
                </label>
                <input
                  id={`ps-${f.key}`}
                  type="number"
                  min={0}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar estadísticas del jugador'}
            </button>
            {savedAt && <span className="text-xs text-emerald-600">Guardado {savedAt}</span>}
          </div>
        </>
      )}
    </div>
  )
}
