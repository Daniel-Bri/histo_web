import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { AUTH } from './endpoints'
import {
  clearAuthStorage,
  requestNewAccessToken,
  STORAGE_KEYS,
} from '../services/authService'

/** Renovar el access ~90 s antes de expirar (access ~15 min en SimpleJWT). */
const REFRESH_MARGIN_SEC = 90

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let isRefreshing = false
const pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function flushQueueSuccess(token: string) {
  pendingQueue.splice(0).forEach(({ resolve }) => resolve(token))
}

function flushQueueError(err: unknown) {
  pendingQueue.splice(0).forEach(({ reject }) => reject(err))
}

function isAuthPublicUrl(url: string | undefined): boolean {
  if (!url) return false
  const u = url.replace(/^\//, '')
  return (
    u === AUTH.TOKEN_REFRESH ||
    u.startsWith(`${AUTH.TOKEN_REFRESH}?`) ||
    u === AUTH.LOGIN
  )
}

function decodeJwtExp(access: string): number | null {
  try {
    const part = access.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    const payload = JSON.parse(json) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

function shouldRefreshAccessToken(access: string | null): boolean {
  if (!access) return false
  const exp = decodeJwtExp(access)
  if (exp == null) return false
  const nowSec = Math.floor(Date.now() / 1000)
  return exp - nowSec < REFRESH_MARGIN_SEC
}

/**
 * Una sola renovación en vuelo; el resto espera en cola (sin múltiples POST refresh).
 */
export function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      pendingQueue.push({ resolve, reject })
    })
  }

  isRefreshing = true
  return requestNewAccessToken()
    .then((token) => {
      flushQueueSuccess(token)
      return token
    })
    .catch((err) => {
      flushQueueError(err)
      throw err
    })
    .finally(() => {
      isRefreshing = false
    })
}

function redirectToLogin() {
  clearAuthStorage()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

export function attachAuthInterceptors(client: AxiosInstance) {
  client.interceptors.request.use(async (config) => {
    if (isAuthPublicUrl(config.url)) {
      return config
    }

    let access = localStorage.getItem(STORAGE_KEYS.access)

    if (access && shouldRefreshAccessToken(access)) {
      try {
        access = await refreshAccessToken()
      } catch {
        redirectToLogin()
        return Promise.reject(new Error('Refresh failed'))
      }
    }

    if (access) {
      config.headers.Authorization = `Bearer ${access}`
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetriableConfig | undefined
      const status = error.response?.status

      // 403 → redirigir a pantalla de acceso denegado (sin cerrar sesión)
      if (status === 403) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/acceso-denegado')) {
          window.location.assign('/acceso-denegado')
        }
        return Promise.reject(error)
      }

      if (status !== 401 || !original || original._retry) {
        return Promise.reject(error)
      }

      if (isAuthPublicUrl(original.url)) {
        return Promise.reject(error)
      }

      original._retry = true

      try {
        const newAccess = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${newAccess}`
        return client(original)
      } catch {
        redirectToLogin()
        return Promise.reject(error)
      }
    },
  )
}
