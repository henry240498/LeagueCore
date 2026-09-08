import { useNavigate } from 'react-router-dom'
import { resolveAssetUrl } from '../../lib/assetUrl'
import type { MatchLineupEntry } from '../../types/match'

// Tarjeta de jugador (concepto tomado de las imágenes de referencia del pedido -- foto + nombre +
// posición + país + stats, nunca un rating de habilidad inventado: LeagueCore no tiene ningún campo
// de rating, así que acá sólo se muestran datos reales del partido: minutos/goles/asistencias/
// tarjetas, derivados de las tablas de eventos, igual que antes).
export default function PlayerInfoPanel({ entry, onClose }: { entry: MatchLineupEntry; onClose: () => void }) {
  const navigate = useNavigate()
  const photoUrl = resolveAssetUrl(entry.photoUrl)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-t-lg bg-white shadow-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 px-5 pb-5 pt-4 text-white">
          <button type="button" onClick={onClose} className="absolute right-3 top-3 text-white/70 hover:text-white">
            ✕
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-white/40 bg-slate-600">
              {photoUrl ? (
                <img src={photoUrl} alt={entry.playerFullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/60">#{entry.shirtNumber ?? '—'}</p>
              <h3 className="truncate text-lg font-bold">{entry.playerFullName}</h3>
              <p className="text-sm text-white/70">
                {entry.position ?? 'Sin posición'}
                {entry.nationality ? ` · ${entry.nationality}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <dl className="mb-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Minutos" value={entry.minutesPlayed ?? '—'} />
            <Stat label="Goles" value={entry.goals} />
            <Stat label="Asist." value={entry.assists} />
            <Stat label="Amarillas" value={entry.yellowCards} />
            <Stat label="Rojas" value={entry.redCards} />
            <Stat label="Titular" value={entry.isStarting ? 'Sí' : 'No'} />
          </dl>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/jugadores/${entry.playerId}`)}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ver perfil completo
            </button>
            <button
              type="button"
              onClick={() => navigate(`/jugadores/${entry.playerId}/editar`)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dd className="text-lg font-bold text-slate-900">{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  )
}
