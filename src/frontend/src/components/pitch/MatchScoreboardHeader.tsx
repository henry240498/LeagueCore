import { resolveAssetUrl } from '../../lib/assetUrl'
import type { Match } from '../../types/match'
import { MATCH_STATUS_LABELS } from '../../types/match'

// Encabezado de marcador (concepto tomado de la imagen de referencia: escudo + nombre de cada
// equipo, resultado central grande, penales debajo si los hubo) -- nunca inventa un logo: si el
// equipo no tiene logo_url cargado, muestra una silueta genérica, nunca un logo de otro club.
export default function MatchScoreboardHeader({ match }: { match: Match }) {
  const fullTime = match.periodScores.find((p) => p.period === 'full_time')
  const penalties = match.periodScores.find((p) => p.period === 'penalties')

  return (
    <div className="overflow-hidden rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow">
      <div className="grid grid-cols-3 items-center gap-2 px-4 py-5 sm:px-8">
        <TeamBlock name={match.homeTeamName ?? 'Local'} logoUrl={match.homeTeamLogoUrl} align="right" />

        <div className="text-center">
          <p className="text-3xl font-bold tracking-wide sm:text-4xl">
            {fullTime ? `${fullTime.homeScore} - ${fullTime.awayScore}` : 'vs'}
          </p>
          {penalties && (
            <p className="mt-1 text-sm text-cyan-300">
              {penalties.homeScore} - {penalties.awayScore} <span className="text-white/60">penales</span>
            </p>
          )}
          <p className="mt-1 text-xs uppercase tracking-wide text-white/60">{MATCH_STATUS_LABELS[match.status] ?? match.status}</p>
        </div>

        <TeamBlock name={match.awayTeamName ?? 'Visitante'} logoUrl={match.awayTeamLogoUrl} align="left" />
      </div>
      <div className="border-t border-white/10 bg-black/20 px-4 py-2 text-center text-xs text-white/70 sm:px-8">
        {new Date(match.matchDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
        {/* mssql serializa TIME como fecha de referencia 1970-01-01THH:MM:SS.000Z -- la hora real
            está en los caracteres 11-16 del ISO string, nunca al principio (mismo bug ya
            encontrado y corregido antes en Reportes v31 y en el importador de archivo v36). */}
        {match.matchTime ? ` · ${match.matchTime.slice(11, 16)}` : ''}
        {match.venueName ? ` · ${match.venueName}` : ''}
      </div>
    </div>
  )
}

function TeamBlock({ name, logoUrl, align }: { name: string; logoUrl?: string | null; align: 'left' | 'right' }) {
  const url = resolveAssetUrl(logoUrl)
  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${align === 'right' ? 'flex-row-reverse justify-self-end text-right' : 'justify-self-start'}`}>
      <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-full bg-white/10 sm:h-16 sm:w-16">
        {url ? <img src={url} alt={name} className="h-full w-full object-contain" /> : <span className="text-2xl">🛡️</span>}
      </div>
      <p className="truncate text-sm font-semibold sm:text-base">{name}</p>
    </div>
  )
}
