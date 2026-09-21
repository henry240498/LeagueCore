import { useCallback, useEffect, useState } from 'react'
import FootballPitch, { dataYToSvg } from '../../components/pitch/FootballPitch'
import { ApiError } from '../../context/AuthContext'
import { tacticsService } from '../../services/tactics'
import type { Match } from '../../types/match'
import MatchMapsSection from './MatchMapsSection'
import {
  SET_PIECE_KIND_LABELS,
  TACTICAL_PHASES,
  TACTICAL_PHASE_LABELS,
  type CustomEventType,
  type Possession,
  type SetPiece,
  type ShotMap,
  type TacticalSetup,
} from '../../types/tactics'

const ZONES = [
  'TERCIO_DEF_IZQ', 'TERCIO_DEF_CENTRO', 'TERCIO_DEF_DER',
  'MEDIO_IZQ', 'MEDIO_CENTRO', 'MEDIO_DER',
  'ULTIMO_TERCIO_IZQ', 'ULTIMO_TERCIO_CENTRO', 'ULTIMO_TERCIO_DER',
]

const SET_PIECE_VARIANTS: Record<string, string[]> = {
  CORNER: ['Corto', 'Primer palo', 'Segundo palo', 'Centro', 'Pase atrás', 'Jugada preparada'],
  FREEKICK: ['Directo', 'Indirecto', 'Centro', 'Jugada preparada'],
  THROWIN: ['Largo', 'Corto', 'Jugada preparada'],
  PENALTY: ['Derecha', 'Izquierda', 'Centro', 'Picada'],
  KICKOFF: ['Largo', 'Corto'],
}

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function MatchTacticsTab({
  match,
  onError,
}: {
  match: Match
  onError: (msg: string) => void
}) {
  const matchId = match.id
  const teams = [
    { id: match.homeTeamId, name: match.homeTeamName ?? 'Local' },
    { id: match.awayTeamId, name: match.awayTeamName ?? 'Visitante' },
  ]

  const [setups, setSetups] = useState<TacticalSetup[]>([])
  const [shotMap, setShotMap] = useState<ShotMap | null>(null)
  const [possessions, setPossessions] = useState<Possession[]>([])
  const [setPieces, setSetPieces] = useState<SetPiece[]>([])
  const [eventTypes, setEventTypes] = useState<CustomEventType[]>([])
  const [customEvents, setCustomEvents] = useState<import('../../types/tactics').CustomEvent[]>([])

  const fail = useCallback(
    (err: unknown, fallback: string) => onError(err instanceof ApiError ? err.message : fallback),
    [onError],
  )

  const load = useCallback(() => {
    tacticsService.listSetups(matchId).then(setSetups).catch((e) => fail(e, 'Error al cargar planteos'))
    tacticsService.getShotMap(matchId).then(setShotMap).catch(() => {})
    tacticsService.listPossessions(matchId).then(setPossessions).catch(() => {})
    tacticsService.listSetPieces(matchId).then(setSetPieces).catch(() => {})
    tacticsService.listEventTypes().then(setEventTypes).catch(() => {})
    tacticsService.listCustomEvents(matchId).then(setCustomEvents).catch(() => {})
  }, [matchId, fail])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <SetupSection matchId={matchId} teams={teams} setups={setups} onSaved={load} onError={onError} />
      <MatchMapsSection matchId={matchId} onError={onError} />
      <ShotMapSection shotMap={shotMap} teams={teams} />
      <PossessionSection
        matchId={matchId}
        teams={teams}
        possessions={possessions}
        onChanged={load}
        onError={onError}
      />
      <SetPieceSection
        matchId={matchId}
        teams={teams}
        setPieces={setPieces}
        onChanged={load}
        onError={onError}
      />
      <CustomEventsSection
        matchId={matchId}
        teams={teams}
        eventTypes={eventTypes}
        customEvents={customEvents}
        onChanged={load}
        onError={onError}
      />
    </div>
  )
}

