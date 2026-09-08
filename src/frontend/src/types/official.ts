export type OfficialType = {
  id: number
  name: string
  status: 'active' | 'inactive'
  sortOrder: number
  createdAt: string
}

export type Official = {
  id: number
  firstName: string
  lastName: string
  fullName: string
  dateOfBirth: string | null
  nationality: string | null
  city: string | null
  officialTypeId: number | null
  officialTypeName?: string | null
  status: 'active' | 'inactive'
  photoUrl: string | null
  dataOrigin: string
  externalSource: string | null
  externalId: string | null
  externalUrl: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string | null
}

export type OfficialInput = {
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  nationality?: string | null
  city?: string | null
  officialTypeId?: number | null
  status?: 'active' | 'inactive'
  photoUrl?: string | null
}

export type OfficialListResponse = {
  items: Official[]
  total: number
  page: number
  pageSize: number
}

export type OfficialDuplicateMatch = {
  id: number
  fullName: string
  dateOfBirth: string | null
  nationality: string | null
  officialTypeName: string | null
}
