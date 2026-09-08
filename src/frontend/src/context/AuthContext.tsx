import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '../services/api'

export type User = {
  id: number
  username: string
  email: string | null
  displayName: string | null
  role: string
  forcePasswordChangeOnReset: boolean
}

type LoginResponse = {
  token: string
  user: User
  passwordTempReset: boolean
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  passwordTempReset: boolean
  login: (username: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  clearPasswordTempReset: () => void
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordTempReset, setPasswordTempReset] = useState(false)

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const result = await api.post<LoginResponse>('/auth/login', { username, password })
    setUser(result.user)
    setPasswordTempReset(result.passwordTempReset)
    return result
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // si el token ya venció, igual limpiamos el estado local
    }
    setUser(null)
    setPasswordTempReset(false)
  }

  const clearPasswordTempReset = () => setPasswordTempReset(false)

  const refreshUser = async () => {
    const result = await api.get<User>('/auth/me')
    setUser(result)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        passwordTempReset,
        login,
        logout,
        clearPasswordTempReset,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

export { ApiError }