// ---------- Planteos por fase ----------
function SetupSection({
  matchId,
  teams,
  setups,
  onSaved,
  onError,
}: {
  matchId: number
  teams: { id: number; name: string }[]
  setups: TacticalSetup[]
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [teamId, setTeamId] = useState(String(teams[0]?.id ?? ''))
  const [phase, setPhase] = useState<(typeof TACTICAL_PHASES)[number]>('INICIAL')
  const [formation, setFormation] = useState('')
  const [block, setBlock] = useState('')
  const [pressing, setPressing] = useState('')
  const [buildup, setBuildup] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const existing = setups.find((s) => s.teamId === Number(teamId) && s.phase === phase)
    setFormation(existing?.formationShape ?? '')
    setBlock(existing?.block ?? '')
    setPressing(existing?.pressing ?? '')
    setBuildup(existing?.buildup ?? '')
  }, [setups, teamId, phase])

  const handleSave = async () => {
    if (!teamId) return
    setSaving(true)
    try {
      await tacticsService.saveSetup(matchId, {
        teamId: Number(teamId),
        phase,
        formationShape: formation || null,
        block: (block || null) as never,
        pressing: pressing || null,
        buildup: buildup || null,
      })
      onSaved()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-3 text-lg font-bold">📐 Planteo táctico por fase</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value as never)} className={inputClass}>
          {TACTICAL_PHASES.map((p) => (
            <option key={p} value={p}>
              {TACTICAL_PHASE_LABELS[p]}
            </option>
          ))}
        </select>
        <input
          value={formation}
          onChange={(e) => setFormation(e.target.value)}
          placeholder="Forma (4-3-3)"
          className={`${inputClass} w-32`}
        />
        <select value={block} onChange={(e) => setBlock(e.target.value)} className={inputClass}>
          <option value="">Bloque…</option>
          <option value="BAJO">Bloque bajo</option>
          <option value="MEDIO">Bloque medio</option>
          <option value="ALTO">Bloque alto</option>
        </select>
        <input
          value={pressing}
          onChange={(e) => setPressing(e.target.value)}
          placeholder="Presión / repliegue"
          className={`${inputClass} flex-1 min-w-[140px]`}
        />
        <input
          value={buildup}
          onChange={(e) => setBuildup(e.target.value)}
          placeholder="Salida / construcción"
          className={`${inputClass} flex-1 min-w-[140px]`}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !teamId}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {setups.length === 0 ? (
        <p className="text-sm text-slate-500">Sin planteos cargados. Guardá la formación inicial de cada equipo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-2">Equipo</th>
                <th className="px-2 py-2">Fase</th>
                <th className="px-2 py-2">Forma</th>
                <th className="px-2 py-2">Bloque</th>
                <th className="px-2 py-2">Presión</th>
                <th className="px-2 py-2">Salida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {setups.map((s) => (
                <tr key={s.id}>
                  <td className="px-2 py-2 font-medium">{s.teamName}</td>
                  <td className="px-2 py-2">{TACTICAL_PHASE_LABELS[s.phase]}</td>
                  <td className="px-2 py-2">{s.formationShape ?? '—'}</td>
                  <td className="px-2 py-2">{s.block ?? '—'}</td>
                  <td className="px-2 py-2 text-slate-600">{s.pressing ?? '—'}</td>
                  <td className="px-2 py-2 text-slate-600">{s.buildup ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------- Mapa de tiros + xG ----------
function ShotMapSection({
  shotMap,
  teams,
}: {
  shotMap: ShotMap | null
  teams: { id: number; name: string }[]
}) {
  if (!shotMap) return null
  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? `#${id}`
  const zoneCounts = new Map<string, number>()
  for (const item of shotMap.items) zoneCounts.set(item.zone, (zoneCounts.get(item.zone) ?? 0) + 1)

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-3 text-lg font-bold">🎯 Mapa de tiros + xG</h2>
      {shotMap.items.length === 0 ? (
        <p className="text-sm text-slate-500">Sin tiros registrados (goles con posición + tiros).</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <FootballPitch>
            {shotMap.items.map((s) => (
              <g key={s.id} transform={`translate(${s.posX}, ${dataYToSvg(s.posY)})`}>
                <title>{`${s.playerName} · ${s.minute ?? '?'}′ · ${s.outcome}${s.xg !== null ? ` · xG ${s.xg}` : ''}`}</title>
                <circle
                  r={s.outcome === 'goal' ? 3 : 2.2}
                  fill={s.outcome === 'goal' ? '#2f9e44' : '#e03131'}
                  stroke="white"
                  strokeWidth={0.5}
                  opacity={0.9}
                />
              </g>
            ))}
          </FootballPitch>
          <div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-2 py-2">Equipo</th>
                  <th className="px-2 py-2">Tiros</th>
                  <th className="px-2 py-2">Goles</th>
                  <th className="px-2 py-2">xG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shotMap.totals.map((t) => (
                  <tr key={t.teamId}>
                    <td className="px-2 py-2 font-medium">{teamName(t.teamId)}</td>
                    <td className="px-2 py-2">{t.shots}</td>
                    <td className="px-2 py-2">{t.goals}</td>
                    <td className="px-2 py-2">{t.xg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-600">Tiros por zona</h3>
            <div className="flex flex-wrap gap-1">
              {[...zoneCounts.entries()].map(([zone, count]) => (
                <span key={zone} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {zone}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------- Posesiones ----------
function PossessionSection({
  matchId,
  teams,
  possessions,
  onChanged,
  onError,
}: {
  matchId: number
  teams: { id: number; name: string }[]
  possessions: Possession[]
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState({ teamId: String(teams[0]?.id ?? ''), startMinute: '', passes: '', outcome: '', xg: '', startZone: '', endZone: '' })

  const handleAdd = async () => {
    if (!form.teamId) return
    try {
      await tacticsService.createPossession(matchId, {
        teamId: Number(form.teamId),
        startMinute: form.startMinute ? Number(form.startMinute) : undefined,
        passes: form.passes ? Number(form.passes) : undefined,
        outcome: form.outcome || undefined,
        xg: form.xg ? Number(form.xg) : undefined,
        startZone: form.startZone || undefined,
        endZone: form.endZone || undefined,
      })
      setForm({ teamId: form.teamId, startMinute: '', passes: '', outcome: '', xg: '', startZone: '', endZone: '' })
      onChanged()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar')
    }
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-3 text-lg font-bold">🔄 Posesiones ({possessions.length})</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={inputClass}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input value={form.startMinute} onChange={(e) => setForm({ ...form, startMinute: e.target.value })} placeholder="Min" type="number" className={`${inputClass} w-20`} />
        <input value={form.passes} onChange={(e) => setForm({ ...form, passes: e.target.value })} placeholder="Pases" type="number" className={`${inputClass} w-24`} />
        <select value={form.startZone} onChange={(e) => setForm({ ...form, startZone: e.target.value })} className={inputClass}>
          <option value="">Zona inicial…</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select value={form.endZone} onChange={(e) => setForm({ ...form, endZone: e.target.value })} className={inputClass}>
          <option value="">Zona final…</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className={inputClass}>
          <option value="">Resultado…</option>
          {['TIRO', 'GOL', 'PERDIDA', 'FALTA_RECIBIDA', 'FALTA_COMETIDA', 'CORNER', 'SAQUE_MANOS', 'FIN_PERIODO'].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input value={form.xg} onChange={(e) => setForm({ ...form, xg: e.target.value })} placeholder="xG" type="number" step="0.01" className={`${inputClass} w-20`} />
        <button type="button" onClick={handleAdd} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Registrar
        </button>
      </div>
      {possessions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-2">Min</th>
                <th className="px-2 py-2">Equipo</th>
                <th className="px-2 py-2">Pases</th>
                <th className="px-2 py-2">Zonas</th>
                <th className="px-2 py-2">Resultado</th>
                <th className="px-2 py-2">xG</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {possessions.map((p) => (
                <tr key={p.id}>
                  <td className="px-2 py-2">{p.startMinute ?? '—'}′</td>
                  <td className="px-2 py-2 font-medium">{p.teamName}</td>
                  <td className="px-2 py-2">{p.passes ?? '—'}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {p.startZone ?? '?'} → {p.endZone ?? '?'}
                  </td>
                  <td className="px-2 py-2">{p.outcome ?? '—'}</td>
                  <td className="px-2 py-2">{p.xg ?? '—'}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        await tacticsService.removePossession(matchId, p.id)
                        onChanged()
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------- Balón parado ----------
function SetPieceSection({
  matchId,
  teams,
  setPieces,
  onChanged,
  onError,
}: {
  matchId: number
  teams: { id: number; name: string }[]
  setPieces: SetPiece[]
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState({ teamId: String(teams[0]?.id ?? ''), kind: 'CORNER', variant: '', minute: '', outcome: '', playCode: '' })

  const handleAdd = async () => {
    if (!form.teamId) return
    try {
      await tacticsService.createSetPiece(matchId, {
        teamId: Number(form.teamId),
        kind: form.kind,
        variant: form.variant || undefined,
        minute: form.minute ? Number(form.minute) : undefined,
        outcome: form.outcome || undefined,
        playCode: form.playCode || undefined,
      })
      setForm({ ...form, variant: '', minute: '', outcome: '', playCode: '' })
      onChanged()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar')
    }
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-3 text-lg font-bold">🚩 Balón parado ({setPieces.length})</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={inputClass}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, variant: '' })} className={inputClass}>
          {Object.entries(SET_PIECE_KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} className={inputClass}>
          <option value="">Variante…</option>
          {(SET_PIECE_VARIANTS[form.kind] ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <input value={form.minute} onChange={(e) => setForm({ ...form, minute: e.target.value })} placeholder="Min" type="number" className={`${inputClass} w-20`} />
        <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className={inputClass}>
          <option value="">Resultado…</option>
          {['GOL', 'OCASION', 'DESPEJADO', 'PERDIDA', 'REPETICION', 'SIN_RESULTADO'].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input value={form.playCode} onChange={(e) => setForm({ ...form, playCode: e.target.value })} placeholder="Jugada (CORNER-001)" className={`${inputClass} w-44`} />
        <button type="button" onClick={handleAdd} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Registrar
        </button>
      </div>
      {setPieces.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {setPieces.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <strong>{s.minute ?? '?'}′</strong> · {s.teamName} · {SET_PIECE_KIND_LABELS[s.kind]}
                {s.variant ? ` (${s.variant})` : ''} → <strong>{s.outcome ?? '—'}</strong>
                {s.playCode ? ` · ${s.playCode}` : ''}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await tacticsService.removeSetPiece(matchId, s.id)
                  onChanged()
                }}
                className="text-red-600 hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------- Eventos personalizados ----------
function CustomEventsSection({
  matchId,
  teams,
  eventTypes,
  customEvents,
  onChanged,
  onError,
}: {
  matchId: number
  teams: { id: number; name: string }[]
  eventTypes: CustomEventType[]
  customEvents: import('../../types/tactics').CustomEvent[]
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const [teamId, setTeamId] = useState(String(teams[0]?.id ?? ''))
  const [eventCode, setEventCode] = useState('')
  const [minute, setMinute] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const handleAddType = async () => {
    if (!newCode.trim() || !newLabel.trim()) return
    try {
      await tacticsService.createEventType({ code: newCode.trim().toUpperCase().replace(/\s+/g, '_'), label: newLabel.trim() })
      setNewCode('')
      setNewLabel('')
      onChanged()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al crear')
    }
  }

  const handleLog = async () => {
    if (!teamId || !eventCode) return
    try {
      await tacticsService.createCustomEvent(matchId, {
        teamId: Number(teamId),
        eventCode,
        minute: minute ? Number(minute) : undefined,
      })
      setMinute('')
      onChanged()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar')
    }
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-3 text-lg font-bold">🏷️ Eventos personalizados</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Código (PRESION_EFECTIVA)" className={`${inputClass} w-56`} />
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Etiqueta (Presión efectiva)" className={`${inputClass} flex-1 min-w-[160px]`} />
        <button type="button" onClick={handleAddType} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900">
          + Crear tipo
        </button>
      </div>
      {eventTypes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={eventCode} onChange={(e) => setEventCode(e.target.value)} className={inputClass}>
            <option value="">Evento…</option>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          <input value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="Min" type="number" className={`${inputClass} w-20`} />
          <button type="button" onClick={handleLog} disabled={!eventCode} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            Registrar
          </button>
        </div>
      )}
      {customEvents.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {customEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                <strong>{e.minute ?? '?'}′</strong> · {e.teamName} · {e.eventLabel}
                {e.playerName ? ` · ${e.playerName}` : ''}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await tacticsService.removeCustomEvent(matchId, e.id)
                  onChanged()
                }}
                className="text-red-600 hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
