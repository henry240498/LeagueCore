import { useEffect, useState } from 'react'
import TacticalBoard from '../../components/pitch/TacticalBoard'
import { ApiError } from '../../context/AuthContext'
import { tacticsService } from '../../services/tactics'
import {
  PLAY_CATEGORIES,
  PLAY_CATEGORY_LABELS,
  type BoardDiagram,
  type PlayCategory,
  type TacticalPlay,
} from '../../types/tactics'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PlaysLibraryPage() {
  const [plays, setPlays] = useState<TacticalPlay[] | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<PlayCategory | ''>('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<TacticalPlay | null>(null)
  const [form, setForm] = useState({ code: '', category: 'CORNER' as PlayCategory, title: '', description: '', videoUrl: '', rival: '', result: '' })
  const [diagram, setDiagram] = useState<BoardDiagram>({ tokens: [], arrows: [] })

  const load = () => {
    tacticsService
      .listPlays({ search: search || undefined, category: category || undefined })
      .then(setPlays)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar jugadas'))
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category])

  const openNew = () => {
    setEditing(null)
    setForm({ code: '', category: 'CORNER', title: '', description: '', videoUrl: '', rival: '', result: '' })
    setDiagram({ tokens: [], arrows: [] })
  }

  const openEdit = (p: TacticalPlay) => {
    setEditing(p)
    setForm({
      code: p.code,
      category: p.category,
      title: p.title,
      description: p.description ?? '',
      videoUrl: p.videoUrl ?? '',
      rival: p.rival ?? '',
      result: p.result ?? '',
    })
    try {
      setDiagram(p.diagramJson ? (JSON.parse(p.diagramJson) as BoardDiagram) : { tokens: [], arrows: [] })
    } catch {
      setDiagram({ tokens: [], arrows: [] })
    }
  }

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.title.trim()) {
      setError('Código y título son obligatorios.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        category: form.category,
        title: form.title.trim(),
        description: form.description || undefined,
        diagramJson: JSON.stringify(diagram),
        videoUrl: form.videoUrl || undefined,
        rival: form.rival || undefined,
        result: form.result || undefined,
      }
      if (editing) {
        await tacticsService.updatePlay(editing.id, payload)
      } else {
        await tacticsService.createPlay({ code: form.code.trim().toUpperCase(), ...payload })
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: TacticalPlay) => {
    if (!window.confirm(`¿Eliminar la jugada "${p.code}"?`)) return
    try {
      await tacticsService.removePlay(p.id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">📋 Jugadas preparadas</h1>
        <button
          type="button"
          onClick={() => {
            openNew()
            setShowForm(true)
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nueva jugada
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o título…"
          className={`${inputClass} min-w-[200px] flex-1`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value as PlayCategory | '')} className={inputClass}>
          <option value="">Todas las categorías</option>
          {PLAY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PLAY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 grid gap-4 rounded-lg bg-white p-6 shadow lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-bold">{editing ? `Editar ${editing.code}` : 'Nueva jugada'}</h2>
            {!editing && (
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Código (CORNER-001)"
                className={`${inputClass} w-full`}
              />
            )}
            <div className="flex gap-2">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PlayCategory })} className={`${inputClass} flex-1`}>
                {PLAY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PLAY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título *"
                className={`${inputClass} flex-[2]`}
              />
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción / instrucciones"
              rows={3}
              className={`${inputClass} w-full`}
            />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.rival} onChange={(e) => setForm({ ...form, rival: e.target.value })} placeholder="Rival" className={inputClass} />
              <input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="Resultado" className={inputClass} />
            </div>
            <input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="URL del video" className={`${inputClass} w-full`} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar jugada'}
              </button>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">Pizarra: dibujá la jugada</h3>
            <TacticalBoard
              key={editing?.id ?? 'new'}
              initial={diagram}
              onChange={setDiagram}
            />
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {plays?.map((p) => (
          <article key={p.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold text-blue-700">{p.code}</p>
                <h3 className="font-bold">{p.title}</h3>
                <p className="text-xs text-slate-500">
                  {PLAY_CATEGORY_LABELS[p.category]} · usada {p.usageCount} {p.usageCount === 1 ? 'vez' : 'veces'}
                  {p.rival ? ` · vs ${p.rival}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 text-sm">
                <button type="button" onClick={() => { openEdit(p); setShowForm(true) }} className="text-slate-600 hover:underline">
                  Editar
                </button>
                <button type="button" onClick={() => handleDelete(p)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
            {p.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{p.description}</p>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await tacticsService.registerPlayUse(p.id)
                  load()
                }}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                +1 uso
              </button>
              {p.videoUrl && (
                <a href={p.videoUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                  ▶ Video
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      {plays?.length === 0 && <p className="p-6 text-center text-slate-500">Sin jugadas. Creá CORNER-001, PRESSING-001…</p>}
      {!plays && !error && <p className="p-6 text-center text-slate-500">Cargando…</p>}
    </div>
  )
}
