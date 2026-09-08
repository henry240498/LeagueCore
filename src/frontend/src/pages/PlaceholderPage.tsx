export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <p className="text-slate-600">Este módulo todavía no está construido.</p>
    </div>
  )
}
