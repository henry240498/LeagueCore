import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import { dataYToSvg } from '../../components/pitch/FootballPitch'
import InteractiveFootballPitch from '../../components/pitch/InteractiveFootballPitch'
import MatchCompareStats from '../../components/pitch/MatchCompareStats'
import MatchTimeline from '../../components/pitch/MatchTimeline'
import PlayerInfoPanel from '../../components/pitch/PlayerInfoPanel'
import PlayerPitchViz from '../../components/pitch/PlayerPitchViz'
import type {
  Match,
  MatchAdvancedMetric,
  MatchFormation,
  MatchLineupEntry,
  MatchPlayerPosition,
  ShotMapEntry,
  TimelineEvent,
} from '../../types/match'
import { FORMATION_SHAPES, SHOT_OUTCOME_LABELS } from '../../types/match'

// Deriva conteo esperado de defensores/mediocampistas/delanteros de una forma táctica real (ej.
// "4-2-3-1" -> 4 defensores, 5 mediocampistas [2+3 colapsado, LeagueCore sólo distingue una línea de
// mediocampo], 1 delantero). Sólo para el chequeo de consistencia -- nunca se usa para inventar
// jugadores que no están realmente cargados en la alineación.
function expectedCounts(shape: string): { def: number; mid: number; fwd: number } {
  const nums = shape.split('-').map(Number)
  const def = nums[0] ?? 0
  const fwd = nums[nums.length - 1] ?? 0
  const mid = nums.slice(1, -1).reduce((a, b) => a + b, 0)
  return { def, mid, fwd }
}

type TeamFilter = 'home' | 'away' | 'both'
type InnerView = 'partido' | 'tactica' | 'eventos' | 'estadisticas'

const HOME_COLOR = '#2563eb'
const AWAY_COLOR = '#dc2626'

