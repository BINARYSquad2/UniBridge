import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type User = { id: string; full_name: string; email: string; role: 'student' | 'mentor' }
const Session = createContext<{ user: User | null; loading: boolean; error: string; signIn: (token: string, user: User) => void; logout: () => void }>({ user: null, loading: true, error: '', signIn: () => {}, logout: () => {} })
export const API = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}`, ...init.headers } })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) { localStorage.removeItem('access_token'); window.dispatchEvent(new Event('session-expired')) }
    throw new Error(data?.error || 'Не удалось выполнить запрос')
  }
  return data as T
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  function logout() { localStorage.removeItem('access_token'); setUser(null); setError('') }
  useEffect(() => {
    const controller = new AbortController()
    window.addEventListener('session-expired', logout)
    if (localStorage.getItem('access_token')) {
      api<User>('/auth/me', { signal: controller.signal }).then(setUser).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    } else setLoading(false)
    return () => { controller.abort(); window.removeEventListener('session-expired', logout) }
  }, [])
  return <Session.Provider value={{ user, loading, error, logout, signIn: (token, next) => { localStorage.setItem('access_token', token); setUser(next); setError(''); setLoading(false) } }}>{children}</Session.Provider>
}
export const useSession = () => useContext(Session)
