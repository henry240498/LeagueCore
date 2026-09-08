export type AttributeCategory = {
  code: string
  nameEs: string
  playerType: 'field' | 'goalkeeper'
  sortOrder: number
  score?: number
}

export type DetailedAttribute = {
  code: string
  nameSource: string | null
  value: number | null
  categoryCode: string | null
}

export type VideogameRating = {
  id: number
  playerId: number
  videogameId: number
  videogameName: string
  editionId: number
  editionName: string
  year: number
  overallRating: number | null
  cardVariant: string
  positionIngame: string | null
  sourceName: string
  sourceUrl: string
  retrievedAt: string | null
  categories: AttributeCategory[]
  detailedAttributes: DetailedAttribute[]
}

export type Videogame = {
  id: number
  name: string
  publisher: string | null
  status: string
}
