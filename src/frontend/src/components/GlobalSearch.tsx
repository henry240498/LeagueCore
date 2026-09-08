import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

type SearchResult = {
  type: 'competition' | 'team' | 'player' | 'official' | 'coach' | 'season' | 'match'
  id: number
  label: string
  sublabel: string | null
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  competition: 'Competición',
  team: 'Equipo',
  player: 'Jugador',
  official: 'Oficial',
  coach: 'Entrenador',
  season: 'Temporada',
  match: 'Partido',
}

const TYPE_ROUTES: Partial<Record<SearchResult['type'], string>> = {
  competition: '/competiciones',
  team: '/equipos',
  player: '/jugadores',
  official: '/oficiales',
  season: '/temporadas',
  match: '/partidos',
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      api
        .get<SearchResult[]>(`/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => {
          setResults(r)
          setOpen(true)
        })
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleSelect = (r: SearchResult) => {
    const base = TYPE_ROUTES[r.type]
    if (base) navigate(`${base}/${r.id}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="🔍 Buscar en LeagueCore..."
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg bg-white text-slate-900 shadow-xl">
          {results.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Sin resultados.</p>}
          {results.map((r) => {
            const clickable = !!TYPE_ROUTES[r.type]
            return (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                disabled={!clickable}
                onClick={() => handleSelect(r)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  clickable ? 'hover:bg-slate-50' : 'cursor-default opacity-60'
                }`}
              >
                <span>
                  <span className="font-medium">{r.label}</span>
                  {r.sublabel && <span className="ml-2 text-slate-400">{r.sublabel}</span>}
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {TYPE_LABELS[r.type]}
                  {!clickable ? ' · sin ficha propia' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
