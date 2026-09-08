export type Venue = {
  id: number
  name: string
  city: string | null
  country: string | null
  capacity: number | null
  openedYear: number | null
  photoUrl: string | null
  createdAt: string
}

export type VenueInput = {
  name: string
  city?: string | null
  country?: string | null
  capacity?: number | null
  openedYear?: number | null
}
