import { CabinetNav } from '../components/CabinetNav'
import '../styles/Mentorslist.css';
import '../styles/CabinetLayout.css'
import '../styles/Landing.css'
import '../styles/Mentorship.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { REQUEST_STATUSES, type Request } from '../constants/requests'
import { SUBJECT_DIRECTIONS } from '../lib/subjectDirections'
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
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
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
  const toggleSubject = (subject: string) => {
    setSelectedSubjects(current => current.includes(subject)
      ? current.filter(item => item !== subject)
      : [...current, subject])
  }
  const shown = mentors.filter(m =>
    (!onlyMatches || m.matches > 0) &&
    (!selectedSubjects.length || selectedSubjects.some(subject => m.subjects.includes(subject)))
  )
  return <div className="landing-page tw-793346c736"><div className="cabinet-layout"><CabinetNav /><main className="cabinet-content tw-b3542e0588">
    <h1 className="tw-751fb0d102 tw-7fbb85697d">Подбор менторов</h1>
    <p className="tw-16720c5987">Сначала показаны менторы с наибольшим числом совпадений с вашими интересами.</p>
    <section className="mentor-filters" aria-label="Фильтры менторов">
      <div className="tw-60fbb77139 tw-1eb5c6df38 tw-b39e60c339"><label><input type="checkbox" checked={onlyMatches} onChange={e => setOnlyMatches(e.target.checked)} /> Только с совпадениями</label><Link to="/requests" className="tw-17d820623e tw-c82b67c88e">Мои заявки →</Link></div>
      <fieldset className="mentor-subject-fieldset">
        <legend className="mentor-filter-heading">Направления</legend>
        <p className="tw-16720c5987">Показывать менторов, у которых есть хотя бы один выбранный тег.</p>
        <div className="mentor-filter-tags">
          {SUBJECT_DIRECTIONS.map(subject => <label key={subject} className="mentor-filter-tag">
            <input type="checkbox" checked={selectedSubjects.includes(subject)} onChange={() => toggleSubject(subject)} />
            {subject}
          </label>)}
        </div>
        {!!selectedSubjects.length && <button type="button" className="mentor-filter-reset" onClick={() => setSelectedSubjects([])}>Сбросить направления</button>}
      </fieldset>
    </section>
    {error && <div role="alert">{error} <button onClick={() => window.location.reload()}>Обновить страницу</button></div>}
    {success && <p role="status">{success}</p>}
    {loading ? <p role="status">Загрузка менторов…</p> : <>
      {!shown.length && !error && <div className="landing__feature-card">{!mentors.length ? 'Менторов пока нет. Они появятся после регистрации.' : selectedSubjects.length ? 'По выбранным фильтрам менторы не найдены. Измените направления или снимите фильтры.' : 'Совпадений пока нет. Снимите фильтр, чтобы посмотреть всех менторов.'}</div>}
      <div className="catalog-grid">{shown.map(mentor => {
        const active = requests.find(r => r.mentor_id === mentor.id && ['pending', 'accepted'].includes(r.status))
        return <article key={mentor.id} className="landing__mentor-card catalog-card">
          <span className="landing__mentor-role tw-5aae0fc8f2">{mentor.matches ? `Совпадений: ${mentor.matches}` : 'Другие направления'}</span>
          <h2 className="landing__mentor-name tw-0ab8667228">{mentor.full_name}</h2>
          <p className="tw-eccd13ef4f tw-a2edcb1a3a tw-170cee3ff4 tw-16720c5987">{mentor.bio || 'Описание пока не добавлено.'}</p>
          <div className="tw-60fbb77139 tw-1eb5c6df38 tw-77a2a20e90 tw-9d6de46b29">{mentor.subjects.map(s => <span key={s} className="landing__mentor-tag">{s}</span>)}</div>
          {active ? <Link to="/requests" className="tw-17d820623e">Заявка: {REQUEST_STATUSES[active.status]} →</Link> : selected === mentor.id ? <form onSubmit={send} className="tw-6ed543e2fb">
            <label className="tw-0214b4b355 tw-69450ef148">Кратко о себе и цели обучения<textarea autoFocus required maxLength={2000} rows={4} className="tw-0214b4b355 tw-6da6a3c3f7 tw-50d0d216a2 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-eb6e8b881a tw-8ecebc9f80" placeholder="Что хотите изучить и какая помощь нужна?" value={message} onChange={e => setMessage(e.target.value)} /></label>
            <div className="tw-60fbb77139 tw-1eb5c6df38 tw-1004c0c395"><button className="landing__mentor-button" disabled={busy || !message.trim()}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button><button type="button" disabled={busy} onClick={() => setSelected('')}>Отмена</button></div>
          </form> : <button className="landing__mentor-button" disabled={busy} onClick={() => { setSelected(mentor.id); setMessage(''); setSuccess('') }}>Подать заявку</button>}
        </article>
      })}</div>
    </>}
  </main></div></div>
}
