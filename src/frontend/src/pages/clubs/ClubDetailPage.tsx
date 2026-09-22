import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import { clubsService } from '../../services/clubs'
import {
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  TEAM_CATEGORIES,
  TEAM_CATEGORY_LABELS,
  type Club,
  type ClubStaff,
  type ClubTeam,
  type StaffRole,
  type TeamCategory,
} from '../../types/club'
import type { Team } from '../../types/team'

export default function ClubDetailPage() {
  const { id } = useParams()
  const clubId = Number(id)
  const navigate = useNavigate()
  const [club, setClub] = useState<Club | null>(null)
  const [teams, setTeams] = useState<ClubTeam[]>([])
  const [staff, setStaff] = useState<ClubStaff[]>([])
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [error, setError] = useState('')
  const [linkTeamId, setLinkTeamId] = useState('')
  const [linkCategory, setLinkCategory] = useState<TeamCategory>('PRIMERA')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState<StaffRole>('DT')
  const [staffCategory, setStaffCategory] = useState('')

  const load = useCallback(() => {
    clubsService
      .getById(clubId)
      .then(setClub)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el club'))
    clubsService.getTeams(clubId).then(setTeams).catch(() => {})
    clubsService.getStaff(clubId).then(setStaff).catch(() => {})
    api.get<Team[]>('/teams').then(setAllTeams).catch(() => {})
  }, [clubId])

  useEffect(() => {
    load()
  }, [load])

  const handleLink = async () => {
    if (!linkTeamId) return
    try {
      const updated = await clubsService.linkTeam(clubId, Number(linkTeamId), linkCategory)
      setTeams(updated)
      setLinkTeamId('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al vincular equipo')
    }
  }

  const handleUnlink = async (teamId: number) => {
    if (!window.confirm('¿Desvincular este equipo del club?')) return
    try {
      const updated = await clubsService.unlinkTeam(clubId, teamId)
      setTeams(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al desvincular')
    }
  }

  const handleAddStaff = async () => {
    if (!staffName.trim()) return
    try {
      const created = await clubsService.addStaff(clubId, {
        fullName: staffName.trim(),
        role: staffRole,
        teamCategory: (staffCategory || undefined) as TeamCategory | undefined,
      })
      setStaff((s) => [...s, created])
      setStaffName('')
      setStaffCategory('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al agregar staff')
    }
  }

  const handleRemoveStaff = async (staffId: number) => {
    if (!window.confirm('¿Eliminar este miembro del staff?')) return
    try {
      await clubsService.removeStaff(clubId, staffId)
      setStaff((s) => s.filter((m) => m.id !== staffId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  if (!club && !error) return <p className="p-8 text-center text-slate-500">Cargando...</p>
  if (!club) return <p className="p-8 text-center text-red-600">{error || 'Club no encontrado'}</p>

  const unlinked = allTeams.filter((t) => !teams.some((ct) => ct.id === t.id))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => navigate('/clubes')} className="mb-4 text-sm text-slate-600 hover:underline">
        ← Volver a clubes
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div
        className="mb-6 rounded-lg bg-white p-6 shadow"
        style={
          club.primaryColor
            ? { borderTop: `6px solid ${club.primaryColor}` }
            : undefined
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {club.logoUrl ? (
              <img src={club.logoUrl} alt={`Escudo de ${club.name}`} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-200 text-2xl" aria-hidden>🏟️</div>
            )}
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{club.name}</h1>
              <p className="text-sm text-slate-500">
                {[club.city, club.country].filter(Boolean).join(', ')}
                {club.foundedYear ? ` · Desde ${club.foundedYear}` : ''}
                {club.shortName ? ` · ${club.shortName}` : ''}
              </p>
              {(club.primaryColor || club.secondaryColor) && (
                <div className="mt-2 flex items-center gap-2">
                  {club.primaryColor && (
                    <span
                      className="inline-block h-5 w-8 rounded border border-slate-300"
                      style={{ backgroundColor: club.primaryColor }}
                      title={club.primaryColor}
                    />
                  )}
                  {club.secondaryColor && (
                    <span
                      className="inline-block h-5 w-8 rounded border border-slate-300"
                      style={{ backgroundColor: club.secondaryColor }}
                      title={club.secondaryColor}
                    />
                  )}
                  <span className="text-xs text-slate-500">Identidad visual</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/clubes/${club.id}/editar`)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ✏️ Editar club
          </button>
        </div>
        {club.history && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Historial</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{club.history}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">⚽ Equipos del club ({teams.length})</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              value={linkTeamId}
              onChange={(e) => setLinkTeamId(e.target.value)}
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Vincular equipo existente...</option>
              {unlinked.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={linkCategory}
              onChange={(e) => setLinkCategory(e.target.value as TeamCategory)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {TEAM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TEAM_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLink}
              disabled={!linkTeamId}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Vincular
            </button>
          </div>
          {teams.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sin equipos vinculados. Vincula la Primera, Reserva, Sub-20, Femenino, etc.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {teams.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate(`/equipos/${t.id}`)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {t.name}
                    </button>
                    <p className="text-xs text-slate-500">
                      {t.category ? TEAM_CATEGORY_LABELS[t.category] : 'Sin categoría'} · {t.playersCount} jugadores
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlink(t.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Desvincular
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">🧑‍💼 Cuerpo técnico y staff ({staff.length})</h2>
          <div className="mb-4 grid gap-2">
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Nombre y apellido..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <select
                value={staffCategory}
                onChange={(e) => setStaffCategory(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todo el club</option>
                {TEAM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TEAM_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddStaff}
                disabled={!staffName.trim()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          </div>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500">Sin staff cargado: DT, PF, médico, analistas, scouts...</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {staff.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{m.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {STAFF_ROLE_LABELS[m.role]}
                      {m.teamCategory ? ` · ${TEAM_CATEGORY_LABELS[m.teamCategory]}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStaff(m.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