export default function TacticalViewTab({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const [lineups, setLineups] = useState<MatchLineupEntry[] | null>(null)
  const [shotMap, setShotMap] = useState<ShotMapEntry[] | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [formations, setFormations] = useState<MatchFormation[]>([])
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('both')
  const [innerView, setInnerView] = useState<InnerView>('partido')
  const [editMode, setEditMode] = useState(false)
  const [showShots, setShowShots] = useState(false)
  const [selected, setSelected] = useState<MatchLineupEntry | null>(null)
  const [advancedMetrics, setAdvancedMetrics] = useState<MatchAdvancedMetric[]>([])
  const [vizPlayerId, setVizPlayerId] = useState<number | null>(null)
  const [vizPositions, setVizPositions] = useState<MatchPlayerPosition[]>([])

  const load = () => {
    api
      .get<MatchLineupEntry[]>(`/matches/${match.id}/lineups`)
      .then(setLineups)
      .catch((err) => onError(err instanceof ApiError ? err.message : 'Error al cargar las alineaciones'))
    api
      .get<ShotMapEntry[]>(`/matches/${match.id}/shot-map`)
      .then(setShotMap)
      .catch(() => setShotMap([]))
    api
      .get<TimelineEvent[]>(`/matches/${match.id}/timeline`)
      .then(setTimeline)
      .catch(() => setTimeline([]))
    api
      .get<MatchFormation[]>(`/matches/${match.id}/formations`)
      .then(setFormations)
      .catch(() => setFormations([]))
    api
      .get<MatchAdvancedMetric[]>(`/matches/${match.id}/advanced-metrics`)
      .then(setAdvancedMetrics)
      .catch(() => setAdvancedMetrics([]))
  }

  const handleSetFormation = async (teamId: number, formationShape: string) => {
    try {
      await api.put(`/matches/${match.id}/formations`, { teamId, formationShape })
      setFormations((prev) => {
        const others = prev.filter((f) => !(f.teamId === teamId && f.period == null))
        return [...others, { id: -1, teamId, formationShape, period: null, source: null, updatedAt: new Date().toISOString() }]
      })
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar la formación')
    }
  }

  useEffect(load, [match.id])

  useEffect(() => {
    if (!vizPlayerId) {
      setVizPositions([])
      return
    }
    api
      .get<MatchPlayerPosition[]>(`/matches/${match.id}/positions?playerId=${vizPlayerId}`)
      .then(setVizPositions)
      .catch(() => setVizPositions([]))
  }, [match.id, vizPlayerId])

  const starters = useMemo(() => (lineups ?? []).filter((l) => l.isStarting), [lineups])
  const substitutes = useMemo(() => (lineups ?? []).filter((l) => !l.isStarting), [lineups])

  const homeStarters = starters.filter((l) => l.teamId === match.homeTeamId)
  const awayStarters = starters.filter((l) => l.teamId === match.awayTeamId)

  const handleMove = async (lineupId: number, x: number, y: number) => {
    setLineups((prev) => prev?.map((l) => (l.id === lineupId ? { ...l, posX: x, posY: y } : l)) ?? prev)
    try {
      await api.patch(`/matches/${match.id}/lineups/${lineupId}/position`, { posX: x, posY: y })
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar la posición')
      load()
    }
  }

  const showHome = teamFilter === 'home' || teamFilter === 'both'
  const showAway = teamFilter === 'away' || teamFilter === 'both'
  const mirrorAway = teamFilter === 'both'

  const homeFormation = formations.find((f) => f.teamId === match.homeTeamId && f.period == null) ?? null
  const awayFormation = formations.find((f) => f.teamId === match.awayTeamId && f.period == null) ?? null

  const visibleShots = (shotMap ?? []).filter((s) => {
    if (teamFilter === 'home') return s.teamId === match.homeTeamId
    if (teamFilter === 'away') return s.teamId === match.awayTeamId
    return true
  })

  const shotsLayer = showShots && (
    <>
      {visibleShots.map((s) => {
        const mirror = teamFilter === 'both' && s.teamId === match.awayTeamId
        const y = mirror ? 100 - s.posY : s.posY
        const x = mirror ? 100 - s.posX : s.posX
        const color = s.outcome === 'goal' ? '#facc15' : 'white'
        return (
          <g key={`${s.source}-${s.id}`} transform={`translate(${x}, ${dataYToSvg(y)})`}>
            <circle r={1.6} fill={color} stroke="#0f172a" strokeWidth={0.3} opacity={0.9}>
              <title>
                {s.playerName} · {SHOT_OUTCOME_LABELS[s.outcome] ?? s.outcome} · {s.minute != null ? `${s.minute}'` : ''}
              </title>
            </circle>
          </g>
        )
      })}
    </>
  )

  if (!lineups) return <p className="text-slate-500">Cargando...</p>

  return (
    <div className="space-y-4">
      {starters.length === 0 ? (
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-center text-slate-500">
            Todavía no hay alineación titular cargada para este partido. Agregala desde la pestaña "Jugadores".
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto rounded-lg bg-white p-2 shadow">
            {(
              [
                ['partido', 'Partido'],
                ['tactica', 'Táctica'],
                ['eventos', 'Eventos'],
                ['estadisticas', 'Estadísticas'],
              ] as [InnerView, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setInnerView(key)}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  innerView === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {innerView === 'partido' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow">
                <div className="flex gap-2">
                  {(['home', 'away', 'both'] as TeamFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTeamFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        teamFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'home' ? match.homeTeamName : f === 'away' ? match.awayTeamName : 'Ambos'}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={showShots} onChange={(e) => setShowShots(e.target.checked)} />
                  Mapa de tiros
                </label>
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                {!match.venuePhotoUrl && (
                  <p className="mb-2 text-center text-xs text-slate-400">
                    {match.venueName ? `${match.venueName} — sin foto cargada, mostrando cancha genérica` : 'Sin estadio registrado — mostrando cancha genérica'}
                  </p>
                )}
                <InteractiveFootballPitch
                  editable={false}
                  backgroundPhotoUrl={match.venuePhotoUrl}
                  onPlayerClick={(pid) => setSelected(lineups.find((l) => l.playerId === pid) ?? null)}
                  extraLayer={shotsLayer}
                  home={{ starters: showHome ? homeStarters : [], formationShape: homeFormation?.formationShape ?? null, color: HOME_COLOR, mirror: false, logoUrl: match.homeTeamLogoUrl }}
                  away={{ starters: showAway ? awayStarters : [], formationShape: awayFormation?.formationShape ?? null, color: AWAY_COLOR, mirror: mirrorAway, logoUrl: match.awayTeamLogoUrl }}
                />
                {showShots && visibleShots.length === 0 && (
                  <p className="mt-2 text-center text-xs text-slate-400">Sin tiros con coordenadas cargadas para este partido.</p>
                )}
              </div>
            </>
          )}

          {innerView === 'tactica' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormationPicker
                  teamName={match.homeTeamName ?? 'Local'}
                  teamId={match.homeTeamId}
                  formation={homeFormation}
                  starters={homeStarters}
                  onSave={handleSetFormation}
                  align="left"
                />
                <FormationPicker
                  teamName={match.awayTeamName ?? 'Visitante'}
                  teamId={match.awayTeamId}
                  formation={awayFormation}
                  starters={awayStarters}
                  onSave={handleSetFormation}
                  align="right"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setEditMode((v) => !v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    editMode ? 'bg-amber-500 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {editMode ? '✓ Modo edición' : '✎ Editar posiciones'}
                </button>
              </div>

              {editMode && (
                <p className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-700">
                  Arrastrá un jugador para moverlo — se guarda automáticamente al soltarlo. Mientras tanto se muestra
                  la posición que implica la formación declarada (o una agrupación por rol si no hay formación).
                </p>
              )}

              <div className="rounded-lg bg-white p-4 shadow">
                <InteractiveFootballPitch
                  editable={editMode}
                  backgroundPhotoUrl={match.venuePhotoUrl}
                  onPlayerClick={(pid) => setSelected(lineups.find((l) => l.playerId === pid) ?? null)}
                  onMove={handleMove}
                  home={{ starters: homeStarters, formationShape: homeFormation?.formationShape ?? null, color: HOME_COLOR, mirror: false, logoUrl: match.homeTeamLogoUrl }}
                  away={{ starters: awayStarters, formationShape: awayFormation?.formationShape ?? null, color: AWAY_COLOR, mirror: true, logoUrl: match.awayTeamLogoUrl }}
                />
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                <h3 className="mb-2 text-sm font-bold text-slate-700">Suplentes</h3>
                {substitutes.length === 0 && <p className="text-sm text-slate-400">Sin suplentes registrados.</p>}
                <div className="flex flex-wrap gap-2">
                  {substitutes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelected(s)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      #{s.shirtNumber ?? '-'} {s.playerFullName}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {innerView === 'eventos' && (
            <>
              <MatchTimeline
                events={timeline}
                homeTeamId={match.homeTeamId}
                homeTeamName={match.homeTeamName ?? 'Local'}
                awayTeamName={match.awayTeamName ?? 'Visitante'}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TeamEventList
                  teamName={match.homeTeamName ?? 'Local'}
                  players={homeStarters}
                  timeline={timeline.filter((e) => e.teamId === match.homeTeamId)}
                  onSelect={setSelected}
                  align="left"
                />
                <TeamEventList
                  teamName={match.awayTeamName ?? 'Visitante'}
                  players={awayStarters}
                  timeline={timeline.filter((e) => e.teamId === match.awayTeamId)}
                  onSelect={setSelected}
                  align="right"
                />
              </div>
            </>
          )}

          {innerView === 'estadisticas' && (
            <>
              <MatchCompareStats match={match} />

              <div className="rounded-lg bg-white p-4 shadow">
                <h3 className="mb-2 text-sm font-bold text-slate-700">Analítica avanzada (GPS / xG / xA / PPDA)</h3>
                {advancedMetrics.length === 0 ? (
                  <p className="text-sm text-slate-400">NO DISPONIBLE — sin datos de proveedor avanzado cargados para este partido.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {advancedMetrics.map((m) => (
                      <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-center">
                        <p className="text-lg font-bold text-slate-900 tabular-nums">{m.metricValue}</p>
                        <p className="text-xs text-slate-500">{m.metricName}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Mapa de pases / calor por jugador</h3>
                  <select
                    value={vizPlayerId ?? ''}
                    onChange={(e) => setVizPlayerId(e.target.value ? Number(e.target.value) : null)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
                  >
                    <option value="">Elegir jugador...</option>
                    {starters.map((s) => (
                      <option key={s.playerId} value={s.playerId}>
                        {s.playerFullName}
                      </option>
                    ))}
                  </select>
                </div>
                {vizPlayerId ? (
                  <PlayerPitchViz
                    positions={vizPositions.map((p) => ({ minute: p.minute, posX: p.posX, posY: p.posY, weight: p.weight }))}
                    shots={visibleShots.filter((s) => s.playerId === vizPlayerId)}
                    lineupPlayers={starters}
                  />
                ) : (
                  <p className="text-sm text-slate-400">Elegí un jugador para ver su posición, pases, tiros o recorrido en este partido.</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {selected && <PlayerInfoPanel entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// Lista numerada de titulares con íconos de eventos reales (concepto de la imagen de referencia:
// dos columnas con el plantel y sus eventos al lado) -- goles/asistencias/tarjetas vienen ya
// contados en `players` (derivados de goals/cards, ver match-participants.service.ts); las
// sustituciones se buscan en el timeline real (única fuente que las tiene).
function TeamEventList({
  teamName,
  players,
  timeline,
  onSelect,
  align,
}: {
  teamName: string
  players: MatchLineupEntry[]
  timeline: TimelineEvent[]
  onSelect: (entry: MatchLineupEntry) => void
  align: 'left' | 'right'
}) {
  const sorted = [...players].sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h3 className={`mb-2 text-sm font-bold text-slate-700 ${align === 'right' ? 'text-right' : ''}`}>{teamName}</h3>
      <ul className="space-y-1">
        {sorted.map((p) => {
          const subOut = timeline.find((e) => e.type === 'substitution' && e.playerOutId === p.playerId)
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
              >
                <span className="w-5 flex-none text-xs text-slate-400">{p.shirtNumber ?? '-'}</span>
                <span className="flex-1 truncate text-slate-800">{p.playerFullName}</span>
                <span className="flex flex-none gap-0.5 text-xs">
                  {p.goals > 0 && <span title={`${p.goals} gol(es)`}>{'⚽'.repeat(Math.min(p.goals, 3))}</span>}
                  {p.assists > 0 && <span title={`${p.assists} asistencia(s)`}>🅰️</span>}
                  {p.yellowCards > 0 && <span title="Amarilla" aria-label="Tarjeta amarilla" role="img">🟨</span>}
                  {p.redCards > 0 && <span title="Roja" aria-label="Tarjeta roja" role="img">🟥</span>}
                  {subOut && <span title={`Cambio ${subOut.minute ?? ''}'`}>🔄</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Selector de formación táctica por equipo + aviso de consistencia (no bloqueante): compara el
// conteo real de titulares por línea contra lo que implica la forma elegida (ej. "4-3-3" declarado
// pero sólo 3 defensores cargados en la alineación real) -- sólo informa, nunca inventa jugadores.
function FormationPicker({
  teamName,
  teamId,
  formation,
  starters,
  onSave,
  align,
}: {
  teamName: string
  teamId: number
  formation: MatchFormation | null
  starters: MatchLineupEntry[]
  onSave: (teamId: number, formationShape: string) => void | Promise<void>
  align: 'left' | 'right'
}) {
  const [draft, setDraft] = useState(formation?.formationShape ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(formation?.formationShape ?? '')
  }, [formation?.formationShape])

  const realCounts = useMemo(() => {
    let def = 0
    let mid = 0
    let fwd = 0
    for (const p of starters) {
      if (p.position === 'Defensor') def += 1
      else if (p.position === 'Delantero') fwd += 1
      else if (p.position === 'Portero') continue
      else mid += 1
    }
    return { def, mid, fwd }
  }, [starters])

  const mismatch = useMemo(() => {
    if (!formation || starters.length === 0) return null
    const expected = expectedCounts(formation.formationShape)
    if (expected.def === realCounts.def && expected.mid === realCounts.mid && expected.fwd === realCounts.fwd) return null
    return `La alineación real (${realCounts.def}D-${realCounts.mid}M-${realCounts.fwd}D) no coincide con ${formation.formationShape}`
  }, [formation, realCounts, starters.length])

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await onSave(teamId, draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-3 shadow">
      <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs font-bold text-slate-700">{teamName}</span>
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
        >
          <option value="">Sin formación</option>
          {FORMATION_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {shape}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={!draft || draft === formation?.formationShape || saving}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      {mismatch && <p className={`mt-1 text-xs text-amber-600 ${align === 'right' ? 'text-right' : ''}`}>⚠️ {mismatch}</p>}
    </div>
  )
}
