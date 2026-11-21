// src/lib/api.ts
const ACCESS_TOKEN_KEY = 'access_token'

export const API = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(API + path, {
    ...init,
    headers,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('session-expired'))
    }
    throw new ApiError(data?.error || 'Не удалось выполнить запрос', response.status)
  }

  return data as T
}