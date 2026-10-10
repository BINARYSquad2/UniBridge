import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, CalendarRange, CheckCircle2, Clock3, Target } from 'lucide-react';

interface RoadmapTask {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
}

interface RoadmapStep {
  id: string;
  phase: string;
  title: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  estimatedTime: string;
  impactScore: number;
  tasks: RoadmapTask[];
}

interface RoadmapData {
  plan_id: string;
  title: string;
  summary: string;
  start_grade: number;
  end_grade: number;
  start_academic_year: string;
  end_academic_year: string;
  weekly_hours: number;
  steps: RoadmapStep[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const STATUS_LABELS: Record<RoadmapStep['status'], string> = {
  completed: 'Завершён',
  in_progress: 'В процессе',
  upcoming: 'Предстоит',
};

export default function Analytics() {
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPlan, setHasPlan] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    const controller = new AbortController();
    const loadRoadmap = async () => {
      try {
        const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/current`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          navigate('/login', { replace: true });
          return;
        }
        if (response.status === 404) {
          setHasPlan(false);
          return;
        }

        const result = await response.json().catch(() => null) as (RoadmapData & { error?: string }) | null;
        if (!response.ok) {
          throw new Error(result?.error ?? 'Не удалось загрузить аналитику');
        }
        if (!result?.plan_id || !Array.isArray(result.steps)) {
          throw new Error('Сервер вернул некорректный план');
        }
        setRoadmap(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось подключиться к серверу');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadRoadmap();
    return () => controller.abort();
  }, [navigate]);

  if (isLoading) {
    return <main className="landing__container min-h-screen pt-28">Загружаем аналитику...</main>;
  }

  if (errorMessage) {
    return (
      <main className="landing__container min-h-screen pt-28">
        <p role="alert" className="text-sm font-semibold text-red-700">{errorMessage}</p>
      </main>
    );
  }

  if (!roadmap || !hasPlan) {
    return (
      <main className="landing__container min-h-screen pt-28 pb-12">
        <section className="landing__feature-card space-y-4">
          <h1 className="landing__feature-title">Аналитика появится после создания roadmap</h1>
          <p className="landing__feature-description">Сгенерируйте учебный план, чтобы увидеть прогресс по этапам и задачам.</p>
          <Link to="/roadmap" className="landing__primary-button inline-flex">
            Перейти к roadmap <ArrowRight />
          </Link>
        </section>
      </main>
    );
  }

  const tasks = roadmap.steps.flatMap((step) => step.tasks);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const completionPercent = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const completedSteps = roadmap.steps.filter((step) => step.status === 'completed').length;
  const averageImpact = roadmap.steps.length
    ? Math.round(roadmap.steps.reduce((total, step) => total + step.impactScore, 0) / roadmap.steps.length)
    : 0;
  const metrics = [
    { label: 'Общий прогресс', value: `${completionPercent}%`, detail: `${completedTasks} из ${tasks.length} задач`, icon: Activity },
    { label: 'Этапы завершены', value: `${completedSteps}/${roadmap.steps.length}`, detail: 'по текущему плану', icon: CheckCircle2 },
    { label: 'Средний impact', value: `${averageImpact}/100`, detail: 'оценка этапов', icon: Target },
    { label: 'Нагрузка', value: `${roadmap.weekly_hours} ч`, detail: 'в неделю', icon: Clock3 },
  ];

  return (
    <div className="landing-page min-h-screen">
      <main className="landing__container pt-28 pb-12 space-y-8">
        <header className="flex flex-col gap-5 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <span className="landing__section-label flex w-fit items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Аналитика обучения
            </span>
            <h1 className="landing__title text-3xl sm:text-4xl">{roadmap.title}</h1>
            <p className="landing__description mx-0 text-left text-sm sm:text-base">{roadmap.summary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-text-secondary">
            <CalendarRange className="h-4 w-4 text-brand" />
            {roadmap.start_academic_year} — {roadmap.end_academic_year}
          </div>
        </header>

        <section className="landing__stats rounded-3xl border border-border">
          <div className="landing__stats-grid">
            {metrics.map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="landing__stat space-y-2">
                <Icon className="mx-auto h-5 w-5 text-brand" />
                <div className="landing__stat-value landing__stat-value--accent">{value}</div>
                <div className="landing__stat-label">{label}</div>
                <p className="text-xs text-text-secondary">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="landing__section-label">Выполнение по этапам</span>
                <h2 className="mt-2 text-xl font-black text-text-primary">План с {roadmap.start_grade} по {roadmap.end_grade} класс</h2>
              </div>
              <span className="text-sm font-bold text-brand">{completionPercent}%</span>
            </div>

            <div className="space-y-3">
              {roadmap.steps.map((step) => {
                const done = step.tasks.filter((task) => task.completed).length;
                const percent = step.tasks.length ? Math.round((done / step.tasks.length) * 100) : 0;
                return (
                  <article key={step.id} className="border-b border-border py-4 first:border-t">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-brand">{step.phase}</p>
                        <h3 className="mt-1 text-base font-bold text-text-primary">{step.title}</h3>
                      </div>
                      <span className="text-xs font-semibold text-text-secondary">{STATUS_LABELS[step.status]}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        role="progressbar"
                        aria-label={`Прогресс: ${step.title}`}
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2 flex-1 overflow-hidden rounded-full bg-bg-primary"
                      >
                        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="w-24 text-right text-xs text-text-secondary">{done}/{step.tasks.length} задач</span>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">Impact {step.impactScore}/100 · {step.estimatedTime}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="landing__section-label">Фокус</span>
                <h2 className="mt-2 text-xl font-black text-text-primary">Ближайшие задачи</h2>
              </div>
              <Link to="/roadmap" className="text-sm font-bold text-brand hover:underline">Открыть план</Link>
            </div>
            <ol className="divide-y divide-border border-y border-border">
              {tasks.filter((task) => !task.completed).slice(0, 6).map((task, index) => (
                <li key={task.id} className="flex items-start gap-3 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand">{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{task.title}</p>
                    <p className="mt-1 text-xs text-text-secondary">{task.duration}</p>
                  </div>
                </li>
              ))}
            </ol>
            {completedTasks === tasks.length && (
              <p className="text-sm font-semibold text-brand">Все задачи выполнены.</p>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}