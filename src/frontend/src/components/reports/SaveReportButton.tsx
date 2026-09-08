import { useState } from 'react'
import { api } from '../../services/api'
import { ApiError } from '../../context/AuthContext'

// §31: guardar la configuración actual de filtros de un reporte con un nombre, para volver a
// ejecutarla después sin reconfigurar (§32 favoritos se marca luego desde el hub/lista de guardados).
export default function SaveReportButton({
  reportType,
  filters,
}: {
  reportType: string
  filters: Record<string, unknown>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/reports/saved', { name: name.trim(), reportType, filters })
      setDone(true)
      setOpen(false)
      setName('')
      setTimeout(() => setDone(false), 3000)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error al guardar el reporte')
    } finally {
      setSaving(false)
    }
  }

  if (open) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Nombre del reporte..."
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          disabled={!name.trim() || saving}
          onClick={handleSave}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      {done ? '✓ Guardado' : '💾 Guardar reporte'}
    </button>
  )
}
