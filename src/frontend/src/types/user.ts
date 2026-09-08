export type UserRole = 'admin' | 'basico'

export type ManagedUser = {
  id: number
  username: string
  email: string | null
  displayName: string | null
  role: UserRole
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  basico: 'Básico',
}
