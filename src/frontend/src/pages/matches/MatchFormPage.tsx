import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import type { DuplicateMatch, Match, MatchInput, MatchStatus } from '../../types/match'
import { MATCH_STATUSES, MATCH_STATUS_LABELS, PITCH_CONDITIONS, WEATHER_CONDITIONS } from '../../types/match'
import type { Season } from '../../types/season'
import type { Team } from '../../types/team'
import type { Venue } from '../../types/match'

type FormState = {
  competitionId: number | ''
  seasonId: number | ''
  homeTeamId: number | ''
  awayTeamId: number | ''
  matchDate: string
  matchTime: string
  venueId: number | ''
  status: MatchStatus
  attendance: string
  round: string
  phase: string
  groupName: string
  leg: string
  weatherCondition: string
  temperatureCelsius: string
  pitchCondition: string
  comments: string
}

const EMPTY_FORM: FormState = {
  competitionId: '',
  seasonId: '',
  homeTeamId: '',
  awayTeamId: '',
  matchDate: '',
  matchTime: '',
  venueId: '',
  status: 'scheduled',
  attendance: '',
  round: '',
  phase: '',
  groupName: '',
  leg: '',
  weatherCondition: '',
  temperatureCelsius: '',
  pitchCondition: '',
  comments: '',
}

