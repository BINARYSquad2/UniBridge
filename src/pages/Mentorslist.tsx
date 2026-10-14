import { CabinetNav } from '../components/CabinetNav'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/session'
import { statuses } from './Requests'
import type { Request } from './Requests'
type Mentor = { id: string; full_name: string; bio: string; subjects: string[]; matches: number }
export default function Mentorslist() {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const [onlyMatches, setOnlyMatches] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([api<Mentor[]>('/mentors', { signal: controller.signal }), api<Request[]>('/mentorship/requests', { signal: controller.signal })])
      .then(([m, r]) => { setMentors(m); setRequests(r) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim() || busy) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await api('/mentorship/requests', { method: 'POST', body: JSON.stringify({ mentor_id: selected, message: message.trim() }) })
      setSelected(''); setMessage(''); setSuccess('Заявка отправлена! Её статус доступен в разделе «Мои заявки».')
      setRequests(await api<Request[]>('/mentorship/requests'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка соединения') } finally { setBusy(false) }
  }
  const shown = mentors.filter(m => !onlyMatches || m.matches > 0)
  return <div className="landing-page min-h-screen"><div className="cabinet-layout"><CabinetNav /><main className="cabinet-content space-y-6">
    <h1 className="text-3xl font-black">Подбор менторов</h1>
    <p className="text-text-secondary">Сначала показаны менторы с наибольшим числом совпадений с вашими интересами.</p>
    <div className="flex flex-wrap gap-5"><label><input type="checkbox" checked={onlyMatches} onChange={e => setOnlyMatches(e.target.checked)} /> Только с совпадениями</label><Link to="/requests" className="text-brand underline">Мои заявки →</Link></div>
    {error && <div role="alert">{error} <button onClick={() => window.location.reload()}>Обновить страницу</button></div>}
    {success && <p role="status">{success}</p>}
    {loading ? <p role="status">Загрузка менторов…</p> : <>
      {!shown.length && !error && <div className="landing__feature-card">{mentors.length ? 'Совпадений пока нет. Снимите фильтр, чтобы посмотреть всех менторов.' : 'Менторов пока нет. Они появятся после регистрации.'}</div>}
      <div className="catalog-grid">{shown.map(mentor => {
        const active = requests.find(r => r.mentor_id === mentor.id && ['pending', 'accepted'].includes(r.status))
        return <article key={mentor.id} className="landing__mentor-card catalog-card">
          <span className="landing__mentor-role self-start">{mentor.matches ? `Совпадений: ${mentor.matches}` : 'Другие направления'}</span>
          <h2 className="landing__mentor-name mt-4">{mentor.full_name}</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-text-secondary">{mentor.bio || 'Описание пока не добавлено.'}</p>
          <div className="flex flex-wrap gap-2 my-4">{mentor.subjects.map(s => <span key={s} className="landing__mentor-tag">{s}</span>)}</div>
          {active ? <Link to="/requests" className="text-brand">Заявка: {statuses[active.status]} →</Link> : selected === mentor.id ? <form onSubmit={send} className="space-y-3">
            <label className="block font-bold">Кратко о себе и цели обучения<textarea autoFocus required maxLength={2000} rows={4} className="block w-full mt-2 rounded-xl border border-border bg-bg-primary p-3 font-normal" placeholder="Что хотите изучить и какая помощь нужна?" value={message} onChange={e => setMessage(e.target.value)} /></label>
            <div className="flex flex-wrap gap-3"><button className="landing__mentor-button" disabled={busy || !message.trim()}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button><button type="button" disabled={busy} onClick={() => setSelected('')}>Отмена</button></div>
          </form> : <button className="landing__mentor-button" disabled={busy} onClick={() => { setSelected(mentor.id); setMessage(''); setSuccess('') }}>Подать заявку</button>}
        </article>
      })}</div>
    </>}
  </main></div></div>
}
