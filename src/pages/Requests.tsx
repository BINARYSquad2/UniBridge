import { CabinetNav } from '../components/CabinetNav'
import '../styles/CabinetLayout.css'
import '../styles/Landing.css'
import '../styles/Mentorship.css'
import '../styles/Requests.css'
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
  return <div className="landing-page tw-793346c736"><div className="cabinet-layout"><CabinetNav /><main className="cabinet-content tw-b3542e0588">
    <h1 className="tw-751fb0d102 tw-7fbb85697d">{mentor ? 'Запросы учеников' : 'Мои заявки'}</h1>
    <p className="tw-16720c5987">{mentor ? 'Ученики рассказывают о себе и о том, чему хотят научиться.' : 'Следите за ответами менторов. Пока заявка ожидает ответа, её можно отменить.'}</p>
    <div className="tw-60fbb77139 tw-1eb5c6df38 tw-1004c0c395">
      <label>Показать: <select className="tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-a217b4eaa9 tw-7660b45090" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">Все заявки</option><option value="pending">Ожидают ответа</option><option value="accepted">Принятые</option><option value="rejected">Отклонённые</option><option value="cancelled">Отменённые</option>
      </select></label>
      <button disabled={loading || !!busy} onClick={async () => { setLoading(true); setError(''); try { await load() } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка') } finally { setLoading(false) } }}>Обновить</button>
      {!mentor && <Link to="/mentorslist" className="tw-17d820623e tw-c82b67c88e">Найти ментора</Link>}
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Загрузка заявок…</p> : <>
      {!shown.length && !error && <div className="landing__feature-card">{items.length ? 'В этой категории заявок нет.' : 'Заявок пока нет.'}</div>}
      <div className="catalog-grid">{shown.map(item => <article className="landing__mentor-card catalog-card" key={item.id}>
        <span className="landing__mentor-role tw-5aae0fc8f2">{statuses[item.status]}</span>
        <h2 className="landing__mentor-name tw-0ab8667228">{mentor ? item.student_name : item.mentor_name}</h2>
        {mentor && <div><p className="landing__mentor-university tw-eccd13ef4f">{item.school_grade} класс</p><div className="landing__mentor-tags">{item.interests.map(interest => <span className="landing__mentor-tag" key={interest}>{interest}</span>)}</div></div>}
        <details className="request-description tw-9d6de46b29"><summary className="tw-3451683673"><span className="request-preview">{item.message}</span><span className="tw-359090c2d5 tw-17d820623e">Полное описание</span></summary><p className="tw-eccd13ef4f tw-a2edcb1a3a tw-170cee3ff4">{item.message}</p></details>
        <p className="tw-359090c2d5 tw-16720c5987">{new Date(item.created_at).toLocaleString('ru-RU')}</p>
        {item.status === 'pending' && <div className="tw-60fbb77139 tw-1eb5c6df38 tw-1004c0c395 tw-0ab8667228">
          {mentor ? <><button className="landing__mentor-button" disabled={!!busy} onClick={() => update(item.id, 'accepted')}>Принять</button><button className="landing__secondary-button" disabled={!!busy} onClick={() => update(item.id, 'rejected')}>Отклонить</button></> : <button className="landing__secondary-button" disabled={!!busy} onClick={() => update(item.id, 'cancelled')}>Отменить заявку</button>}
        </div>}
      </article>)}</div>
    </>}
  </main></div></div>
}
