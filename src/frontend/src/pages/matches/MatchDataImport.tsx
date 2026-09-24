import { useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { parseCsv } from '../../lib/csv'
import { api } from '../../services/api'
import type { Match } from '../../types/match'

/**
 * Importación masiva de datos avanzados del partido (xG/métricas, posiciones para mapa de calor y
 * datos físicos GPS).
 *
 * Estas tres tablas existían en el esquema pero no tenían forma de cargarse. Su volumen —un partido
 * con muestreo por minuto ronda las 2.000 posiciones— descarta la carga a mano, así que se pegan o
 * se sube el CSV que exporta el proveedor.
 *
 * El backend valida que cada jugador haya jugado el partido y deriva su equipo de la alineación;
 * si alguno no figura, rechaza el lote entero indicando cuáles (no importa a medias).
 */
type Kind = 'metrics' | 'positions' | 'physical'

const KINDS: {
  key: Kind
  label: string
  endpoint: string
  columns: string
  help: string
  build: (r: Record<string, string>) => Record<string, unknown> | null
}[] = [
  {
    key: 'metrics',
    label: 'Métricas avanzadas (xG, xA, PPDA…)',
    endpoint: 'advanced-metrics',
    columns: 'playerId,teamId,metricName,metricValue,provider,modelVersion',
    help: 'Cada fila es una métrica de UN jugador o de UN equipo. Dejá vacía la columna que no corresponda.',
    build: (r) => {
      if (!r.metricname || r.metricvalue === '') return null
      return {
        playerId: r.playerid ? Number(r.playerid) : null,
        teamId: r.teamid ? Number(r.teamid) : null,
        metricName: r.metricname,
        metricValue: Number(r.metricvalue),
        provider: r.provider || null,
        modelVersion: r.modelversion || null,
      }
    },
  },
  {
    key: 'positions',
    label: 'Posiciones (mapa de calor)',
    endpoint: 'player-positions',
    columns: 'playerId,period,minute,posX,posY,weight,source',
    help: 'Coordenadas 0-100 en ambos ejes. Reemplaza las posiciones ya cargadas para este partido.',
    build: (r) => {
      if (!r.playerid || r.posx === '' || r.posy === '') return null
      return {
        playerId: Number(r.playerid),
        period: r.period || null,
        minute: r.minute ? Number(r.minute) : null,
        posX: Number(r.posx),
        posY: Number(r.posy),
        weight: r.weight ? Number(r.weight) : null,
        source: r.source || null,
      }
    },
  },
  {
    key: 'physical',
    label: 'Datos físicos (GPS)',
    endpoint: 'player-physical',
    columns: 'playerId,distanceKm,topSpeedKmh,sprintsCount,accelerations,decelerations,dataSource',
    help: 'Una fila por jugador. Actualiza los datos ya cargados, sin borrar el resto.',
    build: (r) => {
      if (!r.playerid) return null
      const num = (v: string) => (v === '' || v == null ? null : Number(v))
      return {
        playerId: Number(r.playerid),
        distanceKm: num(r.distancekm),
        topSpeedKmh: num(r.topspeedkmh),
        stepsCount: num(r.stepscount),
        sprintsCount: num(r.sprintscount),
        accelerations: num(r.accelerations),
        decelerations: num(r.decelerations),
        walkDistanceKm: num(r.walkdistancekm),
        jogDistanceKm: num(r.jogdistancekm),
        runDistanceKm: num(r.rundistancekm),
        sprintDistanceKm: num(r.sprintdistancekm),
        dataSource: r.datasource || null,
      }
    },
  },
]

export default function MatchDataImport({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const [kind, setKind] = useState<Kind>('metrics')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const config = KINDS.find((k) => k.key === kind)!
  const parsed = text.trim() ? parseCsv(text).map(config.build).filter((r): r is Record<string, unknown> => r != null) : []

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const submit = async () => {
    if (parsed.length === 0) return
    setBusy(true)
    setResult(null)
    try {
      const res = await api.post<{ imported: number; replaced: boolean }>(
        `/matches/${match.id}/import/${config.endpoint}`,
        { rows: parsed },
      )
      setResult(
        `${res.imported} fila(s) importada(s)${res.replaced ? ' (reemplazaron las anteriores)' : ' (actualizadas)'}.`,
      )
      setText('')
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al importar los datos')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">
        Pegá el CSV del proveedor o subí el archivo. Se valida que cada jugador haya jugado este
        partido; si alguno no figura en la alineación se rechaza el lote completo.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => {
              setKind(k.key)
              setResult(null)
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              kind === k.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className="mb-1 text-xs text-slate-500">{config.help}</p>
      <p className="mb-2 overflow-x-auto rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
        {config.columns}
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setResult(null)
        }}
        rows={6}
        placeholder={config.columns}
        aria-label="Contenido CSV"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
          }}
          aria-label="Archivo CSV"
          className="text-xs text-slate-600 file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || parsed.length === 0}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {busy ? 'Importando...' : `Importar ${parsed.length || ''} fila(s)`}
        </button>
        {text.trim() && parsed.length === 0 && (
          <span className="text-xs text-amber-600">
            No se reconoció ninguna fila válida: revisá que el encabezado tenga las columnas indicadas.
          </span>
        )}
        {result && <span className="text-xs text-emerald-600">{result}</span>}
      </div>
    </div>
  )
}
