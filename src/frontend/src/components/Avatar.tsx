import { resolveAssetUrl } from '../lib/assetUrl'

// Compartido entre Jugadores, Oficiales y cualquier otra entidad con foto opcional — mismo
// mecanismo de upload (multer + /uploads/<módulo>/...) en todos los casos.
export default function Avatar({
  photoUrl,
  alt,
  size = 40,
}: {
  photoUrl: string | null | undefined
  alt: string
  size?: number
}) {
  const url = resolveAssetUrl(photoUrl)
  if (url) {
    return (
      <img src={url} alt={alt} className="rounded-full object-cover" style={{ width: size, height: size }} />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-slate-200 text-slate-500"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden
    >
      👤
    </div>
  )
}
