// Compartido entre Jugadores, Oficiales y cualquier otra entidad con el mismo estado
// activo/inactivo (misma filosofía que Competiciones/Equipos).
export default function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  )
}
