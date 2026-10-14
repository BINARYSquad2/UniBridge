import { CabinetNav } from '../components/CabinetNav'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, useSession } from '../lib/session'
export type Request = { id: string; student_id: string; mentor_id: string; student_name: string; mentor_name: string; message: string; status: string; school_grade: number; interests: string[]; created_at: string }
export const statuses: Record<string, string> = { pending: 'Ожидает ответа', accepted: 'Принята', rejected: 'Отклонена', cancelled: 'Отменена' }
export default function Requests() {
  const { user } = useSession()
  const mentor = user?.role === 'mentor'
  const [items, setItems] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [filter, setFilter] = useState('all')
  const load = () => api<Request[]>('/mentorship/requests').then(setItems)
  useEffect(() => {
    const controller = new AbortController()
    api<Request[]>('/mentorship/requests', { signal: controller.signal }).then(setItems).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function update(id: string, status: string) {
    setBusy(id); setError('')
    try { await api('/mentorship/requests', { method: 'PATCH', body: JSON.stringify({ id, status }) }); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка соединения') } finally { setBusy('') }
  }
  const shown = items.filter(item => filter === 'all' || item.status === filter)
  return <div className="landing-page min-h-screen"><div className="cabinet-layout"><CabinetNav /><main className="cabinet-content space-y-6">
    <h1 className="text-3xl font-black">{mentor ? 'Запросы учеников' : 'Мои заявки'}</h1>
    <p className="text-text-secondary">{mentor ? 'Ученики рассказывают о себе и о том, чему хотят научиться.' : 'Следите за ответами менторов. Пока заявка ожидает ответа, её можно отменить.'}</p>
    <div className="flex flex-wrap gap-3">
      <label>Показать: <select className="bg-bg-surface border border-border rounded-xl p-2" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">Все заявки</option><option value="pending">Ожидают ответа</option><option value="accepted">Принятые</option><option value="rejected">Отклонённые</option><option value="cancelled">Отменённые</option>
      </select></label>
      <button disabled={loading || !!busy} onClick={async () => { setLoading(true); setError(''); try { await load() } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка') } finally { setLoading(false) } }}>Обновить</button>
      {!mentor && <Link to="/mentorslist" className="text-brand underline">Найти ментора</Link>}
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Загрузка заявок…</p> : <>
      {!shown.length && !error && <div className="landing__feature-card">{items.length ? 'В этой категории заявок нет.' : 'Заявок пока нет.'}</div>}
      <div className="catalog-grid">{shown.map(item => <article className="landing__mentor-card catalog-card" key={item.id}>
        <span className="landing__mentor-role self-start">{statuses[item.status]}</span>
        <h2 className="landing__mentor-name mt-4">{mentor ? item.student_name : item.mentor_name}</h2>
        {mentor && <div><p className="landing__mentor-university mt-3">{item.school_grade} класс</p><div className="landing__mentor-tags">{item.interests.map(interest => <span className="landing__mentor-tag" key={interest}>{interest}</span>)}</div></div>}
        <details className="request-description my-4"><summary className="cursor-pointer"><span className="request-preview">{item.message}</span><span className="text-xs text-brand">Полное описание</span></summary><p className="mt-3 whitespace-pre-wrap break-words">{item.message}</p></details>
        <p className="text-xs text-text-secondary">{new Date(item.created_at).toLocaleString('ru-RU')}</p>
        {item.status === 'pending' && <div className="flex flex-wrap gap-3 mt-4">
          {mentor ? <><button className="landing__mentor-button" disabled={!!busy} onClick={() => update(item.id, 'accepted')}>Принять</button><button className="landing__secondary-button" disabled={!!busy} onClick={() => update(item.id, 'rejected')}>Отклонить</button></> : <button className="landing__secondary-button" disabled={!!busy} onClick={() => update(item.id, 'cancelled')}>Отменить заявку</button>}
        </div>}
      </article>)}</div>
    </>}
  </main></div></div>
}
