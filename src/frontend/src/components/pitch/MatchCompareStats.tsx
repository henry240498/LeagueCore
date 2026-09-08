import { useEffect, useState } from 'react'
import StatBars, { type StatBarRow } from '../stats/StatBars'
import { api } from '../../services/api'
import type { Match, MatchTeamStats } from '../../types/match'

const COMPARE_FIELDS: { key: keyof MatchTeamStats; label: string }[] = [
  { key: 'possessionPct', label: 'Posesión (%)' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'corners', label: 'Córners' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'passes', label: 'Pases' },
  { key: 'passesCompleted', label: 'Pases completados' },
]

// Comparación visual real: usa /matches/:id/team-stats, el mismo endpoint que ya existe para la
// carga manual -- acá sólo se muestra en modo lectura, vía el primitivo genérico StatBars. Si no
// hay ninguna estadística cargada para el partido, se dice explícitamente: nunca se inventan
// valores para "rellenar" el gráfico.
export default function MatchCompareStats({ match }: { match: Match }) {
  const [stats, setStats] = useState<MatchTeamStats[] | null>(null)

  useEffect(() => {
    api
      .get<MatchTeamStats[]>(`/matches/${match.id}/team-stats`)
      .then(setStats)
      .catch(() => setStats([]))
  }, [match.id])

  if (!stats) return <p className="text-slate-500">Cargando...</p>

  const home = stats.find((s) => s.teamId === match.homeTeamId)
  const away = stats.find((s) => s.teamId === match.awayTeamId)
  const rows: StatBarRow[] = COMPARE_FIELDS.filter((f) => home?.[f.key] != null || away?.[f.key] != null).map((f) => ({
    key: f.key,
    label: f.label,
    a: (home?.[f.key] as number | null) ?? null,
    b: (away?.[f.key] as number | null) ?? null,
  }))

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      {rows.length === 0 ? (
        <p className="text-center text-slate-500">
          Estadísticas de equipo no disponibles para este partido todavía. Se pueden cargar desde la pestaña "Estadísticas".
        </p>
      ) : (
        <StatBars rows={rows} labelA={match.homeTeamName ?? 'Local'} labelB={match.awayTeamName ?? 'Visitante'} />
      )}
    </div>
  )
}
