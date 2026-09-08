import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Avatar from '../../components/Avatar'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { AttributeCategory, VideogameRating } from '../../types/videogameRating'

// Traducción para mostrar (a.nameSource guarda el nombre TAL CUAL lo dio la fuente, en el idioma
// original -- necesario para citar la procedencia con precisión, ver Parte 15 del pedido de
// valoraciones). code es la clave estable que el motor de investigación asigna al cargar el dato;
// esta tabla traduce los códigos ya conocidos para que la interfaz siempre se vea en español, sin
// perder el nombre original de la fuente (queda disponible aparte, en la fila de origen).
const DETAILED_ATTRIBUTE_ES: Record<string, string> = {
  offensive_awareness: 'Posicionamiento ofensivo',
  finishing: 'Definición',
  kicking_power: 'Potencia de tiro',
  ball_control: 'Control de balón',
  dribbling: 'Regate',
  tight_possession: 'Protección de balón',
  balance: 'Equilibrio',
  heading: 'Cabeceo',
  jumping: 'Salto',
  defensive_awareness: 'Conciencia defensiva',
  tackling: 'Entradas',
  defensive_engagement: 'Presión defensiva',
  aggression: 'Agresividad',
  low_pass: 'Pase raso',
  lofted_pass: 'Pase elevado',
  set_piece_taking: 'Ejecución de balón parado',
  curl: 'Efecto',
  speed: 'Velocidad punta',
  acceleration: 'Aceleración',
  physical_contact: 'Contacto físico',
  stamina: 'Resistencia',
  gk_awareness: 'Colocación (portero)',
  gk_catching: 'Blocaje',
  gk_parrying: 'Rechace',
  gk_reflexes: 'Reflejos',
  gk_reach: 'Alcance',
}

const LINE_COLORS: Record<string, string> = {
  General: '#0f172a',
  PAC: '#2563eb',
  SHO: '#dc2626',
  PAS: '#16a34a',
  DRI: '#9333ea',
  DEF: '#0891b2',
  PHY: '#ea580c',
  DIV: '#2563eb',
  HAN: '#dc2626',
  KIC: '#16a34a',
  REF: '#9333ea',
  SPD: '#0891b2',
  POS: '#ea580c',
}

