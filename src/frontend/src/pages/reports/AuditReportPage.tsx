import { useEffect, useState } from 'react'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import type { AuditLogEntry, AuditLogResponse } from '../../types/report'

// §39: reporte de auditoría, integrado con Seguridad (admin-only, reforzado en el backend con
// AdminOnlyGuard sobre /reports/audit). dbo.audit_log NUNCA guardó campo/valor anterior/valor
// nuevo -- sólo acción/entidad/id/detalle/ip/fecha -- así que el reporte muestra exactamente eso,
// sin inventar columnas de "antes/después" que la base no tiene.
export default function AuditReportPage() {
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actions, setActions] = useState<string[]>([])
  const [entities, setEntities] = useState<string[]>([])
  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [serverPage, setServerPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<string[]>('/reports/audit/actions').then(setActions).catch(() => setActions([]))
    api.get<string[]>('/reports/audit/entities').then(setEntities).catch(() => setEntities([]))
  }, [])

  const fetchPage = (page: number, append: boolean) => {
    const params = new URLSearchParams({ pageSize: '100', page: String(page) })
    if (action) params.set('action', action)
    if (entity) params.set('entity', entity)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return api
      .get<AuditLogResponse>(`/reports/audit?${params}`)
      .then((r) => {
        setItems((prev) => (append ? [...prev, ...r.items] : r.items))
        setTotal(r.total)
        setServerPage(page)
        setLoaded(true)
      })
      .catch(() => setError('No se pudo cargar el registro de auditoría (requiere rol administrador)'))
  }

  // Reinicia la paginación del servidor cada vez que cambian los filtros -- una fuente de la
  // "página 1 de servidor" siempre distinta a la paginación en cliente de ReportTable, que sólo
  // pagina lo que ya se trajo. Sin esto, el reporte mostraba como máximo los primeros 100 registros
  // aunque hubiera más (180 reales en la base de prueba) y no había forma de ver el resto.
  useEffect(() => {
    setItems([])
    setLoaded(false)
    fetchPage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, entity, dateFrom, dateTo])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    await fetchPage(serverPage + 1, true)
    setLoadingMore(false)
  }

  const columns: ReportColumn<AuditLogEntry>[] = [
    { key: 'date', label: 'Fecha', render: (r) => new Date(r.createdAt).toLocaleString('es-PY'), sortValue: (r) => r.createdAt },
    { key: 'user', label: 'Usuario', render: (r) => r.username ?? 'Sistema' },
    { key: 'action', label: 'Acción', render: (r) => r.action },
    { key: 'entity', label: 'Entidad', render: (r) => r.entity ?? '—' },
    { key: 'entityId', label: 'Registro', render: (r) => r.entityId ?? '—' },
    { key: 'details', label: 'Detalle', render: (r) => r.details ?? '—' },
    { key: 'ip', label: 'IP', render: (r) => r.ipAddress ?? '—' },
  ]

  if (error) return <p className="p-6 text-red-600">{error}</p>

  return (
    <ReportLayout
      title="Reporte de Auditoría"
      subtitle="Actividad registrada por el sistema. Sólo se muestran los campos que dbo.audit_log realmente guarda (no hay valor anterior/nuevo por campo)."
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'auditoria.csv',
                items.map((r) => ({
                  fecha: r.createdAt,
                  usuario: r.username,
                  accion: r.action,
                  entidad: r.entity,
                  registro: r.entityId,
                  detalle: r.details,
                  ip: r.ipAddress,
                })),
                [
                  { key: 'fecha', label: 'Fecha' },
                  { key: 'usuario', label: 'Usuario' },
                  { key: 'accion', label: 'Acción' },
                  { key: 'entidad', label: 'Entidad' },
                  { key: 'registro', label: 'Registro' },
                  { key: 'detalle', label: 'Detalle' },
                  { key: 'ip', label: 'IP' },
                ],
              )
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ⬇ CSV / Excel
          </button>
          <PrintButton />
        </>
      }
    >
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Acción</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Entidad</label>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {!loaded && !error ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <>
          <ReportTable columns={columns} rows={items} getRowKey={(r) => r.id} pageSize={100} />
          <div className="no-print mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Mostrando {items.length} de {total} registros (los más recientes primero).
            </p>
            {items.length < total && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
            )}
          </div>
        </>
      )}
    </ReportLayout>
  )
}
