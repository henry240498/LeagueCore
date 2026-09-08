import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function ChangePasswordFirstLoginPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { clearPasswordTempReset } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password-first-login', { newPassword })
      clearPasswordTempReset()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl sm:p-8">
        <h2 className="mb-2 text-2xl font-bold">🔐 Cambiar contraseña</h2>
        <p className="mb-6 text-slate-600">
          Este es tu primer inicio de sesión. Debés establecer una nueva contraseña antes de
          continuar.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="newPassword" className="mb-2 block text-sm font-medium">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-600">
            <p>✓ Mínimo 8 caracteres</p>
            <p>✓ Incluir mayúscula (A-Z)</p>
            <p>✓ Incluir minúscula (a-z)</p>
            <p>✓ Incluir número (0-9)</p>
            <p>✓ Incluir carácter especial (@$!%*?&amp;, etc.)</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