export default function VideogameRatingsSection({
  playerId,
  photoUrl,
  fullName,
  position,
  teamName,
  nationality,
  age,
}: {
  playerId: number
  photoUrl: string | null
  fullName: string
  position: string | null
  teamName?: string | null
  nationality?: string | null
  age?: number | null
}) {
  const [ratings, setRatings] = useState<VideogameRating[] | null>(null)
  const [selectedEditionId, setSelectedEditionId] = useState<number | null>(null)
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    api
      .get<VideogameRating[]>(`/players/${playerId}/videogame-ratings`)
      .then((data) => {
        setRatings(data)
        if (data.length > 0) setSelectedEditionId(data[data.length - 1].id)
      })
      .catch(() => setRatings([]))
  }

  useEffect(load, [playerId])

  const selected = ratings?.find((r) => r.id === selectedEditionId) ?? null

  const evolutionData = useMemo(() => {
    if (!ratings || ratings.length === 0) return []
    return ratings.map((r) => {
      const row: Record<string, number | string | null> = { edition: r.editionName, General: r.overallRating }
      for (const c of r.categories) row[c.code] = c.score ?? null
      return row
    })
  }, [ratings])

  const metricCodes = useMemo(() => {
    if (!ratings) return []
    const codes = new Set<string>()
    ratings.forEach((r) => r.categories.forEach((c) => codes.add(c.code)))
    return Array.from(codes)
  }, [ratings])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Valoraciones</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {showForm ? 'Cancelar' : '+ Agregar valoración'}
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Valoraciones históricas del jugador (velocidad, tiro, pase, regate, defensa, físico), cargadas manualmente o mediante
        investigación. Separadas de las estadísticas reales — nunca calculadas.
      </p>

      {showForm && (
        <AddRatingForm
          playerId={playerId}
          position={position}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {!ratings && <p className="text-slate-500">Cargando...</p>}
      {ratings && ratings.length === 0 && !showForm && (
        <p className="text-slate-500">NO DISPONIBLE — todavía no se cargó ninguna valoración para este jugador.</p>
      )}

      {ratings && ratings.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {ratings.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedEditionId(r.id)
                  setOpenCategory(null)
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  selectedEditionId === r.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {r.editionName}
              </button>
            ))}
          </div>

          {selected && (
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
              {/* Tarjeta visual propia de LeagueCore -- no copia el diseño de FIFA/PES */}
              <div className="rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 p-5 text-white shadow-lg">
                <div className="flex justify-center">
                  <div className="rounded-full border-4 border-amber-400">
                    <Avatar photoUrl={photoUrl} alt={fullName} size={104} />
                  </div>
                </div>
                <p className="mt-3 text-center text-sm font-medium uppercase tracking-wide text-slate-300">{fullName}</p>
                <p className="text-center text-xs text-slate-400">
                  {[selected.positionIngame ?? position, teamName, nationality, age != null ? `${age} años` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="mt-2 text-center">
                  <span className="text-5xl font-black text-amber-400">{selected.overallRating ?? '—'}</span>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Valoración general</p>
                </div>
                <p className="mt-1 text-center text-xs text-slate-400">{selected.editionName}</p>

                <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
                  {selected.categories.map((cat) => (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => setOpenCategory(openCategory === cat.code ? null : cat.code)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition ${
                        openCategory === cat.code ? 'bg-white/15' : 'hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm font-semibold tracking-wide">{cat.nameEs.toUpperCase()}</span>
                      <span className="text-lg font-bold text-amber-300">{cat.score}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {openCategory ? (
                  <DetailedAttributesPanel rating={selected} categoryCode={openCategory} />
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                    Tocá una categoría (VELOCIDAD, TIRO, PASE...) para ver sus atributos detallados.
                  </div>
                )}

                <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                  <p className="font-semibold uppercase tracking-wide text-slate-400">Fuente</p>
                  <p className="mt-1">
                    {selected.sourceName}
                    {selected.sourceUrl && (
                      <>
                        {' — '}
                        <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          ver fuente
                        </a>
                      </>
                    )}
                  </p>
                  {selected.retrievedAt && <p>Cargado: {selected.retrievedAt.slice(0, 10)}</p>}
                </div>
              </div>
            </div>
          )}

          {ratings.length > 1 && (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Evolución histórica</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={evolutionData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="edition" tick={{ fontSize: 12 }} />
                    <YAxis domain={[40, 99]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="General" stroke={LINE_COLORS.General} strokeWidth={3} dot={{ r: 3 }} />
                    {metricCodes.map((code) => (
                      <Line key={code} type="monotone" dataKey={code} stroke={LINE_COLORS[code] ?? '#94a3b8'} strokeWidth={1.5} dot={{ r: 2 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DetailedAttributesPanel({ rating, categoryCode }: { rating: VideogameRating; categoryCode: string }) {
  const category = rating.categories.find((c) => c.code === categoryCode)
  const attrs = rating.detailedAttributes.filter((a) => a.categoryCode === categoryCode)

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{category?.nameEs ?? categoryCode}</h3>
        <span className="text-2xl font-bold text-blue-600">{category?.score != null ? `${category.score}%` : '—'}</span>
      </div>
      {attrs.length === 0 ? (
        <p className="text-sm text-slate-400">Sin atributos detallados cargados para esta categoría.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {attrs.map((a) => (
            <li key={a.code} className="flex items-center justify-between border-b border-slate-100 py-1 text-sm">
              <span className="text-slate-600">{DETAILED_ATTRIBUTE_ES[a.code] ?? a.nameSource ?? a.code}</span>
              <span className="font-semibold text-slate-900">{a.value != null ? `${a.value}%` : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddRatingForm({
  playerId,
  position,
  onSaved,
  onCancel,
}: {
  playerId: number
  position: string | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [categories, setCategories] = useState<AttributeCategory[]>([])
  const [label, setLabel] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [overall, setOverall] = useState('')
  const [source, setSource] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const playerType = position === 'Portero' ? 'goalkeeper' : 'field'

  useEffect(() => {
    api
      .get<AttributeCategory[]>('/player-videogame-attribute-categories')
      .then((all) => setCategories(all.filter((c) => c.playerType === playerType)))
      .catch(() => setCategories([]))
  }, [playerType])

  const handleSubmit = async () => {
    setError('')
    if (!label.trim()) {
      setError('Ponele un nombre a esta valoración (ej. "Evaluación 2026")')
      return
    }
    setSaving(true)
    try {
      await api.post(`/players/${playerId}/videogame-ratings`, {
        videogameName: 'Valoración manual',
        editionName: label.trim(),
        editionYear: Number(year),
        overallRating: overall ? Number(overall) : undefined,
        categories: categories
          .filter((c) => values[c.code])
          .map((c) => ({ code: c.code, score: Number(values[c.code]) })),
        sourceName: source.trim() || 'Carga manual',
        sourceUrl: '',
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar la valoración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nombre de la valoración *</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Evaluación 2026"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Valoración general (%)</label>
          <input
            type="number"
            min={1}
            max={99}
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Fuente (opcional)</label>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Carga manual"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c) => (
          <div key={c.code}>
            <label className="mb-1 block text-xs font-medium text-slate-600">{c.nameEs} (%)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={values[c.code] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [c.code]: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar valoración'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
