import { createContext, useContext } from 'react'

export type User = {
  id: string
  full_name: string
  email: string
  role: 'student' | 'mentor'
}

export type SessionContextValue = {
  token: string | null
  user: User | null
  loading: boolean
  error: string
  signIn: (token: string, user: User) => void
  signOut: () => void
  logout: () => void
  refreshSession: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue>({
  token: null,
  user: null,
  loading: true,
  error: '',
  signIn: () => {},
  signOut: () => {},
  logout: () => {},
  refreshSession: async () => {},
})

export const useSession = () => useContext(SessionContext)