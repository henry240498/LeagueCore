import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginVisual from '../components/LoginVisual'
// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
import DevCredentialsPanel from '../components/DevCredentialsPanel'
import { ApiError, useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { DEFAULT_LOGIN_SETTINGS } from '../defaultLoginSettings'
import type { LoginSettings } from '../types/loginSettings'

export default function LoginPage() {
  const [settings, setSettings] = useState<LoginSettings>(DEFAULT_LOGIN_SETTINGS)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<LoginSettings>('/settings/login')
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_LOGIN_SETTINGS))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(username, password)
      navigate(result.passwordTempReset ? '/cambiar-contrasena' : '/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <LoginVisual
        settings={settings}
        username={username}
        password={password}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
        error={error}
        loading={loading}
        interactive
      />
      {/* DEV-ONLY: panel oculto de credenciales de prueba. Eliminado del bundle en producción
          porque import.meta.env.DEV es false. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md */}
      {import.meta.env.DEV && (
        <DevCredentialsPanel
          onPick={(u, p) => {
            setUsername(u)
            setPassword(p)
          }}
        />
      )}
    </>
  )
}
