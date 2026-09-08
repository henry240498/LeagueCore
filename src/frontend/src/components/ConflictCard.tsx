import { useState } from 'react'
import { ApiError } from '../context/AuthContext'
import { api } from '../services/api'
import type { SyncConflict } from '../types/importSync'

const RESOLUTION_LABELS: Record<string, string> = {
  link_existing: 'Vinculado a la entidad existente',
  create_new: 'Creado como entidad nueva',
  keep_existing: 'Se conservó el dato existente',
  use_imported: 'Se usó el dato importado',
  skip: 'Omitido',
}

// Una tarjeta por conflicto -- dos formas de render según `conflictKind` (§9-12 del pedido):
// 'duplicate_entity' (¿son la misma entidad o dos distintas?) muestra nombre existente vs nombre
// importado + % de similitud; 'field_diff' (misma entidad, algún campo distinto -- ej. resultado
// 2-1 vs 3-1) muestra una tabla campo por campo, resaltando SÓLO lo que cambió (nunca "existe
// conflicto" a secas, siempre qué cambió exactamente -- §11).
export default function ConflictCard({ conflict, onResolved }: { conflict: SyncConflict; onResolved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resolve = async (action: string) => {
    setError('')
    setBusy(true)
    try {
      await api.post(`/import-sync/conflicts/${conflict.id}/resolve`, { action })
      onResolved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al resolver el conflicto')
    } finally {
      setBusy(false)
    }
  }

  const isResolved = conflict.status !== 'pending'

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{conflict.entityType}</span>
        {isResolved ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            ✓ {RESOLUTION_LABELS[conflict.resolutionAction ?? ''] ?? 'Resuelto'}
          </span>
        ) : conflict.conflictKind === 'duplicate_entity' && conflict.similarityPct != null ? (
          <span className="text-xs text-slate-400">{conflict.similarityPct}% similar</span>
        ) : null}
      </div>

      {conflict.conflictKind === 'field_diff' ? (
        <FieldDiffView conflict={conflict} />
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">LeagueCore</p>
            <p className="font-medium text-slate-900">{conflict.leaguecoreValue}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Importado</p>
            <p className="font-medium text-slate-900">{conflict.externalValue}</p>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {!isResolved && (
        <div className="mt-3 flex flex-wrap gap-2">
          {conflict.conflictKind === 'field_diff' ? (
            <>
              <button type="button" disabled={busy} onClick={() => resolve('keep_existing')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                Conservar existente
              </button>
              <button type="button" disabled={busy} onClick={() => resolve('use_imported')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Reemplazar por importado
              </button>
              <button type="button" disabled={busy} onClick={() => resolve('skip')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                Omitir
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => resolve('link_existing')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50" title="Son la misma entidad -- vincular para que futuras importaciones no vuelvan a preguntar">
                Es la misma (vincular)
              </button>
              <button type="button" disabled={busy} onClick={() => resolve('create_new')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50" title="Son entidades distintas -- crear el dato importado como uno nuevo">
                Es distinta (crear nueva)
              </button>
              <button type="button" disabled={busy} onClick={() => resolve('skip')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                Omitir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FieldDiffView({ conflict }: { conflict: SyncConflict }) {
  const existing = conflict.existingDisplay ?? {}
  const imported = conflict.importedDisplay ?? {}
  const keys = Array.from(new Set([...Object.keys(existing), ...Object.keys(imported)]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="py-1 pr-3 font-medium">Campo</th>
            <th className="py-1 pr-3 font-medium">Existente</th>
            <th className="py-1 pr-3 font-medium">Importado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {keys.map((key) => {
            const a = existing[key] ?? '—'
            const b = imported[key] ?? '—'
            const changed = String(a) !== String(b)
            return (
              <tr key={key}>
                <td className="py-1 pr-3 text-slate-500">{key}</td>
                <td className={`py-1 pr-3 ${changed ? 'font-medium text-amber-700' : 'text-slate-700'}`}>{a}</td>
                <td className={`py-1 pr-3 ${changed ? 'font-medium text-blue-700' : 'text-slate-700'}`}>{b}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
