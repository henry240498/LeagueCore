import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CompetitionSeasonFilter from '../../components/reports/CompetitionSeasonFilter'
import { CalendarSection, CardsSection, ScorersSection } from '../../components/reports/CompetitionReportSections'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import StandingsTable from '../../components/StandingsTable'

type Tab = 'clasificacion' | 'goleadores' | 'tarjetas' | 'calendario'

// §14-17: reporte de competición con clasificación/goleadores/tarjetas/calendario. Todo reusa
// endpoints existentes (StandingsTable ya construido para Temporadas, /stats/top-scorers,
// /stats/cards-by-player, y /matches para el calendario) -- nada de esto se recalcula ni se
// duplica acá. Las tres secciones no triviales viven en components/reports/CompetitionReportSections.tsx
// para poder reusarlas tal cual desde la pestaña "Reportes" embebida en Competición → Detalle.
export default function CompetitionReportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledCompetitionId = searchParams.get('competitionId')
  const [competitionId, setCompetitionId] = useState<number | null>(prefilledCompetitionId ? Number(prefilledCompetitionId) : null)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('clasificacion')

  return (
    <ReportLayout
      title="Reporte de Competición"
      subtitle="Clasificación, goleadores, tarjetas y calendario de una competición/temporada."
      actions={<PrintButton />}
    >
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <CompetitionSeasonFilter
          competitionId={competitionId}
          seasonId={seasonId}
          onCompetitionChange={setCompetitionId}
          onSeasonChange={setSeasonId}
        />
      </div>

      {!competitionId ? (
        <p className="rounded-lg bg-white p-6 text-sm text-slate-500 shadow">Elegí una competición para ver sus reportes.</p>
      ) : (
        <>
          <div className="no-print mb-4 flex gap-2 border-b border-slate-200">
            {(['clasificacion', 'goleadores', 'tarjetas', 'calendario'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
                  tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'clasificacion' && (
            <div className="rounded-lg bg-white p-6 shadow">
              {!seasonId ? (
                <p className="text-sm text-slate-500">Elegí una temporada para ver la clasificación.</p>
              ) : (
                <StandingsTable seasonId={seasonId} />
              )}
            </div>
          )}
          {tab === 'goleadores' && <ScorersSection competitionId={competitionId} seasonId={seasonId} navigate={navigate} />}
          {tab === 'tarjetas' && <CardsSection competitionId={competitionId} seasonId={seasonId} navigate={navigate} />}
          {tab === 'calendario' && <CalendarSection competitionId={competitionId} seasonId={seasonId} navigate={navigate} />}
        </>
      )}
    </ReportLayout>
  )
}
