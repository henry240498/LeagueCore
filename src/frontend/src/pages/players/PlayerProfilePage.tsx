import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import StatRadar from '../../components/stats/StatRadar'
import PlayerCareerSection from './PlayerCareerSection'
import { ApiError } from '../../context/AuthContext'
import { playerProfileService } from '../../services/playerProfile'
import {
  TECHNICAL_ATTRIBUTES,
  TECHNICAL_ATTRIBUTE_LABELS,
  type PlayerProfile,
} from '../../types/player'

const AVAILABILITY_LABELS: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  DUDOSO: 'Dudoso',
  LESIONADO: 'Lesionado',
  SANCIONADO: 'Sancionado',
  DESCANSO: 'Descanso',
  SELECCION: 'Selección',
  PERMISO: 'Permiso',
}

const CONTRACT_LABELS: Record<string, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  A_PRESTAMO: 'A préstamo',
  LIBRE: 'Libre',
  JUVENIL: 'Juvenil',
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function PlayerProfilePage() {
  const { id } = useParams()
  const playerId = Number(id)
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [error, setError] = useState('')

  // Editor técnico
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [evaluator, setEvaluator] = useState('')
  const [savingTech, setSavingTech] = useState(false)

  // Alta física rápida
  const [phys, setPhys] = useState({ recordedAt: '', distanceM: '', maxSpeedKmh: '', sprints: '', playerLoad: '', fatigue: '', source: 'manual' })
  const [savingPhys, setSavingPhys] = useState(false)

  // Alta lesión
  const [inj, setInj] = useState({ injuryType: '', bodyPart: '', severity: 'LEVE', startDate: '', note: '' })
  const [savingInj, setSavingInj] = useState(false)

  const load = useCallback(() => {
    playerProfileService
      .getProfile(playerId)
      .then((p) => {
        setProfile(p)
        const map: Record<string, number> = {}
        for (const r of p.technical) map[r.attribute] = r.value
        setDraft(map)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el expediente'))
  }, [playerId])

  useEffect(() => {
    load()
  }, [load])

  const radarData = useMemo(
    () =>
      TECHNICAL_ATTRIBUTES.filter((a) => draft[a] !== undefined).map((a) => ({
        attribute: TECHNICAL_ATTRIBUTE_LABELS[a] ?? a,
        a: draft[a] ?? null,
      })),
    [draft],
  )

  const evolutionData = useMemo(
    () =>
      (profile?.physicalEvolution ?? []).map((r) => ({
        fecha: fmtDate(r.recordedAt),
        Distancia: r.distanceM ?? 0,
        'Alta intensidad': r.hiDistanceM ?? 0,
      })),
    [profile],
  )

  const handleSaveTechnical = async () => {
    const ratings = Object.entries(draft)
      .filter(([, v]) => Number.isFinite(v))
      .map(([attribute, value]) => ({ attribute, value: Math.min(100, Math.max(1, Math.round(value))) }))
    if (ratings.length === 0) {
      setError('Mové al menos un atributo para guardar la valoración.')
      return
    }
    setSavingTech(true)
    setError('')
    try {
      await playerProfileService.saveTechnical(playerId, {
        ratings,
        evaluator: evaluator || undefined,
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setSavingTech(false)
    }
  }

  const handleAddPhysical = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPhys(true)
    setError('')
    try {
      await playerProfileService.addPhysical(playerId, {
        recordedAt: phys.recordedAt || undefined,
        distanceM: phys.distanceM ? Number(phys.distanceM) : undefined,
        maxSpeedKmh: phys.maxSpeedKmh ? Number(phys.maxSpeedKmh) : undefined,
        sprints: phys.sprints ? Number(phys.sprints) : undefined,
        playerLoad: phys.playerLoad ? Number(phys.playerLoad) : undefined,
        fatigue: phys.fatigue ? Number(phys.fatigue) : undefined,
        source: phys.source,
      } as never)
      setPhys({ recordedAt: '', distanceM: '', maxSpeedKmh: '', sprints: '', playerLoad: '', fatigue: '', source: 'manual' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar')
    } finally {
      setSavingPhys(false)
    }
  }

  const handleAddInjury = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inj.injuryType.trim() || !inj.startDate) {
      setError('La lesión necesita tipo y fecha de inicio.')
      return
    }
    setSavingInj(true)
    setError('')
    try {
      await playerProfileService.addInjury(playerId, {
        injuryType: inj.injuryType.trim(),
        bodyPart: inj.bodyPart || undefined,
        severity: inj.severity,
        startDate: inj.startDate,
        note: inj.note || undefined,
      })
      setInj({ injuryType: '', bodyPart: '', severity: 'LEVE', startDate: '', note: '' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar')
    } finally {
      setSavingInj(false)
    }
  }

  if (!profile && !error) return <p className="p-8 text-center text-slate-500">Cargando expediente...</p>
  if (!profile) return <p className="p-8 text-center text-red-600">{error || 'No se pudo cargar'}</p>

  const { player, physicalLatest, technical, activeInjury } = profile
  const availability = activeInjury ? 'LESIONADO' : (physicalLatest?.availability ?? 'DISPONIBLE')
  const inputClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => navigate(`/jugadores/${playerId}`)} className="mb-4 text-sm text-slate-600 hover:underline">
        ← Volver al jugador
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-white p-6 shadow">
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold sm:text-3xl">📋 {player.fullName}</h1>
          <p className="text-sm text-slate-500">
            {player.position ?? 'Sin posición'} · {player.teamName ?? 'Sin equipo'}
            {player.heightCm ? ` · ${player.heightCm} cm` : ''}
            {player.weightKg ? ` · ${player.weightKg} kg` : ''}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            availability === 'DISPONIBLE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {AVAILABILITY_LABELS[availability] ?? availability}
        </span>
        {player.contractStatus && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {CONTRACT_LABELS[player.contractStatus] ?? player.contractStatus}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-1 text-lg font-bold">🎯 Perfil técnico (1–100)</h2>
          <p className="mb-3 text-xs text-slate-500">
            {technical.length > 0
              ? `Última evaluación: ${fmtDate(technical[0].evaluatedAt)}${technical[0].evaluator ? ` · ${technical[0].evaluator}` : ''}`
              : 'Sin valoraciones todavía. Mové los sliders y guardá.'}
          </p>
          <StatRadar data={radarData} labelA="Valoración" />
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {TECHNICAL_ATTRIBUTES.map((a) => (
              <div key={a} className="flex items-center gap-2">
                <label className="w-32 shrink-0 text-xs text-slate-600">{TECHNICAL_ATTRIBUTE_LABELS[a]}</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={draft[a] ?? 50}
                  onChange={(e) => setDraft((d) => ({ ...d, [a]: Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className="w-8 text-right text-sm font-semibold text-slate-800">{draft[a] ?? '—'}</span>
              </div>
            ))}
          </div>
          <input
            type="text"
            value={evaluator}
            onChange={(e) => setEvaluator(e.target.value)}
            placeholder="Evaluador (opcional)"
            className={`mt-3 w-full ${inputClass}`}
          />
          <button
            type="button"
            onClick={handleSaveTechnical}
            disabled={savingTech}
            className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingTech ? 'Guardando...' : 'Guardar valoración'}
          </button>
        </section>

        <div className="space-y-6">
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-bold">⚡ Perfil físico</h2>
            {physicalLatest ? (
              <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {[
                  ['Vel. máx', physicalLatest.maxSpeedKmh ? `${physicalLatest.maxSpeedKmh} km/h` : '—'],
                  ['Distancia', physicalLatest.distanceM ? `${physicalLatest.distanceM.toLocaleString()} m` : '—'],
                  ['Sprints', physicalLatest.sprints ?? '—'],
                  ['Player Load', physicalLatest.playerLoad ?? '—'],
                  ['ACWR', physicalLatest.acwr ?? '—'],
                  ['Fatiga', physicalLatest.fatigue ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-semibold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500">Sin registros físicos. Cargá el primero abajo (manual o GPS).</p>
            )}
            {evolutionData.length > 1 && (
              <div className="mb-4">
                <h3 className="mb-1 text-sm font-semibold text-slate-600">Evolución de carga</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid stroke="#e2e8f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Distancia" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Alta intensidad" stroke="#dc2626" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <form onSubmit={handleAddPhysical} className="grid grid-cols-2 gap-2">
              <input type="date" value={phys.recordedAt} onChange={(e) => setPhys({ ...phys, recordedAt: e.target.value })} className={inputClass} />
              <select value={phys.source} onChange={(e) => setPhys({ ...phys, source: e.target.value })} className={inputClass}>
                <option value="manual">Manual</option>
                <option value="gps">GPS</option>
                <option value="wearable">Wearable</option>
                <option value="imported">Importado</option>
              </select>
              <input type="number" value={phys.distanceM} onChange={(e) => setPhys({ ...phys, distanceM: e.target.value })} placeholder="Distancia (m)" className={inputClass} />
              <input type="number" value={phys.maxSpeedKmh} onChange={(e) => setPhys({ ...phys, maxSpeedKmh: e.target.value })} placeholder="Vel. máx (km/h)" className={inputClass} />
              <input type="number" value={phys.sprints} onChange={(e) => setPhys({ ...phys, sprints: e.target.value })} placeholder="Sprints" className={inputClass} />
              <input type="number" value={phys.playerLoad} onChange={(e) => setPhys({ ...phys, playerLoad: e.target.value })} placeholder="Player Load" className={inputClass} />
              <button type="submit" disabled={savingPhys} className="col-span-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                {savingPhys ? 'Registrando...' : '+ Registrar snapshot físico'}
              </button>
            </form>
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-bold">🩹 Lesiones ({profile.injuriesCount})</h2>
            {activeInjury && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                Lesión activa: <strong>{activeInjury.injuryType}</strong>
                {activeInjury.bodyPart ? ` · ${activeInjury.bodyPart}` : ''} · desde {fmtDate(activeInjury.startDate)}
              </div>
            )}
            <form onSubmit={handleAddInjury} className="mb-4 grid grid-cols-2 gap-2">
              <input type="text" value={inj.injuryType} onChange={(e) => setInj({ ...inj, injuryType: e.target.value })} placeholder="Tipo de lesión *" className={inputClass} />
              <input type="text" value={inj.bodyPart} onChange={(e) => setInj({ ...inj, bodyPart: e.target.value })} placeholder="Zona corporal" className={inputClass} />
              <select value={inj.severity} onChange={(e) => setInj({ ...inj, severity: e.target.value })} className={inputClass}>
                <option value="LEVE">Leve</option>
                <option value="MODERADA">Moderada</option>
                <option value="GRAVE">Grave</option>
              </select>
              <input type="date" value={inj.startDate} onChange={(e) => setInj({ ...inj, startDate: e.target.value })} className={inputClass} />
              <button type="submit" disabled={savingInj} className="col-span-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                {savingInj ? 'Registrando...' : '+ Registrar lesión'}
              </button>
            </form>
            <InjuryList playerId={playerId} onChanged={load} />
          </section>
        </div>
      </div>

      {/* Planilla: todo lo que el jugador hizo (trayectoria, totales, por competición, partido a
          partido). Va a lo ancho porque incluye tablas. */}
      <div className="mt-6">
        <PlayerCareerSection playerId={playerId} />
      </div>
    </div>
  )
}

function InjuryList({ playerId, onChanged }: { playerId: number; onChanged: () => void }) {
  const [injuries, setInjuries] = useState<PlayerProfile['activeInjury'][]>([])

  useEffect(() => {
    playerProfileService.listInjuries(playerId).then(setInjuries).catch(() => {})
  }, [playerId])

  if (injuries.length === 0) return <p className="text-sm text-slate-500">Sin lesiones registradas.</p>

  return (
    <ul className="divide-y divide-slate-100">
      {injuries.map((m) =>
        m ? (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium">
                {m.injuryType}{' '}
                <span className={`rounded-full px-2 py-0.5 text-xs ${m.status === 'ACTIVA' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {m.status === 'ACTIVA' ? 'Activa' : 'Recuperado'}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {fmtDate(m.startDate)} → {fmtDate(m.endDate)}{m.severity ? ` · ${m.severity}` : ''}
              </p>
            </div>
            {m.status === 'ACTIVA' && (
              <MarkRecovered playerId={playerId} injuryId={m.id} onChanged={() => {
                playerProfileService.listInjuries(playerId).then(setInjuries).catch(() => {})
                onChanged()
              }} />
            )}
          </li>
        ) : null,
      )}
    </ul>
  )
}

function MarkRecovered({ playerId, injuryId, onChanged }: { playerId: number; injuryId: number; onChanged: () => void }) {
  const [saving, setSaving] = useState(false)
  return (
    <button
      type="button"
      disabled={saving}
      onClick={async () => {
        setSaving(true)
        try {
          await playerProfileService.updateInjury(playerId, injuryId, {
            status: 'RECUPERADO',
            endDate: new Date().toISOString().slice(0, 10),
          } as never)
          onChanged()
        } finally {
          setSaving(false)
        }
      }}
      className="text-sm text-green-700 hover:underline disabled:opacity-50"
    >
      Marcar recuperado
    </button>
  )
}
