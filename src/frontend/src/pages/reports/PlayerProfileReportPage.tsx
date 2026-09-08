import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { api } from '../../services/api'
import type { Player } from '../../types/player'

type PlayerSummary = { matchesPlayed: number; goals: number; assists: number; yellowCards: number; redCards: number }

// §10: perfil estadístico completo de un jugador. Reusa /players/:id y /stats/players/:id/summary
// (los mismos que ya usa el Comparador) -- lo único que hoy existe de verdad es partidos/goles/
// asistencias/tarjetas. Pases/tiros/duelos/defensa/xG/xA/heatmap/recorrido NO se calculan en ningún
// lugar del sistema todavía (no hay tracking posicional ni datos de pases por jugador cargados), así
// que se muestran explícitamente como "No disponible" en vez de inventar un cero.
export default function PlayerProfileReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const playerId = Number(id)
  const [player, setPlayer] = useState<Player | null>(null)
  const [summary, setSummary] = useState<PlayerSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get<Player>(`/players/${playerId}`), api.get<PlayerSummary>(`/stats/players/${playerId}/summary`)])
      .then(([p, s]) => {
        setPlayer(p)
        setSummary(s)
      })
      .catch(() => setError('No se pudo cargar el jugador'))
  }, [playerId])

  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!player || !summary) return <p className="p-6 text-slate-500">Cargando...</p>

  return (
    <ReportLayout
      title={`Perfil estadístico — ${player.fullName}`}
      subtitle={player.teamName ? `${player.teamName} · ${player.position ?? 'Sin posición'}` : player.position ?? ''}
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate('/reportes/jugadores')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Volver
          </button>
          <button
            type="button"
            onClick={() => navigate(`/jugadores/${playerId}`)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Ver ficha completa
          </button>
          <PrintButton />
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-lg bg-white p-6 shadow">
          {player.photoUrl ? (
            <img src={resolveAssetUrl(player.photoUrl)} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-2xl">👤</div>
          )}
          <div>
            <p className="text-xl font-bold text-slate-900">{player.fullName}</p>
            <p className="text-sm text-slate-500">
              {player.teamName ?? 'Sin equipo'} · {player.position ?? 'No disponible'}
              {player.squadNumber != null ? ` · #${player.squadNumber}` : ''}
            </p>
            <p className="text-xs text-slate-400">
              {player.nationality ?? 'Nacionalidad no disponible'} ·{' '}
              {player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString('es-PY') : 'Fecha de nacimiento no disponible'}
            </p>
          </div>
        </div>

        <StatGroup title="Partidos">
          <Stat label="Jugados" value={summary.matchesPlayed} />
          <Stat label="Titularidades" na />
          <Stat label="Suplencias" na />
        </StatGroup>

        <StatGroup title="Goles y asistencias">
          <Stat label="Goles" value={summary.goals} />
          <Stat label="Asistencias" value={summary.assists} />
        </StatGroup>

        <StatGroup title="Pases">
          <Stat label="Totales" na />
          <Stat label="Completados" na />
          <Stat label="Clave" na />
        </StatGroup>

        <StatGroup title="Tiros">
          <Stat label="Totales" na />
          <Stat label="A puerta" na />
          <Stat label="Al palo" na />
        </StatGroup>

        <StatGroup title="Defensa">
          <Stat label="Tackles" na />
          <Stat label="Intercepciones" na />
          <Stat label="Despejes" na />
        </StatGroup>

        <StatGroup title="Disciplina">
          <Stat label="Amarillas" value={summary.yellowCards} />
          <Stat label="Rojas" value={summary.redCards} />
        </StatGroup>

        <StatGroup title="Métricas avanzadas">
          <Stat label="xG" na />
          <Stat label="xA" na />
          <Stat label="PPDA" na />
        </StatGroup>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Heatmap, posición media, recorrido y mapa de pases requieren datos de posicionamiento por
          jugador que LeagueCore no calcula todavía — no se muestran para no inventar información.
          El mapa de tiros sí existe a nivel de partido individual (pestaña "Vista táctica" del
          reporte de cada partido).
        </div>
      </div>
    </ReportLayout>
  )
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow print:break-inside-avoid">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</div>
    </div>
  )
}

function Stat({ label, value, na }: { label: string; value?: number; na?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${na ? 'text-slate-400' : 'text-slate-900'}`}>{na ? 'No disponible' : value}</p>
    </div>
  )
}
