import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { videoService } from '../../services/video'
import type { Match } from '../../types/match'
import {
  DEFAULT_TAGS,
  SPEEDS,
  VIDEO_KIND_LABELS,
  type MatchVideo,
  type SyncTimeline,
  type VideoClip,
  type VideoMarker,
  type VideoTag,
} from '../../types/video'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

const fmt = (s: number) => {
  const total = Math.max(0, Math.floor(s))
  const m = Math.floor(total / 60)
  const sec = String(total % 60).padStart(2, '0')
  return `${String(m).padStart(2, '0')}:${sec}`
}

export default function MatchVideoTab({
  match,
  onError,
}: {
  match: Match
  onError: (msg: string) => void
}) {
  const matchId = match.id
  const [videos, setVideos] = useState<MatchVideo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [markers, setMarkers] = useState<VideoMarker[]>([])
  const [clips, setClips] = useState<VideoClip[]>([])
  const [tags, setTags] = useState<VideoTag[]>([])
  const [sync, setSync] = useState<SyncTimeline | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState(1)

  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [markerTag, setMarkerTag] = useState('')
  const [markerNote, setMarkerNote] = useState('')
  const [clipTitle, setClipTitle] = useState('')
  const [clipStart, setClipStart] = useState('')
  const [clipEnd, setClipEnd] = useState('')

  const fail = useCallback(
    (err: unknown, fallback: string) => onError(err instanceof ApiError ? err.message : fallback),
    [onError],
  )

  const loadVideos = useCallback(() => {
    videoService
      .listVideos(matchId)
      .then((list) => {
        setVideos(list)
        setSelectedId((prev) => prev ?? list[0]?.id ?? null)
      })
      .catch((e) => fail(e, 'Error al cargar videos'))
    videoService.listTags().then(setTags).catch(() => {})
  }, [matchId, fail])

  const loadDetail = useCallback(
    (videoId: number) => {
      videoService.listMarkers(videoId).then(setMarkers).catch(() => {})
      videoService.listClips(videoId).then(setClips).catch(() => {})
      videoService.getSync(matchId, videoId).then(setSync).catch(() => setSync(null))
    },
    [matchId],
  )

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else {
      setMarkers([])
      setClips([])
      setSync(null)
    }
  }, [selectedId, loadDetail])

  const selected = videos.find((v) => v.id === selectedId) ?? null

  const seek = (seconds: number) => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = Math.max(0, seconds)
    el.play().catch(() => {})
  }

  const handleSpeed = (s: number) => {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  const handleCreateVideo = async () => {
    if (!newTitle.trim()) return
    try {
      const created = await videoService.createVideo({
        matchId,
        title: newTitle.trim(),
        kind: 'PARTIDO_COMPLETO',
        videoUrl: newUrl.trim() || undefined,
      })
      setNewTitle('')
      setNewUrl('')
      loadVideos()
      setSelectedId(created.id)
    } catch (err) {
      fail(err, 'Error al crear')
    }
  }

  const handleUpload = async (file: File) => {
    if (!selected) return
    try {
      const updated = await videoService.uploadFile(selected.id, file)
      setVideos((vs) => vs.map((v) => (v.id === updated.id ? { ...v, videoUrl: updated.videoUrl } : v)))
    } catch (err) {
      fail(err, 'Error al subir')
    }
  }

  const handleAddMarker = async () => {
    if (!selected) return
    try {
      await videoService.createMarker(selected.id, {
        timeSeconds: Math.floor(currentTime),
        tagCode: markerTag || undefined,
        note: markerNote || undefined,
      })
      setMarkerNote('')
      loadDetail(selected.id)
    } catch (err) {
      fail(err, 'Error al marcar')
    }
  }

  const handleAddClip = async () => {
    if (!selected || !clipTitle.trim() || !clipStart || !clipEnd) return
    try {
      await videoService.createClip(selected.id, {
        title: clipTitle.trim(),
        startSeconds: Number(clipStart),
        endSeconds: Number(clipEnd),
      })
      setClipTitle('')
      setClipStart('')
      setClipEnd('')
      loadDetail(selected.id)
    } catch (err) {
      fail(err, 'Error al guardar el clip')
    }
  }

  const ensureDefaults = async () => {
    const existing = new Set(tags.map((t) => t.code))
    for (const code of DEFAULT_TAGS) {
      if (!existing.has(code)) {
        try {
          await videoService.createTag({ code, label: code.toLowerCase().replace(/_/g, ' ') })
        } catch {
          // otro operador pudo crearla en paralelo
        }
      }
    }
    videoService.listTags().then(setTags).catch(() => {})
  }

  const visibleMarkers = onlyFavorites ? markers.filter((m) => m.favorite) : markers

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-bold">🎬 Videos del partido</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título (Partido completo…)" className={`${inputClass} min-w-[200px] flex-1`} />
          <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="URL (https://…)" className={`${inputClass} min-w-[200px] flex-1`} />
          <button type="button" onClick={handleCreateVideo} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Agregar
          </button>
        </div>
        {videos.length === 0 ? (
          <p className="text-sm text-slate-500">Sin videos. Agregá el partido completo, un entrenamiento o un fragmento.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {videos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm ${
                  v.id === selectedId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="font-medium">{v.title}</span>
                <span className="block text-xs opacity-70">
                  {VIDEO_KIND_LABELS[v.kind]} · {v.markersCount} marcas · {v.clipsCount} clips
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <>
          <section className="rounded-lg bg-white p-6 shadow">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{selected.title}</h2>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                📤 Subir archivo
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {resolveAssetUrl(selected.videoUrl) ? (
              <>
                <video
                  ref={videoRef}
                  src={resolveAssetUrl(selected.videoUrl) ?? undefined}
                  controls
                  className="w-full rounded-lg bg-black"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => {
                    e.currentTarget.playbackRate = speed
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-800">{fmt(currentTime)}</span>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSpeed(s)}
                      className={`rounded-lg px-2 py-1 font-mono text-xs ${
                        speed === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                  <span className="text-xs text-slate-500">0.25x–2x para análisis cuadro por cuadro</span>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                Sin archivo ni URL: subí el video o pegá una URL editando el registro. Los eventos del sync igual funcionan por minuto.
              </p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg bg-white p-6 shadow">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">📌 Timeline ({visibleMarkers.length})</h2>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={onlyFavorites} onChange={(e) => setOnlyFavorites(e.target.checked)} />
                  Solo favoritos
                </label>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <select value={markerTag} onChange={(e) => setMarkerTag(e.target.value)} className={inputClass}>
                  <option value="">Etiqueta…</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input value={markerNote} onChange={(e) => setMarkerNote(e.target.value)} placeholder={`Nota @ ${fmt(currentTime)}`} className={`${inputClass} min-w-[140px] flex-1`} />
                <button type="button" onClick={handleAddMarker} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Marcar aquí
                </button>
              </div>
              {tags.length === 0 && (
                <button type="button" onClick={ensureDefaults} className="mb-3 text-xs text-blue-600 hover:underline">
                  Cargar etiquetas por defecto (Gol, Presión, Recuperación…)
                </button>
              )}
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto text-sm">
                {visibleMarkers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                    <button type="button" onClick={() => seek(m.timeSeconds)} className="flex-1 text-left hover:underline">
                      <span className="font-mono font-bold text-blue-700">{m.timestamp}</span>{' '}
                      {m.tagLabel ?? 'Marcador'}
                      {m.note ? <span className="text-slate-500"> · {m.note}</span> : null}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await videoService.toggleFavorite(selected.id, m.id)
                        loadDetail(selected.id)
                      }}
                      className="text-amber-500 hover:scale-110"
                      title="Favorito"
                    >
                      {m.favorite ? '★' : '☆'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await videoService.removeMarker(selected.id, m.id)
                        loadDetail(selected.id)
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              {visibleMarkers.length === 0 && <p className="text-sm text-slate-500">Sin marcas. Pausá el video y marcá el momento.</p>}
            </section>

            <div className="space-y-6">
              <section className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-3 text-lg font-bold">✂️ Clips ({clips.length})</h2>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <input value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} placeholder="Título del clip" className={`${inputClass} col-span-2`} />
                  <input value={clipStart} onChange={(e) => setClipStart(e.target.value)} placeholder={`Inicio (seg, ahora ${Math.floor(currentTime)})`} type="number" className={inputClass} />
                  <input value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} placeholder="Fin (seg)" type="number" className={inputClass} />
                  <div className="col-span-2 flex gap-2">
                    <button type="button" onClick={() => setClipStart(String(Math.floor(currentTime)))} className="flex-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-200">
                      Inicio = ahora
                    </button>
                    <button type="button" onClick={() => setClipEnd(String(Math.floor(currentTime)))} className="flex-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-200">
                      Fin = ahora
                    </button>
                    <button type="button" onClick={handleAddClip} className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      Guardar clip
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 text-sm">
                  {clips.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                      <button type="button" onClick={() => seek(c.startSeconds)} className="flex-1 text-left hover:underline">
                        <span className="font-medium">{c.title}</span>{' '}
                        <span className="font-mono text-xs text-slate-500">
                          {c.startTimestamp} → {c.endTimestamp}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await videoService.removeClip(selected.id, c.id)
                          loadDetail(selected.id)
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-lg bg-white p-6 shadow">
                <h2 className="mb-1 text-lg font-bold">🔗 Sync estadística ↔ video</h2>
                <p className="mb-3 text-xs text-slate-500">Tocá un evento y el video salta al momento exacto.</p>
                {!sync || sync.items.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin eventos sincronizables todavía.</p>
                ) : (
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
                    {sync.items.map((item, i) => (
                      <li key={`${item.ref}-${i}`} className="py-1.5">
                        {item.timeSeconds !== null ? (
                          <button type="button" onClick={() => seek(item.timeSeconds as number)} className="text-left hover:underline">
                            <span className="font-mono font-bold text-blue-700">{item.timestamp}</span> {item.label}
                          </button>
                        ) : (
                          <span className="text-slate-500">
                            --:-- {item.label} (sin minuto)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
