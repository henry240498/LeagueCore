import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import SaveReportButton from '../../components/reports/SaveReportButton'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { PLAYER_POSITIONS, type Player, type PlayerListResponse } from '../../types/player'
import type { Team } from '../../types/team'

type SavedFilters = { teamId?: number; position?: string; status?: string; search?: string }

// §9: reporte de jugadores. Reusa GET /players (ya filtra/ordena/pagina) -- no se agregó nada al
// backend para esto. Goles/asistencias/pases/tiros/xG/xA por jugador en un LISTADO masivo no
// existen hoy como consulta agregada (sólo por jugador individual vía /stats/players/:id/summary,
// que sí se usa en el Perfil, sección siguiente) -- traerlas acá exigiría N+1 llamadas por fila, así
// que el listado muestra los campos reales de Player y linkea al Perfil para el detalle estadístico
// completo, en vez de fabricar columnas vacías o disparar cientos de pedidos por página.
export default function PlayersReportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const savedFilters = (location.state as { savedFilters?: SavedFilters } | null)?.savedFilters

  const [teamId, setTeamId] = useState<number | null>(savedFilters?.teamId ?? null)
  const [position, setPosition] = useState(savedFilters?.position ?? '')
  const [status, setStatus] = useState(savedFilters?.status ?? '')
  const [search, setSearch] = useState(savedFilters?.search ?? '')
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => setTeams([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (teamId) params.set('teamId', String(teamId))
    if (position) params.set('position', position)
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    params.set('pageSize', '500')
    api
      .get<PlayerListResponse>(`/players?${params.toString()}`)
      .then((r) => setPlayers(r.items))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false))
  }, [teamId, position, status, search])

  const columns: ReportColumn<Player>[] = [
    { key: 'name', label: 'Nombre', render: (p) => p.fullName, sortValue: (p) => p.fullName },
    { key: 'number', label: 'Número', render: (p) => p.squadNumber ?? '—', sortValue: (p) => p.squadNumber ?? 0 },
    { key: 'position', label: 'Posición', render: (p) => p.position ?? 'No disponible' },
    { key: 'team', label: 'Equipo', render: (p) => p.teamName ?? 'Sin equipo', sortValue: (p) => p.teamName ?? '' },
    { key: 'nationality', label: 'País', render: (p) => p.nationality ?? 'No disponible' },
    {
      key: 'birth',
      label: 'Fecha de nacimiento',
      render: (p) => (p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('es-PY') : 'No disponible'),
    },
    { key: 'status', label: 'Estado', render: (p) => (p.status === 'active' ? 'Activo' : 'Inactivo') },
  ]

  return (
    <ReportLayout
      title="Reporte de Jugadores"
      subtitle="Perfil de plantel con filtros por equipo, posición y estado. Click en un jugador para su perfil estadístico completo."
      actions={
        <>
          <SaveReportButton reportType="players" filters={{ teamId, position, status, search }} />
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'jugadores.csv',
                players.map((p) => ({
                  nombre: p.fullName,
                  numero: p.squadNumber,
                  posicion: p.position,
                  equipo: p.teamName,
                  pais: p.nationality,
                  nacimiento: p.dateOfBirth,
                  estado: p.status,
                })),
                [
                  { key: 'nombre', label: 'Nombre' },
                  { key: 'numero', label: 'Número' },
                  { key: 'posicion', label: 'Posición' },
                  { key: 'equipo', label: 'Equipo' },
                  { key: 'pais', label: 'País' },
                  { key: 'nacimiento', label: 'Fecha de nacimiento' },
                  { key: 'estado', label: 'Estado' },
                ],
              )
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ⬇ CSV / Excel
          </button>
          <PrintButton />
        </>
      }
    >
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre..."
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Equipo</label>
          <select
            value={teamId ?? ''}
            onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Posición</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <ReportTable
          columns={columns}
          rows={players}
          getRowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/reportes/jugadores/${p.id}`)}
        />
      )}
    </ReportLayout>
  )
}
