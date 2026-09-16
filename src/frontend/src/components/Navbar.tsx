import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GlobalSearch from './GlobalSearch'

type NavItem = { to: string; label: string }
type NavGroup = { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    label: 'Gestión',
    items: [
      { to: '/clubes', label: 'Clubes' },
      { to: '/competiciones', label: 'Competiciones' },
      { to: '/temporadas', label: 'Temporadas' },
      { to: '/equipos', label: 'Equipos' },
      { to: '/jugadores', label: 'Jugadores' },
      { to: '/oficiales', label: 'Oficiales' },
      { to: '/estadios', label: 'Estadios' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { to: '/estadisticas', label: 'Estadísticas' },
      { to: '/jugadas', label: 'Jugadas' },
      { to: '/metricas', label: 'Métricas' },
      { to: '/comparador', label: 'Comparador' },
      { to: '/reportes', label: 'Reportes' },
      { to: '/reportes/plantillas', label: 'Armar informes' },
    ],
  },
  {
    label: 'Scouting',
    items: [
      { to: '/scouting/rivales', label: 'Rivales' },
      { to: '/scouting/jugadores', label: 'Jugadores' },
      { to: '/scouting/seguimiento', label: 'Seguimiento' },
    ],
  },
  {
    label: 'Operativa',
    items: [
      { to: '/entrenamientos', label: 'Entrenamientos' },
      { to: '/operativa', label: 'Centro operativo' },
      { to: '/asistente', label: 'Asistente IA' },
    ],
  },
]

const ADMIN_GROUP: NavGroup = {
  label: 'Administración',
  items: [
    { to: '/parametrizaciones', label: 'Parametrizaciones' },
    { to: '/seguridad', label: 'Seguridad' },
  ],
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const desktopNavRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click afuera -- reemplaza un enfoque anterior con onBlur + setTimeout que
  // competía con el propio click de navegación: blur del botón dispara antes que el click del link
  // termine de procesarse, y si React llega a desmontar el link primero, el click se pierde sin
  // navegar ("el menú no hace nada"). Un listener de click afuera no tiene esa carrera: sólo cierra
  // cuando el click cae fuera del contenedor, nunca compite con un click adentro.
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isAdmin = user?.role === 'admin'
  const groups = isAdmin ? [...GROUPS, ADMIN_GROUP] : GROUPS

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="bg-slate-900 text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <button type="button" className="flex items-center gap-2 font-bold" onClick={() => navigate('/dashboard')}>
          <span className="text-xl">⚽</span>
          <span>LeagueCore</span>
        </button>

        <div ref={desktopNavRef} className="hidden md:flex md:items-center md:gap-1">
          <NavLink to="/dashboard" className={linkClass}>
            Inicio
          </NavLink>
          <NavLink to="/partidos" className={linkClass}>
            Partidos
          </NavLink>
          {groups.map((group) => {
            const groupActive = group.items.some((it) => location.pathname.startsWith(it.to))
            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup((g) => (g === group.label ? null : group.label))}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    groupActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {group.label}
                  <span aria-hidden className="text-xs">
                    ▾
                  </span>
                </button>
                {openGroup === group.label && (
                  <div className="absolute left-0 top-full z-40 mt-1 w-48 rounded-lg bg-white py-1 text-slate-900 shadow-xl">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpenGroup(null)}
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm ${isActive ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div ref={profileRef} className="hidden md:block relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-800"
          >
            <span>👤 {user?.displayName || user?.username}</span>
            <span aria-hidden>▾</span>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-lg bg-white py-1 text-slate-900 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  navigate('/perfil')
                }}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
              >
                👤 Mi perfil
              </button>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  navigate('/seguridad?tab=cambiar')
                }}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
              >
                🔑 Cambiar contraseña
              </button>
              <hr className="my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                🚪 Cerrar sesión
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="md:hidden rounded-lg p-2 hover:bg-slate-800"
          aria-label="Abrir menú"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className="border-t border-slate-800 px-4 py-2 sm:px-6">
        <GlobalSearch />
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 px-4 pb-4">
          <div className="flex flex-col gap-1 pt-2">
            <NavLink to="/dashboard" className={linkClass} onClick={() => setMenuOpen(false)}>
              Inicio
            </NavLink>
            <NavLink to="/partidos" className={linkClass} onClick={() => setMenuOpen(false)}>
              Partidos
            </NavLink>
            {groups.map((group) => (
              <div key={group.label} className="mt-2">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <hr className="my-2 border-slate-800" />
            <button
              type="button"
              className="block rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
              onClick={() => {
                setMenuOpen(false)
                navigate('/perfil')
              }}
            >
              👤 Mi perfil ({user?.username})
            </button>
            <button
              type="button"
              className="block rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
              onClick={() => {
                setMenuOpen(false)
                navigate('/seguridad?tab=cambiar')
              }}
            >
              🔑 Cambiar contraseña
            </button>
            <button
              type="button"
              className="block rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800"
              onClick={handleLogout}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
