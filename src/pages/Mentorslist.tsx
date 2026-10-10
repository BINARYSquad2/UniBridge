import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Mentor = {
  id: string
  full_name: string
  bio: string
}

export default function Mentorslist() {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadMentors() {
      try {
        const response = await fetch('/api/v1/mentors', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          signal: controller.signal,
        })

        if (response.status === 401) {
          throw new Error('Сессия истекла. Войдите в аккаунт заново.')
        }

        if (!response.ok) {
          throw new Error('Не удалось загрузить менторов.')
        }

        const data: Mentor[] = await response.json()
        setMentors(data)
      } catch (err) {
        if (controller.signal.aborted) return

        setError(
          err instanceof Error ? err.message : 'Ошибка соединения с сервером.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadMentors()

    return () => controller.abort()
  }, [])

  return (
    <div className="landing-page min-h-screen">
      <main className="landing__container pt-28 pb-12">
        <h1 className="text-3xl font-black text-text-primary">
          Менторство
        </h1>

        <p className="mt-3 mb-8 text-text-secondary">
          Найди наставника, который поможет с обучением и поступлением.
        </p>

        {loading && <p role="status">Загружаем менторов…</p>}

        {error && (
          <div role="alert" className="rounded-xl border border-border p-5">
            <p>{error}</p>
            <Link to="/login" className="text-brand underline">
              Войти в аккаунт
            </Link>
          </div>
        )}

        {!loading && !error && mentors.length === 0 && (
          <div className="landing__feature-card">
            <h2 className="text-xl font-bold">Менторов пока нет</h2>
            <p className="mt-2 text-text-secondary">
              Когда зарегистрируется пользователь с ролью ментора,
              он появится здесь.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mentors.map((mentor) => (
              <article key={mentor.id} className="landing__feature-card">
                <span className="landing__section-label">Ментор</span>

                <h2 className="mt-3 text-xl font-bold text-text-primary">
                  {mentor.full_name}
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-text-secondary">
                  {mentor.bio || 'Ментор пока не добавил описание.'}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}