import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ChangePasswordFirstLoginPage from './pages/ChangePasswordFirstLoginPage'
import ComparePage from './pages/ComparePage'
import CompetitionDetailPage from './pages/competitions/CompetitionDetailPage'
import CompetitionFormPage from './pages/competitions/CompetitionFormPage'
import CompetitionsListPage from './pages/competitions/CompetitionsListPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import MatchDetailPage from './pages/matches/MatchDetailPage'
import MatchFormPage from './pages/matches/MatchFormPage'
import MatchesListPage from './pages/matches/MatchesListPage'
import OfficialDetailPage from './pages/officials/OfficialDetailPage'
import OfficialFormPage from './pages/officials/OfficialFormPage'
import OfficialsListPage from './pages/officials/OfficialsListPage'
import OfficialTypesPage from './pages/officials/OfficialTypesPage'
import ParametersPage from './pages/parameters/ParametersPage'
import PlayerDetailPage from './pages/players/PlayerDetailPage'
import PlayerFormPage from './pages/players/PlayerFormPage'
import PlayersListPage from './pages/players/PlayersListPage'
import ProfilePage from './pages/ProfilePage'
import AuditReportPage from './pages/reports/AuditReportPage'
import CompetitionReportPage from './pages/reports/CompetitionReportPage'
import HeadToHeadReportPage from './pages/reports/HeadToHeadReportPage'
import InvestigacionReportPage from './pages/reports/InvestigacionReportPage'
import MatchDetailReportPage from './pages/reports/MatchDetailReportPage'
import MatchesReportPage from './pages/reports/MatchesReportPage'
import PlayerProfileReportPage from './pages/reports/PlayerProfileReportPage'
import PlayersReportPage from './pages/reports/PlayersReportPage'
import RefereesReportPage from './pages/reports/RefereesReportPage'
import ReportsHubPage from './pages/reports/ReportsHubPage'
import TeamProfileReportPage from './pages/reports/TeamProfileReportPage'
import TeamsReportPage from './pages/reports/TeamsReportPage'
import VenuesReportPage from './pages/reports/VenuesReportPage'
import SeasonDetailPage from './pages/seasons/SeasonDetailPage'
import SeasonFormPage from './pages/seasons/SeasonFormPage'
import SeasonsListPage from './pages/seasons/SeasonsListPage'
import SecurityPage from './pages/SecurityPage'
import StatisticsPage from './pages/StatisticsPage'
import TeamDetailPage from './pages/teams/TeamDetailPage'
import TeamFormPage from './pages/teams/TeamFormPage'
import TeamsListPage from './pages/teams/TeamsListPage'
import VenueDetailPage from './pages/venues/VenueDetailPage'
import VenueFormPage from './pages/venues/VenueFormPage'
import VenuesListPage from './pages/venues/VenuesListPage'

function App() {
  return (
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

          <Route path="/temporadas" element={<SeasonsListPage />} />
          <Route path="/temporadas/nueva" element={<SeasonFormPage />} />
          <Route path="/temporadas/:id" element={<SeasonDetailPage />} />
          <Route path="/temporadas/:id/editar" element={<SeasonFormPage />} />

          <Route path="/equipos" element={<TeamsListPage />} />
          <Route path="/equipos/nuevo" element={<TeamFormPage />} />
          <Route path="/equipos/:id" element={<TeamDetailPage />} />
          <Route path="/equipos/:id/editar" element={<TeamFormPage />} />

          <Route path="/jugadores" element={<PlayersListPage />} />
          <Route path="/jugadores/nuevo" element={<PlayerFormPage />} />
          <Route path="/jugadores/:id" element={<PlayerDetailPage />} />
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
          <Route path="/partidos/:id/editar" element={<MatchFormPage />} />

          <Route path="/estadisticas" element={<StatisticsPage />} />

          <Route path="/reportes" element={<ReportsHubPage />} />
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
  )
}

export default App
