export type TeamCompetitionHistoryEntry = {
  competitionId: number
  competitionName: string
  country: string | null
  seasons: { seasonId: number; label: string; startYear: number; endYear: number }[]
}

export type Team = {
  id: number
  // Un club es una entidad independiente -- ya no pertenece a una sola competición (corrección
  // arquitectónica). competitionId/competitionName quedan como dato de RESPALDO legado (algunos
  // equipos reales todavía no tienen ninguna participación real cargada en season_teams) -- la
  // fuente real de "en qué compite" es GET /teams/:id/competitions-history.
  competitionId: number | null
  competitionName?: string | null
  venueId: number | null
  name: string
  city: string | null
  country: string | null
  foundedYear: number | null
  managerName: string | null
  managerSince: string | null
  note: string | null
  logoUrl: string | null
  status: 'active' | 'inactive'
  addedPoints: number
  clubId: number | null
  category: string | null
  createdAt: string
  updatedAt: string | null
}

export type TeamInput = Partial<
  Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'competitionName' | 'status'>
> & {
  name: string
  status?: 'active' | 'inactive'
}
