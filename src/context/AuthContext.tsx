import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { applyApiAuthHeader } from '../api/axiosConfig'
import type { AuthUser } from '../services/authService'
import {
  clearAuthStorage,
  login as loginRequest,
  logoutRequest,
  STORAGE_KEYS,
} from '../services/authService'
import { eliminarTokenFCM } from '../services/notificacionesService'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(STORAGE_KEYS.access)),
  )

  useEffect(() => {
    const access = localStorage.getItem(STORAGE_KEYS.access)
    if (access) {
      applyApiAuthHeader(access)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await loginRequest(username, password)
    setUser(data.user)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    // Dar de baja el token push antes de invalidar la sesión (usa el access token).
    try {
      const fcmToken = localStorage.getItem('fcm_token')
      if (fcmToken) {
        await eliminarTokenFCM(fcmToken)
        localStorage.removeItem('fcm_token')
      }
    } catch {
      // Si falla la baja del token no bloqueamos el logout.
    }
    await logoutRequest()
    clearAuthStorage()
    setUser(null)
    setIsAuthenticated(false)
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      login,
      logout,
      setUser,
    }),
    [user, isAuthenticated, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
