import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { scoutingService } from '../../services/scouting'
import type { WatchItem } from '../../types/scouting'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

const PRIORITY_STYLE: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-700',
  MEDIA: 'bg-amber-100 text-amber-800',
  BAJA: 'bg-slate-200 text-slate-600',
}

export default function WatchlistPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<WatchItem[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [externalName, setExternalName] = useState('')
  const [priority, setPriority] = useState('MEDIA')

  const load = () => {
    scoutingService
      .listWatchlist(status || undefined)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar'))
  }

  useEffect(load, [status])

  const handleAddExternal = async () => {
    if (!externalName.trim()) return
    try {
      await scoutingService.addWatchItem({ externalName: externalName.trim(), priority })
      setExternalName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al agregar')
    }
  }

  const cycleStatus = async (item: WatchItem) => {
    const order = ['OBSERVADO', 'EN_SEGUIMIENTO', 'OFERTADO', 'DESCARTADO'] as const
    const next = order[(order.indexOf(item.status) + 1) % order.length]
    await scoutingService.updateWatchItem(item.id, { status: next })
    load()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">👀 Lista de seguimiento ({items.length})</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg bg-white p-4 shadow">
        <input value={externalName} onChange={(e) => setExternalName(e.target.value)} placeholder="Jugador externo (Pedro Gómez, Extremo…)" className={`${inputClass} min-w-[220px] flex-1`} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
          <option value="ALTA">Prioridad alta</option>
          <option value="MEDIA">Prioridad media</option>
          <option value="BAJA">Prioridad baja</option>
        </select>
        <button type="button" onClick={handleAddExternal} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Observar
        </button>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="">Todos los estados</option>
          <option value="OBSERVADO">Observado</option>
          <option value="EN_SEGUIMIENTO">En seguimiento</option>
          <option value="OFERTADO">Ofertado</option>
          <option value="DESCARTADO">Descartado</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((w) => (
          <article key={w.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                {w.playerId ? (
                  <button type="button" onClick={() => navigate(`/jugadores/${w.playerId}`)} className="font-bold text-blue-600 hover:underline">
                    {w.playerName}
                  </button>
                ) : (
                  <p className="font-bold">{w.externalName}</p>
                )}
                <p className="mt-1 flex gap-1 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${PRIORITY_STYLE[w.priority]}`}>{w.priority}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{w.status.replace(/_/g, ' ')}</span>
                </p>
                {(w.owner || w.nextObservation) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {w.owner ? `Resp: ${w.owner} · ` : ''}{w.nextObservation ? `Próx: ${w.nextObservation.slice(0, 10)}` : ''}
                  </p>
                )}
                {w.notes && <p className="mt-1 text-xs text-slate-600">{w.notes}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-xs">
                <button type="button" onClick={() => cycleStatus(w)} className="text-slate-600 hover:underline">
                  Avanzar estado
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('¿Quitar del seguimiento?')) return
                    await scoutingService.removeWatchItem(w.id)
                    load()
                  }}
                  className="text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && <p className="p-6 text-center text-slate-500">Nadie en seguimiento. Agregá desde scouting o un externo.</p>}
    </div>
  )
}
