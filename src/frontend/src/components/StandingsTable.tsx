import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../context/AuthContext'
import { exportToCsv } from '../lib/csv'
import { api } from '../services/api'
import type { StandingsResponse } from '../types/season'

export default function StandingsTable({ seasonId }: { seasonId: number }) {
  const navigate = useNavigate()
  const [data, setData] = useState<StandingsResponse | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setData(null)
    setLoadError('')
    api
      .get<StandingsResponse>(`/seasons/${seasonId}/standings`)
      .then(setData)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Error al cargar la clasificación'))
  }, [seasonId])

  if (loadError) return <p className="text-red-600">{loadError}</p>
  if (!data) return <p className="text-slate-500">Cargando...</p>
  if (data.standings.length === 0) {
    return <p className="text-slate-500">No hay equipos participantes en esta temporada todavía.</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Equipo</th>
              <th className="px-2 py-2 text-center">PJ</th>
              <th className="px-2 py-2 text-center">PG</th>
              <th className="px-2 py-2 text-center">PE</th>
              <th className="px-2 py-2 text-center">PP</th>
              <th className="px-2 py-2 text-center">GF</th>
              <th className="px-2 py-2 text-center">GC</th>
              <th className="px-2 py-2 text-center">DG</th>
              <th className="px-2 py-2 text-center font-bold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {data.standings.map((row) => (
              <tr key={row.teamId} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 text-slate-500">{row.position}</td>
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/equipos/${row.teamId}`)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {row.teamName}
                  </button>
                  {row.matchesMissingScore > 0 && (
                    <span
                      className="ml-1 text-amber-600"
                      title={`${row.matchesMissingScore} partido(s) finalizado(s) sin marcador cargado, no incluido(s) en este cálculo`}
                    >
                      *
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{row.played}</td>
                <td className="px-2 py-2 text-center">{row.won}</td>
                <td className="px-2 py-2 text-center">{row.drawn}</td>
                <td className="px-2 py-2 text-center">{row.lost}</td>
                <td className="px-2 py-2 text-center">{row.goalsFor}</td>
                <td className="px-2 py-2 text-center">{row.goalsAgainst}</td>
                <td className="px-2 py-2 text-center">{row.goalDifference}</td>
                <td className="px-2 py-2 text-center font-bold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          Puntos: victoria {data.pointsRule.win} · empate {data.pointsRule.draw} · derrota {data.pointsRule.loss}
        </p>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `clasificacion_temporada_${seasonId}.csv`,
              data.standings,
              [
                { key: 'position', label: '#' },
                { key: 'teamName', label: 'Equipo' },
                { key: 'played', label: 'PJ' },
                { key: 'won', label: 'PG' },
                { key: 'drawn', label: 'PE' },
                { key: 'lost', label: 'PP' },
                { key: 'goalsFor', label: 'GF' },
                { key: 'goalsAgainst', label: 'GC' },
                { key: 'goalDifference', label: 'DG' },
                { key: 'points', label: 'PTS' },
              ],
            )
          }
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          ⬇ Exportar CSV
        </button>
      </div>
      {data.warning && <p className="mt-2 text-xs text-amber-600">* {data.warning}</p>}
    </>
  )
}
