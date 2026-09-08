export type ParameterCategory = {
  code: string
  name: string
  description: string | null
  usedIn: string | null
  createdAt: string
}

export type Parameter = {
  id: number
  categoryCode: string
  code: string
  label: string
  sortOrder: number
  isActive: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string | null
}
