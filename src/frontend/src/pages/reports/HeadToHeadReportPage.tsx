import { useEffect, useState } from 'react'
import HeadToHeadView from '../../components/reports/HeadToHeadView'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import { api } from '../../services/api'
import type { HeadToHeadReport } from '../../types/report'
import type { Team } from '../../types/team'

// §45: reporte de enfrentamientos entre dos equipos. Mismo patrón de selector con búsqueda que ya
// usa ComparePage (EntityPicker), reimplementado acá liviano en vez de importar ese archivo entero
// -- son sólo ~15 líneas y evita acoplar Reportes a la implementación interna del Comparador.
function TeamPicker({ label, selected, onSelect }: { label: string; selected: Team | null; onSelect: (t: Team | null) => void }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Team[]>([])

  useEffect(() => {
    if (!query.trim()) return setOptions([])
    const t = setTimeout(() => {
      api.get<Team[]>(`/teams?search=${encodeURIComponent(query)}`).then(setOptions).catch(() => setOptions([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  if (selected) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-blue-900">{selected.name}</span>
          <button type="button" onClick={() => onSelect(null)} className="text-sm text-blue-600 hover:underline">
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Buscar ${label}...`}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {options.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(o)
                  setQuery('')
                  setOptions([])
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function HeadToHeadReportPage() {
  const [teamA, setTeamA] = useState<Team | null>(null)
  const [teamB, setTeamB] = useState<Team | null>(null)
  const [report, setReport] = useState<HeadToHeadReport | null>(null)

  useEffect(() => {
    if (!teamA || !teamB) return setReport(null)
    api
      .get<HeadToHeadReport>(`/reports/head-to-head?teamAId=${teamA.id}&teamBId=${teamB.id}`)
      .then(setReport)
      .catch(() => setReport(null))
  }, [teamA, teamB])

  return (
    <ReportLayout title="Enfrentamientos" subtitle="Historial completo entre dos equipos, en cualquier competición y temporada." actions={<PrintButton />}>
      {(!teamA || !teamB) && (
        <div className="no-print mb-6 grid grid-cols-1 gap-4 rounded-lg bg-white p-4 shadow sm:grid-cols-2">
          <TeamPicker label="equipo A" selected={teamA} onSelect={setTeamA} />
          <TeamPicker label="equipo B" selected={teamB} onSelect={setTeamB} />
        </div>
      )}

      {teamA && teamB && !report && <p className="text-slate-500">Cargando...</p>}

      {report && teamA && teamB && (
        <HeadToHeadView
          teamA={teamA}
          teamB={teamB}
          report={report}
          onChangeTeamA={() => setTeamA(null)}
          onChangeTeamB={() => setTeamB(null)}
          matchPath={(id) => `/reportes/partidos/${id}`}
          teamPath={(id) => `/reportes/equipos/${id}`}
        />
      )}
    </ReportLayout>
  )
}
