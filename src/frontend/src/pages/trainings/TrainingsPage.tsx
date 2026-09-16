import { useEffect, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { operationsService } from '../../services/operations'
import { api } from '../../services/api'
import type { Team } from '../../types/team'
import type { Player } from '../../types/player'
import { ATTENDANCE_STATUSES, type Attendance, type Exercise, type Objective, type Training } from '../../types/operations'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

type Tab = 'sesiones' | 'ejercicios' | 'objetivos'

export default function TrainingsPage() {
  const [tab, setTab] = useState<Tab>('sesiones')
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">🏋️ Entrenamientos</h1>
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {(
          [
            ['sesiones', 'Sesiones'],
            ['ejercicios', 'Ejercicios'],
            ['objetivos', 'Objetivos'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'sesiones' && <SessionsTab />}
      {tab === 'ejercicios' && <ExercisesTab />}
      {tab === 'objetivos' && <ObjectivesTab />}
    </div>
  )
}

function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
  }, [])
  return teams
}

function SessionsTab() {
  const teams = useTeams()
  const [teamId, setTeamId] = useState('')
  const [items, setItems] = useState<Training[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ date: '', duration: '', objective: '', load: '' })
  const [openId, setOpenId] = useState<number | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [roster, setRoster] = useState<{ playerId: number; playerName: string }[]>([])

  const load = () => {
    operationsService
      .listTrainings(teamId ? Number(teamId) : undefined)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar'))
  }

  useEffect(load, [teamId])

  const openAttendance = async (t: Training) => {
    setOpenId(t.id)
    try {
      const [att, hist] = await Promise.all([
        operationsService.getAttendance(t.id),
        api.get<{ playerId: number; playerName: string }[]>(`/teams/${t.teamId}/roster-history`).catch(() => []),
      ])
      setAttendance(att)
      const present = new Set(att.map((a) => a.playerId))
      setRoster((hist as { playerId: number; playerName: string }[]).filter((h) => !present.has(h.playerId)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error')
    }
  }

  const mark = async (trainingId: number, playerId: number, status: string) => {
    const updated = await operationsService.setAttendance(trainingId, playerId, status)
    setAttendance(updated)
  }

  const handleCreate = async () => {
    if (!teamId || !form.date) {
      setError('Elegí equipo y fecha.')
      return
    }
    try {
      await operationsService.createTraining({
        teamId: Number(teamId),
        trainingDate: form.date,
        durationMin: form.duration ? Number(form.duration) : undefined,
        objective: form.objective || undefined,
        loadLevel: form.load || undefined,
      })
      setForm({ date: '', duration: '', objective: '', load: '' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear')
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-white p-4 shadow">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={`${inputClass} min-w-[200px] flex-1`}>
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
        <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Duración (min)" type="number" className={`${inputClass} w-32`} />
        <input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Objetivo de la sesión" className={`${inputClass} min-w-[180px] flex-1`} />
        <select value={form.load} onChange={(e) => setForm({ ...form, load: e.target.value })} className={inputClass}>
          <option value="">Carga…</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
        <button type="button" onClick={handleCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Sesión
        </button>
      </div>

      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{t.teamName} · {t.trainingDate.slice(0, 10)}</p>
                <p className="text-xs text-slate-500">
                  {t.objective ?? 'Sin objetivo'} · {t.durationMin ? `${t.durationMin} min` : 's/d'} · carga {t.loadLevel ?? '—'} · {t.attendanceCount} presentes
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => (openId === t.id ? setOpenId(null) : openAttendance(t))} className="text-blue-600 hover:underline">
                  {openId === t.id ? 'Cerrar' : 'Asistencia'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('¿Eliminar la sesión?')) return
                    await operationsService.removeTraining(t.id)
                    load()
                  }}
                  className="text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
            {openId === t.id && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <ul className="divide-y divide-slate-100 text-sm">
                  {attendance.map((a) => (
                    <li key={a.playerId} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="font-medium">{a.playerName}</span>
                      <select value={a.status} onChange={(e) => mark(t.id, a.playerId, e.target.value)} className={`${inputClass} py-1 text-xs`}>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
                {roster.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-semibold text-slate-500">Sin marcar ({roster.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {roster.slice(0, 30).map((r) => (
                        <button key={r.playerId} type="button" onClick={() => mark(t.id, r.playerId, 'ENTRENO')} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs hover:bg-green-100" title="Marcar presente">
                          + {r.playerName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-sm text-slate-500">Sin sesiones.</p>}
      </div>
    </div>
  )
}

function ExercisesTab() {
  const [items, setItems] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', category: '', objective: '', duration: '', intensity: '' })

  const load = () => {
    operationsService.listExercises(search || undefined).then(setItems).catch(() => {})
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    await operationsService.createExercise({
      name: form.name.trim(),
      category: form.category || undefined,
      objective: form.objective || undefined,
      durationMin: form.duration ? Number(form.duration) : undefined,
      intensity: form.intensity || undefined,
    })
    setForm({ name: '', category: '', objective: '', duration: '', intensity: '' })
    load()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-white p-4 shadow">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ejercicio…" className={`${inputClass} min-w-[160px] flex-1`} />
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre *" className={`${inputClass} min-w-[160px] flex-1`} />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Categoría" className={inputClass} />
        <input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Objetivo" className={`${inputClass} min-w-[160px] flex-1`} />
        <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Min" type="number" className={`${inputClass} w-20`} />
        <select value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })} className={inputClass}>
          <option value="">Intensidad…</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
        <button type="button" onClick={handleCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Guardar
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((e) => (
          <div key={e.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{e.name}</p>
                <p className="text-xs text-slate-500">
                  {e.category ?? 'Sin categoría'} · {e.durationMin ? `${e.durationMin} min` : 's/d'} · {e.intensity ?? 's/i'}
                </p>
                {e.objective && <p className="mt-1 text-sm text-slate-600">{e.objective}</p>}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await operationsService.removeExercise(e.id)
                  load()
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-center text-sm text-slate-500">Biblioteca vacía.</p>}
    </div>
  )
}

function ObjectivesTab() {
  const teams = useTeams()
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [teamObjId, setTeamObjId] = useState('')
  const [playerObjs, setPlayerObjs] = useState<Objective[]>([])
  const [teamObjs, setTeamObjs] = useState<Objective[]>([])
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')

  useEffect(() => {
    api.get<{ items: Player[] }>('/players?pageSize=100').then((r: unknown) => {
      const list = Array.isArray(r) ? r : (r as { items?: Player[] }).items ?? []
      setPlayers(list)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (playerId) operationsService.listPlayerObjectives(Number(playerId)).then(setPlayerObjs).catch(() => {})
    else setPlayerObjs([])
  }, [playerId])

  useEffect(() => {
    if (teamObjId) operationsService.listTeamObjectives(Number(teamObjId)).then(setTeamObjs).catch(() => {})
    else setTeamObjs([])
  }, [teamObjId])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 font-bold">🎯 Objetivos individuales</h2>
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={`${inputClass} mb-2 w-full`}>
          <option value="">Jugador…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>
        <div className="mb-3 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: pases progresivos 5 → 8" className={`${inputClass} flex-1`} />
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta" type="number" className={`${inputClass} w-24`} />
          <button
            type="button"
            onClick={async () => {
              if (!playerId || !title.trim()) return
              await operationsService.createPlayerObjective(Number(playerId), { title: title.trim(), targetValue: target ? Number(target) : undefined })
              setTitle('')
              setTarget('')
              operationsService.listPlayerObjectives(Number(playerId)).then(setPlayerObjs).catch(() => {})
            }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            +
          </button>
        </div>
        <ObjectiveList
          items={playerObjs}
          onAdvance={async (o, v) => {
            await operationsService.updatePlayerObjective(o.id, { currentValue: v })
            operationsService.listPlayerObjectives(Number(playerId)).then(setPlayerObjs).catch(() => {})
          }}
          onDone={async (o) => {
            await operationsService.updatePlayerObjective(o.id, { status: 'LOGRADO' })
            operationsService.listPlayerObjectives(Number(playerId)).then(setPlayerObjs).catch(() => {})
          }}
        />
        {playerObjs.length === 0 && playerId && <p className="text-xs text-slate-500">Sin objetivos. Ej: "Aumentar pases progresivos de 5 a 8".</p>}
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 font-bold">🛡️ Objetivos colectivos</h2>
        <select value={teamObjId} onChange={(e) => setTeamObjId(e.target.value)} className={`${inputClass} mb-2 w-full`}>
          <option value="">Equipo…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="mb-3 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: aumentar xG, reducir pérdidas" className={`${inputClass} flex-1`} />
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta" type="number" className={`${inputClass} w-24`} />
          <button
            type="button"
            onClick={async () => {
              if (!teamObjId || !title.trim()) return
              await operationsService.createTeamObjective(Number(teamObjId), { title: title.trim(), targetValue: target ? Number(target) : undefined })
              setTitle('')
              setTarget('')
              operationsService.listTeamObjectives(Number(teamObjId)).then(setTeamObjs).catch(() => {})
            }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            +
          </button>
        </div>
        <ObjectiveList
          items={teamObjs}
          onAdvance={async (o, v) => {
            await operationsService.updateTeamObjective(o.id, { currentValue: v })
            operationsService.listTeamObjectives(Number(teamObjId)).then(setTeamObjs).catch(() => {})
          }}
          onDone={async (o) => {
            await operationsService.updateTeamObjective(o.id, { status: 'LOGRADO' })
            operationsService.listTeamObjectives(Number(teamObjId)).then(setTeamObjs).catch(() => {})
          }}
        />
      </section>
    </div>
  )
}

function ObjectiveList({ items, onAdvance, onDone }: { items: Objective[]; onAdvance: (o: Objective, v: number) => void; onDone: (o: Objective) => void }) {
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  return (
    <ul className="space-y-2 text-sm">
      {items.map((o) => {
        return (
          <li key={o.id} className="rounded bg-slate-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{o.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${o.status === 'LOGRADO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                {o.status.replace(/_/g, ' ')}
              </span>
            </div>
            {o.targetValue !== null && (
              <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${Math.min(100, Math.round((((o.currentValue ?? 0) / o.targetValue) as number) * 100))}%` }}
                />
              </div>
            )}
            <div className="mt-1 flex gap-2">
              <input
                value={drafts[o.id] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [o.id]: e.target.value })}
                placeholder={`Avance (actual ${o.currentValue ?? 0})`}
                type="number"
                className={`${inputClass} flex-1 py-1 text-xs`}
              />
              <button type="button" onClick={() => drafts[o.id] && onAdvance(o, Number(drafts[o.id]))} className="text-xs text-blue-600 hover:underline">
                Actualizar
              </button>
              {o.status === 'EN_CURSO' && (
                <button type="button" onClick={() => onDone(o)} className="text-xs text-green-700 hover:underline">
                  Logrado
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
