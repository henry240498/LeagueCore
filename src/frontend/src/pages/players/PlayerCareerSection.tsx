import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { playerProfileService } from '../../services/playerProfile'
import type { PlayerCareer, PlayerMatchLog, PlayerStatTotals } from '../../types/player'

/**
 * Planilla del jugador: trayectoria (equipos por los que pasó), totales de carrera, desglose por
 * competición, posiciones realmente jugadas, estadísticas individuales acumuladas y el historial
 * partido a partido.
 *
 * Todo sale de datos ya existentes (ver backend `player-career.service.ts`). Ninguna cifra se
 * inventa: las secciones sin datos lo dicen explícitamente.
 */
const PAGE_SIZE = 20

export default function PlayerCareerSection({ playerId }: { playerId: number }) {
  const [career, setCareer] = useState<PlayerCareer | null>(null)
  const [log, setLog] = useState<PlayerMatchLog | null>(null)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    playerProfileService
      .getCareer(playerId)
      // Se normaliza la respuesta: si llegara incompleta, la planilla muestra ceros/listas vacías
      // en vez de romper la pantalla entera.
      .then((c) =>
        setCareer({
          teamHistory: c?.teamHistory ?? [],
          totals: {
            matches: c?.totals?.matches ?? 0,
            starts: c?.totals?.starts ?? 0,
            substituteAppearances: c?.totals?.substituteAppearances ?? 0,
            minutes: c?.totals?.minutes ?? 0,
            goals: c?.totals?.goals ?? 0,
            ownGoals: c?.totals?.ownGoals ?? 0,
            assists: c?.totals?.assists ?? 0,
            yellowCards: c?.totals?.yellowCards ?? 0,
            redCards: c?.totals?.redCards ?? 0,
          },
          byCompetition: c?.byCompetition ?? [],
          positions: c?.positions ?? [],
          statTotals: c?.statTotals ?? null,
        }),
      )
      .catch(() => setFailed(true))
  }, [playerId])

  useEffect(() => {
    playerProfileService
      .getMatchLog(playerId, page, PAGE_SIZE)
      .then((l) =>
        setLog({
          items: l?.items ?? [],
          total: l?.total ?? 0,
          page: l?.page ?? 1,
          pageSize: l?.pageSize ?? PAGE_SIZE,
        }),
      )
      .catch(() => setLog({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE }))
  }, [playerId, page])

  if (failed) {
    return (
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-2 text-lg font-bold">📋 Planilla del jugador</h2>
        <p className="text-sm text-slate-500">No se pudo cargar la trayectoria en este momento.</p>
      </section>
    )
  }

  if (!career) {
    return (
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-2 text-lg font-bold">📋 Planilla del jugador</h2>
        <p className="text-sm text-slate-400">Cargando...</p>
      </section>
    )
  }

  const t = career.totals
  const hasAnything =
    t.matches > 0 || career.teamHistory.length > 0 || career.byCompetition.length > 0

  return (
    <section className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">📋 Planilla del jugador</h2>

        {!hasAnything ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Todavía no hay trayectoria registrada: este jugador no figura en ninguna alineación ni tiene
            historial de equipos cargado.
          </p>
        ) : (
          <>
            {/* Totales de carrera */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <Stat label="Partidos" value={t.matches} />
              <Stat label="Titular" value={t.starts} />
              <Stat label="Desde banco" value={t.substituteAppearances} />
              <Stat label="Minutos" value={t.minutes} />
              <Stat label="Goles" value={t.goals} tone="text-emerald-700" />
              <Stat label="Asistencias" value={t.assists} tone="text-blue-700" />
              <Stat label="Amarillas" value={t.yellowCards} tone="text-amber-600" />
              <Stat label="Rojas" value={t.redCards} tone="text-red-600" />
            </div>
            {t.ownGoals > 0 && (
              <p className="mt-2 text-xs text-slate-400">Incluye {t.ownGoals} gol(es) en contra.</p>
            )}

            {/* Posiciones realmente jugadas */}
            {career.positions.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Posiciones jugadas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {career.positions.map((p) => (
                    <span
                      key={p.position}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {p.position} · {p.matches} PJ
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Trayectoria por equipos */}
      {career.teamHistory.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-3 font-bold">🏟️ Trayectoria</h3>
          <ol className="space-y-2">
            {career.teamHistory.map((s) => {
              const logo = resolveAssetUrl(s.teamLogoUrl)
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                  <div className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-slate-100">
                    {logo ? (
                      <img src={logo} alt={s.teamName} className="h-full w-full object-contain" />
                    ) : (
                      <span aria-hidden>🛡️</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.teamName}
                      {s.squadNumber != null && <span className="text-slate-400"> · #{s.squadNumber}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.startDate.slice(0, 10)} → {s.endDate ? s.endDate.slice(0, 10) : 'actualidad'}
                    </p>
                    {s.note && <p className="mt-0.5 text-xs text-slate-400">{s.note}</p>}
                  </div>
                  {s.current && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Actual
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Rendimiento por competición */}
      {career.byCompetition.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-3 font-bold">🏆 Por competición</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">Competición</th>
                  <th className="px-2 py-2 text-center">PJ</th>
                  <th className="px-2 py-2 text-center">Min</th>
                  <th className="px-2 py-2 text-center">G</th>
                  <th className="px-2 py-2 text-center">A</th>
                  <th className="px-2 py-2 text-center" aria-label="Tarjetas amarillas">🟨</th>
                  <th className="px-2 py-2 text-center" aria-label="Tarjetas rojas">🟥</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {career.byCompetition.map((c) => (
                  <tr key={c.competitionId}>
                    <td className="px-2 py-1.5">{c.competitionName}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{c.matches}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{c.minutes}</td>
                    <td className="px-2 py-1.5 text-center font-medium tabular-nums">{c.goals}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{c.assists}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{c.yellowCards}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{c.redCards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <IndividualStats stats={career.statTotals} />
      <MatchLog log={log} page={page} onPage={setPage} />
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone ?? 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

/** Estadísticas individuales acumuladas: sólo si la fuente cargó al menos un partido. */
function IndividualStats({ stats }: { stats: PlayerStatTotals | null }) {
  if (!stats) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-2 font-bold">📈 Estadísticas individuales</h3>
        <p className="text-sm text-slate-500">
          Sin estadísticas individuales por partido cargadas todavía (tiros, pases, duelos,
          recuperaciones…). La estructura está lista para mostrarlas cuando existan.
        </p>
      </div>
    )
  }

  const duelsWon = (stats.duelsGroundWon ?? 0) + (stats.duelsAerialWon ?? 0)
  const duelsLost = (stats.duelsGroundLost ?? 0) + (stats.duelsAerialLost ?? 0)
  const duelsTotal = duelsWon + duelsLost
  const rows: { label: string; value: string | number }[] = []
  const push = (label: string, v: number | null) => {
    if (v != null) rows.push({ label, value: v })
  }

  push('Tiros', stats.shots)
  push('Tiros al arco', stats.shotsOnTarget)
  push('Pases', stats.passes)
  push('Pases completados', stats.passesCompleted)
  if (stats.passes && stats.passesCompleted != null) {
    rows.push({ label: 'Precisión de pases', value: `${Math.round((stats.passesCompleted / stats.passes) * 100)}%` })
  }
  push('Toques', stats.touches)
  push('Entradas', stats.tackles)
  push('Entradas ganadas', stats.tacklesWon)
  push('Intercepciones', stats.interceptions)
  push('Despejes', stats.clearances)
  push('Recuperaciones', stats.recoveries)
  if (duelsTotal > 0) {
    rows.push({ label: 'Duelos ganados', value: `${duelsWon}/${duelsTotal}` })
  }
  const blocks = (stats.blocksShots ?? 0) + (stats.blocksPasses ?? 0)
  if (stats.blocksShots != null || stats.blocksPasses != null) {
    rows.push({ label: 'Bloqueos', value: blocks })
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-bold">📈 Estadísticas individuales</h3>
        <span className="text-xs text-slate-400">acumulado de {stats.matchesWithStats} partido(s)</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Los partidos cargados no tienen ninguna métrica completada.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs text-slate-500">{r.label}</dt>
              <dd className="font-semibold tabular-nums text-slate-800">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Historial partido a partido, del más reciente al más antiguo. */
function MatchLog({
  log,
  page,
  onPage,
}: {
  log: PlayerMatchLog | null
  page: number
  onPage: (p: number) => void
}) {
  const navigate = useNavigate()

  if (!log) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-2 font-bold">📅 Partido a partido</h3>
        <p className="text-sm text-slate-400">Cargando...</p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(log.total / log.pageSize))

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">📅 Partido a partido</h3>
        {log.total > 0 && <span className="text-xs text-slate-400">{log.total} partido(s)</span>}
      </div>

      {log.items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          Este jugador todavía no figura en la alineación de ningún partido.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Competición</th>
                  <th className="px-2 py-2">Rival</th>
                  <th className="px-2 py-2 text-center">Res.</th>
                  <th className="px-2 py-2">Pos.</th>
                  <th className="px-2 py-2 text-center">Min</th>
                  <th className="px-2 py-2 text-center">G</th>
                  <th className="px-2 py-2 text-center">A</th>
                  <th className="px-2 py-2 text-center">T</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {log.items.map((m) => (
                  <tr key={m.matchId} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">
                      {m.matchDate.slice(0, 10)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      <span className="block max-w-[160px] truncate">{m.competitionName}</span>
                      {m.seasonLabel && <span className="text-xs text-slate-400">{m.seasonLabel}</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/partidos/${m.matchId}`)}
                        className="text-blue-600 hover:underline"
                        title="Abrir el partido"
                      >
                        {m.isHome ? 'vs' : '@'} {m.opponentName}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
                      {m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {m.position ?? '—'}
                      {!m.isStarting && <span className="ml-1 text-xs text-slate-400">(supl.)</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{m.minutesPlayed ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center font-medium tabular-nums">{m.goals || ''}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{m.assists || ''}</td>
                    <td className="px-2 py-1.5 text-center">
                      {m.yellowCards > 0 && <span aria-label="Amarilla" role="img">🟨</span>}
                      {m.redCards > 0 && <span aria-label="Roja" role="img">🟥</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-slate-500">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPage(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
