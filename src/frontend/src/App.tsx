import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'

// FASE 15 — code-splitting a nivel de rutas: cada página se carga bajo demanda (chunk propio),
// para que el bundle inicial deje de incluir toda la app. Layout, guard y login quedan eager
// (se necesitan en el primer render). El <Suspense> de abajo cubre la carga de cada página.
const ChangePasswordFirstLoginPage = lazy(() => import('./pages/ChangePasswordFirstLoginPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const ClubDetailPage = lazy(() => import('./pages/clubs/ClubDetailPage'))
const ClubFormPage = lazy(() => import('./pages/clubs/ClubFormPage'))
const ClubsListPage = lazy(() => import('./pages/clubs/ClubsListPage'))
const CompetitionDetailPage = lazy(() => import('./pages/competitions/CompetitionDetailPage'))
const CompetitionFormPage = lazy(() => import('./pages/competitions/CompetitionFormPage'))
const CompetitionsListPage = lazy(() => import('./pages/competitions/CompetitionsListPage'))
const InformalTournamentsListPage = lazy(() => import('./pages/informal-tournaments/InformalTournamentsListPage'))
const InformalTournamentFormPage = lazy(() => import('./pages/informal-tournaments/InformalTournamentFormPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MatchDetailPage = lazy(() => import('./pages/matches/MatchDetailPage'))
const MatchFormPage = lazy(() => import('./pages/matches/MatchFormPage'))
const LiveMatchPage = lazy(() => import('./pages/matches/LiveMatchPage'))
const MatchesListPage = lazy(() => import('./pages/matches/MatchesListPage'))
const OfficialDetailPage = lazy(() => import('./pages/officials/OfficialDetailPage'))
const OfficialFormPage = lazy(() => import('./pages/officials/OfficialFormPage'))
const OfficialsListPage = lazy(() => import('./pages/officials/OfficialsListPage'))
const OfficialTypesPage = lazy(() => import('./pages/officials/OfficialTypesPage'))
const ParametersPage = lazy(() => import('./pages/parameters/ParametersPage'))
const PlayerDetailPage = lazy(() => import('./pages/players/PlayerDetailPage'))
const PlayerFormPage = lazy(() => import('./pages/players/PlayerFormPage'))
const PlayerProfilePage = lazy(() => import('./pages/players/PlayerProfilePage'))
const PlayersListPage = lazy(() => import('./pages/players/PlayersListPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AuditReportPage = lazy(() => import('./pages/reports/AuditReportPage'))
const CompetitionReportPage = lazy(() => import('./pages/reports/CompetitionReportPage'))
const HeadToHeadReportPage = lazy(() => import('./pages/reports/HeadToHeadReportPage'))
const InvestigacionReportPage = lazy(() => import('./pages/reports/InvestigacionReportPage'))
const MatchDetailReportPage = lazy(() => import('./pages/reports/MatchDetailReportPage'))
const MatchesReportPage = lazy(() => import('./pages/reports/MatchesReportPage'))
const PlayerProfileReportPage = lazy(() => import('./pages/reports/PlayerProfileReportPage'))
const PlayersReportPage = lazy(() => import('./pages/reports/PlayersReportPage'))
const RefereesReportPage = lazy(() => import('./pages/reports/RefereesReportPage'))
const ReportsHubPage = lazy(() => import('./pages/reports/ReportsHubPage'))
const ReportBuilderPage = lazy(() => import('./pages/reports/ReportBuilderPage'))
const TeamProfileReportPage = lazy(() => import('./pages/reports/TeamProfileReportPage'))
const TeamsReportPage = lazy(() => import('./pages/reports/TeamsReportPage'))
const VenuesReportPage = lazy(() => import('./pages/reports/VenuesReportPage'))
const SeasonDetailPage = lazy(() => import('./pages/seasons/SeasonDetailPage'))
const SeasonFormPage = lazy(() => import('./pages/seasons/SeasonFormPage'))
const SeasonsListPage = lazy(() => import('./pages/seasons/SeasonsListPage'))
const SecurityPage = lazy(() => import('./pages/SecurityPage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))
const MetricsPage = lazy(() => import('./pages/tactics/MetricsPage'))
const PlaysLibraryPage = lazy(() => import('./pages/tactics/PlaysLibraryPage'))
const PlayersScoutingPage = lazy(() => import('./pages/scouting/PlayersScoutingPage'))
const RivalsPage = lazy(() => import('./pages/scouting/RivalsPage'))
const WatchlistPage = lazy(() => import('./pages/scouting/WatchlistPage'))
const OperationsPage = lazy(() => import('./pages/operations/OperationsPage'))
const TrainingsPage = lazy(() => import('./pages/trainings/TrainingsPage'))
const AssistantPage = lazy(() => import('./pages/assistant/AssistantPage'))
const TeamDetailPage = lazy(() => import('./pages/teams/TeamDetailPage'))
const TeamFormPage = lazy(() => import('./pages/teams/TeamFormPage'))
const TeamsListPage = lazy(() => import('./pages/teams/TeamsListPage'))
const VenueDetailPage = lazy(() => import('./pages/venues/VenueDetailPage'))
const VenueFormPage = lazy(() => import('./pages/venues/VenueFormPage'))
const VenuesListPage = lazy(() => import('./pages/venues/VenuesListPage'))

function App() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Cargando…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-contrasena" element={<ChangePasswordFirstLoginPage />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/seguridad" element={<SecurityPage />} />

            <Route path="/competiciones" element={<CompetitionsListPage />} />
            <Route path="/competiciones/nueva" element={<CompetitionFormPage />} />
            <Route path="/competiciones/:id" element={<CompetitionDetailPage />} />
            <Route path="/competiciones/:id/editar" element={<CompetitionFormPage />} />

            <Route path="/torneos" element={<InformalTournamentsListPage />} />
            <Route path="/torneos/nuevo" element={<InformalTournamentFormPage />} />
            <Route path="/torneos/:id/editar" element={<InformalTournamentFormPage />} />

            <Route path="/temporadas" element={<SeasonsListPage />} />
            <Route path="/temporadas/nueva" element={<SeasonFormPage />} />
            <Route path="/temporadas/:id" element={<SeasonDetailPage />} />
            <Route path="/temporadas/:id/editar" element={<SeasonFormPage />} />

            <Route path="/equipos" element={<TeamsListPage />} />
            <Route path="/equipos/nuevo" element={<TeamFormPage />} />
            <Route path="/equipos/:id" element={<TeamDetailPage />} />
            <Route path="/equipos/:id/editar" element={<TeamFormPage />} />

            <Route path="/clubes" element={<ClubsListPage />} />
            <Route path="/clubes/nuevo" element={<ClubFormPage />} />
            <Route path="/clubes/:id" element={<ClubDetailPage />} />
            <Route path="/clubes/:id/editar" element={<ClubFormPage />} />

            <Route path="/jugadores" element={<PlayersListPage />} />
            <Route path="/jugadores/nuevo" element={<PlayerFormPage />} />
            <Route path="/jugadores/:id" element={<PlayerDetailPage />} />
            <Route path="/jugadores/:id/expediente" element={<PlayerProfilePage />} />
            <Route path="/jugadores/:id/editar" element={<PlayerFormPage />} />

            <Route path="/oficiales" element={<OfficialsListPage />} />
            <Route path="/oficiales/tipos" element={<OfficialTypesPage />} />
            <Route path="/oficiales/nuevo" element={<OfficialFormPage />} />
            <Route path="/oficiales/:id" element={<OfficialDetailPage />} />
            <Route path="/oficiales/:id/editar" element={<OfficialFormPage />} />

            <Route path="/estadios" element={<VenuesListPage />} />
            <Route path="/estadios/nuevo" element={<VenueFormPage />} />
            <Route path="/estadios/:id" element={<VenueDetailPage />} />
            <Route path="/estadios/:id/editar" element={<VenueFormPage />} />

            <Route path="/partidos" element={<MatchesListPage />} />
            <Route path="/partidos/nuevo" element={<MatchFormPage />} />
            <Route path="/partidos/:id" element={<MatchDetailPage />} />
            <Route path="/partidos/:id/live" element={<LiveMatchPage />} />
            <Route path="/partidos/:id/editar" element={<MatchFormPage />} />

            <Route path="/estadisticas" element={<StatisticsPage />} />

            <Route path="/jugadas" element={<PlaysLibraryPage />} />
            <Route path="/metricas" element={<MetricsPage />} />

            <Route path="/scouting/rivales" element={<RivalsPage />} />
            <Route path="/scouting/jugadores" element={<PlayersScoutingPage />} />
            <Route path="/scouting/seguimiento" element={<WatchlistPage />} />

            <Route path="/entrenamientos" element={<TrainingsPage />} />
            <Route path="/operativa" element={<OperationsPage />} />
            <Route path="/asistente" element={<AssistantPage />} />

            <Route path="/reportes" element={<ReportsHubPage />} />
            <Route path="/reportes/plantillas" element={<ReportBuilderPage />} />
            <Route path="/reportes/partidos" element={<MatchesReportPage />} />
            <Route path="/reportes/partidos/:id" element={<MatchDetailReportPage />} />
            <Route path="/reportes/jugadores" element={<PlayersReportPage />} />
            <Route path="/reportes/jugadores/:id" element={<PlayerProfileReportPage />} />
            <Route path="/reportes/equipos" element={<TeamsReportPage />} />
            <Route path="/reportes/equipos/:id" element={<TeamProfileReportPage />} />
            <Route path="/reportes/competiciones" element={<CompetitionReportPage />} />
            <Route path="/reportes/arbitros" element={<RefereesReportPage />} />
            <Route path="/reportes/estadios" element={<VenuesReportPage />} />
            <Route path="/reportes/enfrentamientos" element={<HeadToHeadReportPage />} />
            <Route path="/reportes/investigacion" element={<InvestigacionReportPage />} />
            <Route path="/reportes/auditoria" element={<AuditReportPage />} />

            <Route path="/parametrizaciones" element={<ParametersPage />} />
            <Route path="/comparador" element={<ComparePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
