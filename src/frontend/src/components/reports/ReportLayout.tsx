import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { api } from '../../services/api'

type Identity = { systemName: string; logoMainUrl: string | null }

// §25 pedía reusar "Organización Institucional -> Configuración de Documentos" si ya existiera --
// ese módulo nunca se construyó en LeagueCore. Lo más cercano que sí existe y ya tiene datos reales
// cargados por el admin es dbo.login_settings (nombre del sistema + logo), así que el encabezado
// impreso reusa eso en vez de crear un segundo lugar para configurar la identidad institucional.
function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  useEffect(() => {
    api
      .get<Identity>('/settings/login')
      .then((s) => setIdentity({ systemName: s.systemName, logoMainUrl: s.logoMainUrl }))
      .catch(() => setIdentity({ systemName: 'LeagueCore', logoMainUrl: null }))
  }, [])
  return identity
}

// Envoltorio compartido por TODO reporte (§24/§25/§53/§54): header con logo/nombre del sistema +
// título + filtros aplicados + usuario/fecha de generación, y una hoja de estilos @media print que
// oculta navegación/botones/filtros -- así "Previsualizar" y "PDF" son literalmente la misma vista:
// el botón de PDF sólo dispara window.print(), que en cualquier navegador moderno ofrece "Guardar
// como PDF" como destino. Evita agregar una librería de generación de PDF nueva (jspdf/puppeteer)
// cuando el propio navegador ya resuelve preview + export con fidelidad real del layout.
export default function ReportLayout({
  title,
  subtitle,
  filterSummary,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  filterSummary?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const identity = useIdentity()
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white !important; }
          .print-header { display: flex !important; }
        }
      `}</style>

      <div className="print-header mb-6 hidden items-center justify-between border-b-2 border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          {identity?.logoMainUrl && (
            <img src={resolveAssetUrl(identity.logoMainUrl)} alt="" className="h-12 w-12 object-contain" />
          )}
          <div>
            <p className="text-lg font-bold text-slate-900">{identity?.systemName ?? 'LeagueCore'}</p>
            <p className="text-sm text-slate-600">{title}</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Generado: {new Date().toLocaleString('es-PY')}</p>
          <p>Por: {user?.displayName || user?.username}</p>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {filterSummary && (
        <p className="mb-4 hidden text-xs text-slate-500 print:block">Filtros aplicados: {filterSummary}</p>
      )}

      {children}

      <p className="mt-8 hidden border-t border-slate-300 pt-2 text-center text-xs text-slate-400 print:block">
        {identity?.systemName ?? 'LeagueCore'} — Reporte generado automáticamente
      </p>
    </div>
  )
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      🖨️ Imprimir / PDF
    </button>
  )
}
