import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { DashboardCounts, SavedReport } from '../../types/report'

type Category = {
  key: string
  title: string
  icon: string
  countKey?: keyof DashboardCounts
  to: string
  reports: string[]
  adminOnly?: boolean
}

// §43: tarjetas con conteos REALES (reusa /dashboard/stats, no un endpoint nuevo). §3: categorías
// tal como las pidió el usuario, cada una linkeando al reporte real correspondiente -- Comparación
// de jugadores/equipos ya existe como /comparador y se linkea ahí en vez de duplicarlo acá.
const CATEGORIES: Category[] = [
  {
    key: 'partidos',
    title: 'Partidos',
    icon: '⚽',
    countKey: 'partidos',
    to: '/reportes/partidos',
    reports: ['Reporte de partidos', 'Reporte detallado de partido', 'Reporte táctico'],
  },
  {
    key: 'jugadores',
    title: 'Jugadores',
    icon: '🏃',
    countKey: 'jugadores',
    to: '/reportes/jugadores',
    reports: ['Reporte de jugadores', 'Perfil estadístico', 'Comparación (ir a Comparador)'],
  },
  {
    key: 'equipos',
    title: 'Equipos',
    icon: '🛡️',
    countKey: 'equipos',
    to: '/reportes/equipos',
    reports: ['Reporte de equipos', 'Plantillas', 'Enfrentamientos'],
  },
  {
    key: 'competiciones',
    title: 'Competiciones',
    icon: '🏆',
    countKey: 'competiciones',
    to: '/reportes/competiciones',
    reports: ['Clasificación', 'Goleadores', 'Tarjetas', 'Calendario'],
  },
  {
    key: 'estadisticas',
    title: 'Estadísticas',
    icon: '📊',
    to: '/estadisticas',
    reports: ['Estadísticas generales (ir a Estadísticas)'],
  },
  {
    key: 'arbitros',
    title: 'Árbitros',
    icon: '🟨',
    countKey: 'oficiales',
    to: '/reportes/arbitros',
    reports: ['Actuaciones', 'Partidos dirigidos', 'Tarjetas'],
  },
  {
    key: 'estadios',
    title: 'Estadios',
    icon: '🏟️',
    countKey: 'estadios',
    to: '/reportes/estadios',
    reports: ['Partidos disputados', 'Información del estadio'],
  },
  {
    key: 'investigacion',
    title: 'Investigación',
    icon: '🔎',
    countKey: 'investigaciones',
    to: '/reportes/investigacion',
    reports: ['Historial de corridas', 'Errores', 'Conflictos'],
    adminOnly: true,
  },
  {
    key: 'auditoria',
    title: 'Auditoría',
    icon: '🔒',
    to: '/reportes/auditoria',
    reports: ['Registro de actividad'],
    adminOnly: true,
  },
]

export default function ReportsHubPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [saved, setSaved] = useState<SavedReport[] | null>(null)

  useEffect(() => {
    api.get<DashboardCounts>('/dashboard/stats').then(setCounts).catch(() => setCounts(null))
    api.get<SavedReport[]>('/reports/saved').then(setSaved).catch(() => setSaved([]))
  }, [])

  const isAdmin = user?.role === 'admin'
  const categories = CATEGORIES.filter((c) => !c.adminOnly || isAdmin)
  const favorites = (saved ?? []).filter((s) => s.isFavorite)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">📈 Centro de Reportes</h1>
      <p className="mb-6 text-sm text-slate-500">
        Análisis y reportes con los datos reales de LeagueCore — partidos, jugadores, equipos,
        competiciones, árbitros, estadios e investigación histórica.
      </p>

      {favorites.length > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-bold text-amber-900">★ Reportes favoritos</h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(reportTypeToPath(f.reportType), { state: { savedFilters: f.filters } })}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm hover:bg-amber-100"
              >
                ★ {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => navigate(cat.to)}
            className="rounded-lg bg-white p-5 text-left shadow transition hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl">{cat.icon}</span>
              {cat.countKey && (
                <span className="text-2xl font-bold text-slate-900">
                  {counts ? counts[cat.countKey] : '—'}
                </span>
              )}
            </div>
            <p className="font-bold text-slate-900">{cat.title}</p>
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {cat.reports.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-blue-600">Ver reportes →</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate('/reportes/enfrentamientos')}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          🆚 Enfrentamientos entre equipos
        </button>
        <button
          type="button"
          onClick={() => navigate('/comparador')}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          📈 Comparador de jugadores/equipos/temporadas
        </button>
      </div>

      {saved && saved.length > 0 && (
        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Mis reportes guardados</h2>
          <ul className="divide-y divide-slate-100">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={() => navigate(reportTypeToPath(s.reportType), { state: { savedFilters: s.filters } })}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {s.isFavorite && '★ '}
                  {s.name}
                </button>
                <span className="text-xs text-slate-400">
                  {s.username} · {new Date(s.createdAt).toLocaleDateString('es-PY')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function reportTypeToPath(reportType: string): string {
  const map: Record<string, string> = {
    matches: '/reportes/partidos',
    players: '/reportes/jugadores',
    teams: '/reportes/equipos',
    competitions: '/reportes/competiciones',
    referees: '/reportes/arbitros',
    venues: '/reportes/estadios',
    imports: '/reportes/investigacion',
    audit: '/reportes/auditoria',
  }
  return map[reportType] ?? '/reportes'
}
