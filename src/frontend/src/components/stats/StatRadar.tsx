import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'

export type RadarPoint = {
  attribute: string
  a: number | null
  b?: number | null
}

// Radar genérico de atributos (0-100) -- usado para valoraciones de videojuego (PAC/SHO/PAS/DRI/
// DEF/PHY) y cualquier otro set de atributos numéricos 0-100 que se quiera comparar visualmente.
// Nunca inventa un valor: un punto sin dato real en NINGÚN lado no debería llegar acá (filtrar antes).
export default function StatRadar({
  data,
  labelA,
  labelB,
  colorA = '#2563eb',
  colorB = '#dc2626',
  maxValue = 100,
}: {
  data: RadarPoint[]
  labelA: string
  labelB?: string
  colorA?: string
  colorB?: string
  maxValue?: number
}) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Sin atributos disponibles para visualizar todavía.</p>
  }

  const chartData = data.map((d) => ({ attribute: d.attribute, [labelA]: d.a ?? 0, ...(labelB ? { [labelB]: d.b ?? 0 } : {}) }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={chartData} outerRadius="75%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 11, fill: '#475569' }} />
        <PolarRadiusAxis angle={90} domain={[0, maxValue]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
        <Radar name={labelA} dataKey={labelA} stroke={colorA} fill={colorA} fillOpacity={0.35} />
        {labelB && <Radar name={labelB} dataKey={labelB} stroke={colorB} fill={colorB} fillOpacity={0.25} />}
      </RadarChart>
    </ResponsiveContainer>
  )
}
