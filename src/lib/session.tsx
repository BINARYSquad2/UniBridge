import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import { SessionContext, type SessionContextValue, type User } from './session.context'

const ACCESS_TOKEN_KEY = 'access_token'
const USER_KEY = 'user'

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<User>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.full_name === 'string' &&
    typeof candidate.email === 'string' &&
    (candidate.role === 'student' || candidate.role === 'mentor')
  )
}

function readStoredSession(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    const serializedUser = localStorage.getItem(USER_KEY)
    if (!serializedUser) return { token, user: null }

    const parsed: unknown = JSON.parse(serializedUser)
    return { token, user: isUser(parsed) ? parsed : null }
  } catch {
    return { token: null, user: null }
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [persistedSession] = useState(readStoredSession)
  const [token, setToken] = useState<string | null>(persistedSession.token)
  const [user, setUser] = useState<User | null>(persistedSession.user)
  const [loading, setLoading] = useState(Boolean(persistedSession.token))
  const [error, setError] = useState('')

  const sessionRevision = useRef(0)
  const hasUserRef = useRef(Boolean(persistedSession.user))
  hasUserRef.current = Boolean(user)

  const signOut = useCallback(() => {
    sessionRevision.current += 1
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } finally {
      setToken(null)
      setUser(null)
      setError('')
      setLoading(false)
    }
  }, [])

  const signIn = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    localStorage.setItem(ACCESS_TOKEN_KEY, nextToken)
    sessionRevision.current += 1
    setToken(nextToken)
    setUser(nextUser)
    setError('')
    setLoading(false)
  }, [])

  const refreshSession = useCallback(async () => {
    if (!token) {
      setLoading(false)
      setError('')
      return
    }

    const requestRevision = ++sessionRevision.current
    setLoading((isLoading) => isLoading || !hasUserRef.current)
    setError('')

    try {
      const currentUser = await api<User>('/auth/me')
      if (requestRevision !== sessionRevision.current) return
      if (!isUser(currentUser)) {
        throw new Error('Сервер вернул некорректные данные аккаунта')
      }
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
      setUser(currentUser)
    } catch (sessionError) {
      if (requestRevision !== sessionRevision.current) return
      setUser(null)
      setError(sessionError instanceof Error ? sessionError.message : 'Не удалось загрузить аккаунт')
    } finally {
      if (requestRevision === sessionRevision.current) {
        setLoading(false)
      }
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    const requestRevision = sessionRevision.current
    const handleSessionExpired = () => signOut()
    window.addEventListener('session-expired', handleSessionExpired)

    if (persistedSession.token) {
      void api<User>('/auth/me', { signal: controller.signal })
        .then((currentUser) => {
          if (requestRevision !== sessionRevision.current) return
          if (!isUser(currentUser)) {
            throw new Error('Сервер вернул некорректные данные аккаунта')
          }
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
          setUser(currentUser)
        })
        .catch((sessionError: unknown) => {
          if (controller.signal.aborted || requestRevision !== sessionRevision.current) return
  const status = sessionError instanceof ApiError ? sessionError.status : 0
  setUser(null)
  if (status !== 401) {
    setError(sessionError instanceof Error ? sessionError.message : 'Не удалось загрузить аккаунт')
  }
        })
        .finally(() => {
          if (!controller.signal.aborted && requestRevision === sessionRevision.current) {
            setLoading(false)
          }
        })
    }

    return () => {
      controller.abort()
      window.removeEventListener('session-expired', handleSessionExpired)
    }
  }, [persistedSession.token, signOut])

  const value = useMemo<SessionContextValue>(
    () => ({
      token,
      user,
      loading,
      error,
      signIn,
      signOut,
      logout: signOut,
      refreshSession,
    }),
    [token, user, loading, error, signIn, signOut, refreshSession],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}