import { useState } from 'react'
import FootballPitch, { dataYToSvg } from './FootballPitch'
import type { BoardDiagram } from '../types/tactics'

let tokenSeq = 0
const newTokenId = () => `t${Date.now()}_${(tokenSeq += 1)}`

// Pizarra táctica: colocar/mover jugadores, dibujar flechas de movimiento, guardar el diagrama
// como JSON (tactical_plays.diagram_json). Reutiliza FootballPitch (coordenadas 0-100).
export default function TacticalBoard({
  initial,
  onChange,
}: {
  initial?: BoardDiagram | null
  onChange?: (diagram: BoardDiagram) => void
}) {
  const [tokens, setTokens] = useState<BoardDiagram['tokens']>(initial?.tokens ?? [])
  const [arrows, setArrows] = useState<BoardDiagram['arrows']>(initial?.arrows ?? [])
  const [mode, setMode] = useState<'move' | 'add' | 'arrow'>('move')
  const [arrowFrom, setArrowFrom] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const emit = (nextTokens: BoardDiagram['tokens'], nextArrows: BoardDiagram['arrows']) => {
    setTokens(nextTokens)
    setArrows(nextArrows)
    onChange?.({ tokens: nextTokens, arrows: nextArrows })
  }

  const svgPos = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    // El svg interno de FootballPitch maneja su propio click; acá convertimos igual (viewBox 100x150)
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = (((e.clientY - rect.top) / rect.height) * 150) / 1.5
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  const handlePitchClick = (x: number, y: number) => {
    if (mode !== 'add') return
    const n = tokens.length + 1
    emit([...tokens, { id: newTokenId(), label: `J${n}`, x: Math.round(x), y: Math.round(y) }], arrows)
  }

  const handleTokenClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (mode === 'arrow') {
      if (!arrowFrom) {
        setArrowFrom(id)
      } else if (arrowFrom !== id) {
        emit(tokens, [...arrows, { from: arrowFrom, to: id }])
        setArrowFrom(null)
      }
      return
    }
    setSelected(id)
  }

  const moveDragged = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragId) return
    const { x, y } = svgPos(e)
    setTokens((ts) => ts.map((t) => (t.id === dragId ? { ...t, x: Math.round(x), y: Math.round(y) } : t)))
  }

  const endDrag = () => {
    if (dragId) {
      setDragId(null)
      onChange?.({ tokens, arrows })
    }
  }

  const tokenById = (id: string) => tokens.find((t) => t.id === id)

  const modeBtn = (key: typeof mode, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        setMode(key)
        setArrowFrom(null)
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        mode === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {modeBtn('move', '✥ Mover')}
        {modeBtn('add', '+ Jugador')}
        {modeBtn('arrow', '➔ Flecha')}
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            emit(
              tokens.filter((t) => t.id !== selected),
              arrows.filter((a) => a.from !== selected && a.to !== selected),
            )
            setSelected(null)
          }}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-slate-200 disabled:opacity-40"
        >
          Quitar seleccionado
        </button>
        <button
          type="button"
          disabled={arrows.length === 0}
          onClick={() => emit(tokens, [])}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-40"
        >
          Limpiar flechas ({arrows.length})
        </button>
        {mode === 'arrow' && arrowFrom && (
          <span className="text-xs text-amber-700">Origen: {tokenById(arrowFrom)?.label} → tocá el destino</span>
        )}
      </div>
      <div onPointerMove={moveDragged} onPointerUp={endDrag} onPointerLeave={endDrag}>
        <FootballPitch onPitchClick={handlePitchClick}>
          {arrows.map((a, i) => {
            const from = tokenById(a.from)
            const to = tokenById(a.to)
            if (!from || !to) return null
            return (
              <line
                key={i}
                x1={from.x}
                y1={dataYToSvg(from.y)}
                x2={to.x}
                y2={dataYToSvg(to.y)}
                stroke="#f59e0b"
                strokeWidth={0.8}
                markerEnd="url(#tboard-arrow)"
              />
            )
          })}
          <defs>
            <marker id="tboard-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill="#f59e0b" />
            </marker>
          </defs>
          {tokens.map((t) => (
            <g
              key={t.id}
              transform={`translate(${t.x}, ${dataYToSvg(t.y)})`}
              onClick={(e) => handleTokenClick(e, t.id)}
              onPointerDown={(e) => {
                if (mode !== 'move') return
                e.stopPropagation()
                ;(e.target as Element).setPointerCapture?.(e.pointerId)
                setDragId(t.id)
                setSelected(t.id)
              }}
              style={{ cursor: mode === 'move' ? 'grab' : 'pointer' }}
            >
              <circle
                r={3.2}
                fill={t.color ?? '#2563eb'}
                stroke={selected === t.id || arrowFrom === t.id ? '#fbbf24' : 'white'}
                strokeWidth={0.6}
              />
              <text textAnchor="middle" dy={1.2} fontSize={2.6} fontWeight="bold" fill="white">
                {t.label}
              </text>
            </g>
          ))}
        </FootballPitch>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {tokens.length} jugadores · {arrows.length} movimientos. El diagrama se guarda con la jugada.
      </p>
    </div>
  )
}
