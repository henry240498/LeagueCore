export type Competition = {
  id: number
  name: string
  description: string | null
  competitionType: string | null
  sport: string
  country: string | null
  status: 'active' | 'inactive'
  startDate: string | null
  endDate: string | null
  organization: string | null
  logoUrl: string | null
  observations: string | null
  seasonYear: number | null
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  autoPromotionSlots: number
  autoRelegationSlots: number
  promotionPlayoffSlots: number
  relegationPlayoffSlots: number
  matchDurationMinutes: number
  periodsPerMatch: number
  createdAt: string
  updatedAt: string | null
}

export type CompetitionInput = Partial<
  Omit<Competition, 'id' | 'createdAt' | 'updatedAt' | 'sport' | 'status'>
> & {
  name: string
  sport?: string
  status?: 'active' | 'inactive'
}
