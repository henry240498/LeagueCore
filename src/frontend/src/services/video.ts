import { api } from './api'
import type { MatchVideo, SyncTimeline, VideoClip, VideoMarker, VideoTag } from '../types/video'

export const videoService = {
  listVideos: (matchId?: number) =>
    api.get<MatchVideo[]>(`/video/videos${matchId ? `?matchId=${matchId}` : ''}`),
  createVideo: (data: { matchId?: number; title: string; kind?: string; videoUrl?: string }) =>
    api.post<MatchVideo>('/video/videos', data),
  updateVideo: (id: number, data: Partial<MatchVideo>) => api.put<MatchVideo>(`/video/videos/${id}`, data),
  removeVideo: (id: number) => api.delete<{ message: string }>(`/video/videos/${id}`),
  uploadFile: (id: number, file: File) => api.upload<MatchVideo>(`/video/videos/${id}/file`, file),

  listTags: () => api.get<VideoTag[]>('/video/tags'),
  createTag: (data: { code: string; label: string }) => api.post<{ id: number }>('/video/tags', data),
  removeTag: (id: number) => api.delete<{ message: string }>(`/video/tags/${id}`),

  listMarkers: (videoId: number) => api.get<VideoMarker[]>(`/video/videos/${videoId}/markers`),
  createMarker: (videoId: number, data: { timeSeconds: number; tagCode?: string; note?: string; favorite?: boolean }) =>
    api.post<{ id: number }>(`/video/videos/${videoId}/markers`, data),
  toggleFavorite: (videoId: number, markerId: number) =>
    api.patch<{ message: string }>(`/video/videos/${videoId}/markers/${markerId}/favorite`),
  removeMarker: (videoId: number, markerId: number) =>
    api.delete<{ message: string }>(`/video/videos/${videoId}/markers/${markerId}`),

  listClips: (videoId: number) => api.get<VideoClip[]>(`/video/videos/${videoId}/clips`),
  createClip: (videoId: number, data: { title: string; startSeconds: number; endSeconds: number; description?: string }) =>
    api.post<{ id: number }>(`/video/videos/${videoId}/clips`, data),
  removeClip: (videoId: number, clipId: number) =>
    api.delete<{ message: string }>(`/video/videos/${videoId}/clips/${clipId}`),

  getSync: (matchId: number, videoId: number) =>
    api.get<SyncTimeline>(`/video/matches/${matchId}/sync?videoId=${videoId}`),
}
