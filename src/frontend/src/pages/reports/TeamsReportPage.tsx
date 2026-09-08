import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import SaveReportButton from '../../components/reports/SaveReportButton'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import type { Team } from '../../types/team'

type SavedFilters = { competitionId?: number }

// §12: reporte de equipos. Reusa GET /teams (no pagina -- mismo criterio ya documentado para ese
// listado, cantidades chicas). Victorias/empates/derrotas/goles/posesión/tiros/pases/tarjetas por
// equipo existen agregados en /stats/*, pero por-EQUIPO-en-un-listado-masivo exigiría cruzar varias
// llamadas por fila -- se muestran en el Perfil de equipo (detalle), no acá, mismo criterio que
// Jugadores.
export default function TeamsReportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const savedFilters = (location.state as { savedFilters?: SavedFilters } | null)?.savedFilters
  const [competitionId, setCompetitionId] = useState<number | null>(savedFilters?.competitionId ?? null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => setCompetitions([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (competitionId) params.set('competitionId', String(competitionId))
    api
      .get<Team[]>(`/teams?${params.toString()}`)
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false))
  }, [competitionId])

  const columns: ReportColumn<Team>[] = [
    { key: 'name', label: 'Nombre', render: (t) => t.name, sortValue: (t) => t.name },
    { key: 'country', label: 'País', render: (t) => t.country ?? 'No disponible' },
    { key: 'city', label: 'Ciudad', render: (t) => t.city ?? 'No disponible' },
    { key: 'founded', label: 'Fundación', render: (t) => t.foundedYear ?? 'No disponible' },
    { key: 'manager', label: 'Entrenador', render: (t) => t.managerName ?? 'No disponible' },
    { key: 'status', label: 'Estado', render: (t) => (t.status === 'active' ? 'Activo' : 'Inactivo') },
  ]

  return (
    <ReportLayout
      title="Reporte de Equipos"
      subtitle="Click en un equipo para su perfil completo (plantilla, resultados, estadísticas)."
      actions={
        <>
          <SaveReportButton reportType="teams" filters={{ competitionId }} />
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'equipos.csv',
                teams.map((t) => ({
                  nombre: t.name,
                  pais: t.country,
                  ciudad: t.city,
                  fundacion: t.foundedYear,
                  entrenador: t.managerName,
                  estado: t.status,
                })),
                [
                  { key: 'nombre', label: 'Nombre' },
                  { key: 'pais', label: 'País' },
                  { key: 'ciudad', label: 'Ciudad' },
                  { key: 'fundacion', label: 'Fundación' },
                  { key: 'entrenador', label: 'Entrenador' },
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
          <label className="mb-1 block text-xs font-medium text-slate-600">Competición</label>
          <select
            value={competitionId ?? ''}
            onChange={(e) => setCompetitionId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <ReportTable
          columns={columns}
          rows={teams}
          getRowKey={(t) => t.id}
          onRowClick={(t) => navigate(`/reportes/equipos/${t.id}`)}
        />
      )}
    </ReportLayout>
  )
}