export default function MatchFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    competitionId: Number(searchParams.get('competitionId')) || '',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newVenueName, setNewVenueName] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const skipDuplicateCheck = useRef(isEdit)

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => {})
    api.get<Venue[]>('/venues').then(setVenues).catch(() => {})
    // Un equipo es una entidad independiente de la competición (corrección arquitectónica): la
    // lista de equipos para elegir local/visitante es global, no se filtra por competición ni
    // temporada. Al guardar el partido, el equipo elegido se vincula automáticamente a la
    // temporada (season_teams) si todavía no participaba en ella.
    api.get<Team[]>('/teams').then(setTeams).catch(() => setTeams([]))
  }, [])

  useEffect(() => {
    if (!form.competitionId) {
      setSeasons([])
      return
    }
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${form.competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [form.competitionId])

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Match>(`/matches/${id}`)
      .then((m) => {
        setForm({
          competitionId: m.competitionId,
          seasonId: m.seasonId,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          matchDate: m.matchDate.slice(0, 10),
          matchTime: m.matchTime ? m.matchTime.slice(11, 16) : '',
          venueId: m.venueId ?? '',
          status: m.status,
          attendance: m.attendance?.toString() ?? '',
          round: m.round ?? '',
          phase: m.phase ?? '',
          groupName: m.groupName ?? '',
          leg: m.leg ?? '',
          weatherCondition: m.weatherCondition ?? '',
          temperatureCelsius: m.temperatureCelsius?.toString() ?? '',
          pitchCondition: m.pitchCondition ?? '',
          comments: m.comments ?? '',
        })
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el partido'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  useEffect(() => {
    if (skipDuplicateCheck.current) return
    if (!form.competitionId || !form.homeTeamId || !form.awayTeamId || !form.matchDate) {
      setDuplicates([])
      return
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        competitionId: String(form.competitionId),
        homeTeamId: String(form.homeTeamId),
        awayTeamId: String(form.awayTeamId),
        matchDate: form.matchDate,
      })
      api
        .get<DuplicateMatch[]>(`/matches/check-duplicates?${params.toString()}`)
        .then(setDuplicates)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.competitionId, form.homeTeamId, form.awayTeamId, form.matchDate])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const handleCreateVenue = async () => {
    if (!newVenueName.trim()) return
    try {
      const venue = await api.post<Venue>('/venues', { name: newVenueName.trim() })
      setVenues((v) => [...v, venue])
      set('venueId', venue.id)
      setNewVenueName('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el estadio')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.competitionId || !form.seasonId || !form.homeTeamId || !form.awayTeamId || !form.matchDate) {
      setError('Completá competición, temporada, equipos y fecha')
      return
    }
    if (form.homeTeamId === form.awayTeamId) {
      setError('El equipo local y el visitante no pueden ser el mismo')
      return
    }

    if (
      !isEdit &&
      duplicates.length > 0 &&
      !window.confirm(
        `⚠ Ya existe(n) ${duplicates.length} partido(s) entre estos equipos, en esta competición, en esta fecha:\n\n` +
          duplicates.map((d) => `• ${d.homeTeamName} vs ${d.awayTeamName}${d.round ? ` (${d.round})` : ''}`).join('\n') +
          '\n\nPuede ser ida/vuelta, un desempate u otra fase. ¿Confirmás que querés crear este partido de todas formas?',
      )
    ) {
      return
    }

    setSaving(true)
    try {
      const payload: MatchInput = {
        competitionId: Number(form.competitionId),
        seasonId: Number(form.seasonId),
        homeTeamId: Number(form.homeTeamId),
        awayTeamId: Number(form.awayTeamId),
        matchDate: form.matchDate,
        matchTime: form.matchTime || null,
        venueId: form.venueId ? Number(form.venueId) : null,
        status: form.status,
        attendance: form.attendance ? Number(form.attendance) : null,
        round: form.round || null,
        phase: form.phase || null,
        groupName: form.groupName || null,
        leg: form.leg || null,
        weatherCondition: form.weatherCondition || null,
        temperatureCelsius: form.temperatureCelsius ? Number(form.temperatureCelsius) : null,
        pitchCondition: form.pitchCondition || null,
        comments: form.comments || null,
      }

      let match: Match
      if (isEdit) {
        match = await api.put<Match>(`/matches/${id}`, payload)
      } else {
        match = await api.post<Match>('/matches', payload)
      }
      navigate(`/partidos/${match.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar el partido')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? 'Editar partido' : 'Nuevo partido'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Competición y equipos">
          <SelectField
            label="Competición *"
            value={form.competitionId}
            onChange={(v) => setForm((f) => ({ ...f, competitionId: v ? Number(v) : '', seasonId: '' }))}
            options={competitions.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Elegir competición..."
          />
          <SelectField
            label="Temporada *"
            value={form.seasonId}
            onChange={(v) => set('seasonId', v ? Number(v) : '')}
            options={seasons.map((s) => ({ value: s.id, label: s.label }))}
            placeholder={form.competitionId ? 'Elegir temporada...' : 'Elegí una competición primero'}
            disabled={!form.competitionId}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Equipo local *"
              value={form.homeTeamId}
              onChange={(v) => set('homeTeamId', v ? Number(v) : '')}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Elegir equipo..."
            />
            <SelectField
              label="Equipo visitante *"
              value={form.awayTeamId}
              onChange={(v) => set('awayTeamId', v ? Number(v) : '')}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Elegir equipo..."
            />
          </div>

          {!isEdit && duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="mb-2 font-medium">⚠ Ya existe un partido similar</p>
              <ul className="mb-2 list-inside list-disc">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a href={`/partidos/${d.id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                      {d.homeTeamName} vs {d.awayTeamName}
                    </a>
                    {d.round ? ` — ${d.round}` : ''}
                  </li>
                ))}
              </ul>
              <p>Puede ser ida/vuelta o una fase distinta — revisá antes de confirmar la creación.</p>
            </div>
          )}
        </Section>

        <Section title="Información general">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha *" type="date" value={form.matchDate} onChange={(v) => set('matchDate', v)} required />
            <Field label="Hora" type="time" value={form.matchTime} onChange={(v) => set('matchTime', v)} />
          </div>

          <div>
            <label htmlFor="match-venue" className="mb-1 block text-sm font-medium text-slate-700">
              Estadio
            </label>
            <div className="flex gap-2">
              <select
                id="match-venue"
                value={form.venueId}
                onChange={(e) => set('venueId', e.target.value ? Number(e.target.value) : '')}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sin especificar —</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.city ? ` (${v.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                placeholder="Nombre de un estadio nuevo..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCreateVenue}
                disabled={!newVenueName.trim()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                + Crear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Asistencia (espectadores)" type="number" value={form.attendance} onChange={(v) => set('attendance', v)} />
            <div>
              <label htmlFor="match-status" className="mb-1 block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                id="match-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as MatchStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {MATCH_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Jornada / ronda" value={form.round} onChange={(v) => set('round', v)} placeholder="ej. Jornada 5" />
            <Field label="Fase" value={form.phase} onChange={(v) => set('phase', v)} placeholder="ej. Cuartos de final" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Grupo" value={form.groupName} onChange={(v) => set('groupName', v)} placeholder="ej. Grupo A" />
            <div>
              <label htmlFor="match-leg" className="mb-1 block text-sm font-medium text-slate-700">
                Ida / Vuelta
              </label>
              <select
                id="match-leg"
                value={form.leg}
                onChange={(e) => set('leg', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No aplica —</option>
                <option value="ida">Ida</option>
                <option value="vuelta">Vuelta</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Clima y terreno">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Clima"
              value={form.weatherCondition}
              onChange={(v) => set('weatherCondition', String(v))}
              options={WEATHER_CONDITIONS.map((w) => ({ value: w, label: w }))}
              placeholder="— Sin especificar —"
            />
            <Field
              label="Temperatura (°C)"
              type="number"
              value={form.temperatureCelsius}
              onChange={(v) => set('temperatureCelsius', v)}
            />
          </div>
          <SelectField
            label="Estado del césped"
            value={form.pitchCondition}
            onChange={(v) => set('pitchCondition', String(v))}
            options={PITCH_CONDITIONS.map((p) => ({ value: p, label: p }))}
            placeholder="— Sin especificar —"
          />
        </Section>

        <Section title="Observaciones">
          <textarea
            value={form.comments}
            onChange={(e) => set('comments', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-6 py-2 font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  const id = `match-field-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  options: { value: string | number; label: string }[]
  placeholder: string
  disabled?: boolean
}) {
  const id = `match-select-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
