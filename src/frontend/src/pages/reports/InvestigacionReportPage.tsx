import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { RUN_STATUS_LABELS, type SyncRun } from '../../types/importSync'

// Reporte de corridas del motor genérico (GET /import-sync/runs) -- hoy la única fuente real que
// escribe acá es el Motor de Investigación histórica (código 'historical_research'), tras la
// eliminación de los conectores legado (RSSSF/TheSportsDB/Ltrack/archivo). Se mantiene el mismo
// endpoint/tabla (sync_runs es infraestructura genérica, no específica de ningún conector) --
// sólo cambia el enfoque de la pantalla, de "Importaciones" a "Investigación".
export default function InvestigacionReportPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<SyncRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<SyncRun[]>('/import-sync/runs')
      .then(setRuns)
      .catch(() => setError('No se pudo cargar el historial de investigación (requiere rol administrador)'))
      .finally(() => setLoading(false))
  }, [])

  const columns: ReportColumn<SyncRun>[] = [
    { key: 'date', label: 'Fecha', render: (r) => new Date(r.createdAt).toLocaleString('es-PY'), sortValue: (r) => r.createdAt },
    { key: 'source', label: 'Fuente', render: (r) => r.sourceCode + (r.isSimulation ? ' (simulación)' : '') },
    { key: 'admin', label: 'Administrador', render: (r) => r.startedByUsername },
    { key: 'status', label: 'Estado', render: (r) => RUN_STATUS_LABELS[r.status], sortValue: (r) => r.status },
    { key: 'analyzed', label: 'Analizados', render: (r) => r.totalAnalyzed, sortValue: (r) => r.totalAnalyzed },
    { key: 'new', label: 'Nuevos', render: (r) => r.totalNew, sortValue: (r) => r.totalNew },
    { key: 'updated', label: 'Actualizados', render: (r) => r.totalUpdated },
    { key: 'unchanged', label: 'Sin cambios', render: (r) => r.totalUnchanged },
    { key: 'conflicts', label: 'Conflictos', render: (r) => r.totalConflicts, sortValue: (r) => r.totalConflicts },
    { key: 'errors', label: 'Errores', render: (r) => r.totalErrors, sortValue: (r) => r.totalErrors },
  ]

  if (error) return <p className="p-6 text-red-600">{error}</p>

  return (
    <ReportLayout
      title="Reporte de Investigación"
      subtitle="Historial de corridas del Motor de Investigación histórica. Click en una fila para ver conflictos/errores detallados en Seguridad."
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'investigacion.csv',
                runs.map((r) => ({
                  fecha: r.createdAt,
                  fuente: r.sourceCode,
                  admin: r.startedByUsername,
                  estado: r.status,
                  analizados: r.totalAnalyzed,
                  nuevos: r.totalNew,
                  actualizados: r.totalUpdated,
                  sinCambios: r.totalUnchanged,
                  conflictos: r.totalConflicts,
                  errores: r.totalErrors,
                  duracionSegundos:
                    r.startedAt && r.finishedAt
                      ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
                      : '',
                })),
                [
                  { key: 'fecha', label: 'Fecha' },
                  { key: 'fuente', label: 'Fuente' },
                  { key: 'admin', label: 'Administrador' },
                  { key: 'estado', label: 'Estado' },
                  { key: 'analizados', label: 'Analizados' },
                  { key: 'nuevos', label: 'Nuevos' },
                  { key: 'actualizados', label: 'Actualizados' },
                  { key: 'sinCambios', label: 'Sin cambios' },
                  { key: 'conflictos', label: 'Conflictos' },
                  { key: 'errores', label: 'Errores' },
                  { key: 'duracionSegundos', label: 'Duración (s)' },
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
      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <ReportTable
          columns={columns}
          rows={runs}
          getRowKey={(r) => r.id}
          onRowClick={() => navigate('/seguridad?tab=investigacion')}
          emptyMessage="Todavía no se ejecutó ninguna corrida de investigación."
        />
      )}
    </ReportLayout>
  )
}
