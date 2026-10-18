import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Target,
  Award,
  BookOpen,
  Code2,
  UserCheck,
} from 'lucide-react';
import { api } from '../lib/session';

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

interface RoadmapMetrics {
  plan_id: string;
  total_tasks: number;
  completed_tasks: number;
  started_tasks: number;
  overdue_tasks: number;
  estimated_minutes: number;
  actual_minutes: number;
  total_micro_steps: number;
  completed_micro_steps: number;
  estimated_micro_step_minutes: number;
  actual_micro_step_minutes: number;
  by_task_type: Array<{
    task_type: string;
    total: number;
    completed: number;
    estimated_minutes: number;
    actual_minutes: number;
  }>;
  daily_activity: Array<{
    date: string;
    tasks_started: number;
    tasks_completed: number;
    micro_steps_started: number;
    micro_steps_completed: number;
  }>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const STATUS_LABELS: Record<RoadmapStep['status'], string> = {
  completed: 'Завершён',
  in_progress: 'В процессе',
  upcoming: 'Предстоит',
};

const TASK_TYPE_PRESENTATION: Record<string, { label: string; icon: typeof Award }> = {
  ec: { label: 'Внеучебные занятия', icon: Activity },
  test: { label: 'Тесты', icon: BookOpen },
  essay: { label: 'Эссе', icon: Code2 },
  recommendation: { label: 'Рекомендации', icon: UserCheck },
  academic: { label: 'Академические задачи', icon: Target },
  other: { label: 'Другие задачи', icon: Award },
};

export default function Analytics() {
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [roadmapMetrics, setRoadmapMetrics] = useState<RoadmapMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPlan, setHasPlan] = useState(true);

  const [activeBarChartKey, setActiveBarChartKey] = useState<'tasks' | 'microSteps'>('tasks');
  const [activeRadarTab, setActiveRadarTab] = useState<'desktop' | 'mobile'>('desktop');

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
          window.dispatchEvent(new Event('session-expired'));
          navigate('/login', { replace: true });
          return;
        }
        if (response.status === 404) {
          setHasPlan(false);
          return;
        }

        const result = (await response.json().catch(() => null)) as (RoadmapData & { error?: string }) | null;
        if (!response.ok) {
          throw new Error(result?.error ?? 'Не удалось загрузить аналитику');
        }
        if (!result?.plan_id || !Array.isArray(result.steps)) {
          throw new Error('Сервер вернул некорректный план');
        }
        const roadmapMetrics = await api<RoadmapMetrics>('/roadmap/metrics', {
          signal: controller.signal,
        });
        if (
          roadmapMetrics.plan_id !== result.plan_id ||
          !Array.isArray(roadmapMetrics.by_task_type) ||
          !Array.isArray(roadmapMetrics.daily_activity)
        ) {
          throw new Error('Сервер вернул некорректные метрики');
        }
        setRoadmap(result);
        setRoadmapMetrics(roadmapMetrics);
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

  const currentRadarData = (roadmapMetrics?.by_task_type ?? []).map((item) => ({
    label: TASK_TYPE_PRESENTATION[item.task_type]?.label ?? item.task_type,
    score: item.total ? Math.round((item.completed / item.total) * 100) : 0,
    icon: TASK_TYPE_PRESENTATION[item.task_type]?.icon ?? Award,
  }));

  const barChartTotals = useMemo(() => {
    return (roadmapMetrics?.daily_activity ?? []).reduce(
      (acc, day) => ({
        tasks: acc.tasks + day.tasks_completed,
        microSteps: acc.microSteps + day.micro_steps_completed,
      }),
      { tasks: 0, microSteps: 0 }
    );
  }, [roadmapMetrics]);

  if (isLoading) {
    return (
      <main className="w-full min-h-screen pt-28 px-4 sm:px-8 text-center font-medium">
        Загружаем аналитику...
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="w-full min-h-screen pt-28 px-4 sm:px-8">
        <p role="alert" className="text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      </main>
    );
  }

  if (!roadmap || !hasPlan) {
    return (
      <main className="w-full min-h-screen pt-28 pb-12 px-4 sm:px-8 max-w-7xl mx-auto">
        <section className="landing__feature-card space-y-4">
          <h1 className="landing__feature-title">Аналитика появится после создания roadmap</h1>
          <p className="landing__feature-description">
            Сгенерируйте учебный план, чтобы увидеть прогресс по этапам и готовность профиля.
          </p>
          <Link to="/roadmap" className="landing__primary-button inline-flex items-center gap-2">
            Перейти к roadmap <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  if (!roadmapMetrics) {
    return (
      <main className="w-full min-h-screen pt-28 px-4 sm:px-8">
        <p role="alert" className="text-sm font-semibold text-red-700">
          Не удалось загрузить метрики аналитики
        </p>
      </main>
    );
  }

  const tasks = roadmap.steps.flatMap((step) => step.tasks);
  const progressPercent = roadmapMetrics.total_tasks
    ? Math.round((roadmapMetrics.completed_tasks / roadmapMetrics.total_tasks) * 100)
    : 0;
  const completedSteps = roadmap.steps.filter((step) => step.status === 'completed').length;
  const averageImpact = roadmap.steps.length
    ? Math.round(roadmap.steps.reduce((total, step) => total + step.impactScore, 0) / roadmap.steps.length)
    : 0;
  const timeEfficiency = roadmapMetrics.actual_minutes && roadmapMetrics.estimated_minutes
    ? `${Math.round((roadmapMetrics.estimated_minutes / roadmapMetrics.actual_minutes) * 100)}%`
    : '—';

  const metricCards = [
    {
      label: 'Общий прогресс',
      value: `${progressPercent}%`,
      detail: `${roadmapMetrics.completed_tasks} из ${roadmapMetrics.total_tasks} задач`,
      icon: Activity,
    },
    {
      label: 'Этапы завершены',
      value: `${completedSteps}/${roadmap.steps.length}`,
      detail: 'по текущему плану',
      icon: CheckCircle2,
    },
    { label: 'Средний impact', value: `${averageImpact}/100`, detail: 'оценка этапов', icon: Target },
    { label: 'Нагрузка', value: `${roadmap.weekly_hours} ч`, detail: 'в неделю', icon: Clock3 },
    { label: 'Всего задач', value: `${roadmapMetrics.total_tasks}`, detail: 'в текущем плане', icon: Clock3 },
    { label: 'Микрошаги', value: `${roadmapMetrics.total_micro_steps}`, detail: 'всего шагов', icon: CheckCircle2 },
    { label: 'В работе', value: `${roadmapMetrics.started_tasks}`, detail: 'активные задачи', icon: Activity },
    {
      label: 'Эффективность',
      value: timeEfficiency,
      detail: `${roadmapMetrics.actual_minutes} из ${roadmapMetrics.estimated_minutes} мин.`,
      icon: Target,
    },
  ];

  // Уменьшенный размер для компактного Radar Chart
  const svgSize = 300;
  const center = svgSize / 2;
  const radius = 95;
  const numAxes = currentRadarData.length;

  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 / numAxes) * index - Math.PI / 2;
    const r = (val / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const radarPolygonPoints = currentRadarData
    .map((d, i) => {
      const { x, y } = getCoordinates(i, d.score);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="landing-page min-h-screen">
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 pt-24 pb-16 space-y-8">
        
        {/* Шапка */}
        <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3 text-left">
            <span className="landing__section-label flex w-fit items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Аналитическая панель
            </span>
            <h1 className="landing__title text-3xl sm:text-4xl lg:text-5xl font-black text-left">{roadmap.title}</h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-3xl text-left leading-relaxed m-0">
              {roadmap.summary}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl bg-bg-secondary px-4 py-2 text-sm font-semibold text-text-secondary border border-border">
            <CalendarRange className="h-4 w-4 text-brand" />
            {roadmap.start_academic_year} — {roadmap.end_academic_year}
          </div>
        </header>

        {/* Метрики */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricCards.map(({ label, value, detail, icon: Icon }) => (
            <div
              key={label}
              className="landing__feature-card p-5 flex flex-col justify-between space-y-3 rounded-2xl border border-border bg-bg-primary"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">{label}</span>
                <div className="p-2 rounded-lg bg-brand-light/40 text-brand">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-text-primary">{value}</div>
                <p className="mt-1 text-xs text-text-secondary font-medium">{detail}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ИНТЕРАКТИВНЫЙ BAR CHART */}
        <section className="landing__feature-card rounded-3xl border border-border bg-bg-primary overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-stretch border-b border-border">
            <div className="p-6 flex-1 space-y-1">
              <h2 className="text-xl font-black text-text-primary">Bar Chart - Interactive</h2>
              <p className="text-xs text-text-secondary font-medium">
                Showing total visitors for the last 3 months
              </p>
            </div>

            <div className="flex divide-x divide-border border-t sm:border-t-0 border-border">
              <button
                type="button"
                onClick={() => setActiveBarChartKey('tasks')}
                className={`flex-1 sm:w-44 p-4 text-left transition-colors ${
                  activeBarChartKey === 'tasks' ? 'bg-bg-secondary/80' : 'hover:bg-bg-secondary/30'
                }`}
              >
                <span className="text-[11px] uppercase font-bold text-text-secondary block">Задачи</span>
                <span className="text-2xl sm:text-3xl font-black text-text-primary block mt-1">
                  {barChartTotals.tasks.toLocaleString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBarChartKey('microSteps')}
                className={`flex-1 sm:w-44 p-4 text-left transition-colors ${
                  activeBarChartKey === 'microSteps' ? 'bg-bg-secondary/80' : 'hover:bg-bg-secondary/30'
                }`}
              >
                <span className="text-[11px] uppercase font-bold text-text-secondary block">Микрошаги</span>
                <span className="text-2xl sm:text-3xl font-black text-text-primary block mt-1">
                  {barChartTotals.microSteps.toLocaleString()}
                </span>
              </button>
            </div>
          </div>

          <div className="p-6 pt-8">
            {(() => {
              const activity = roadmapMetrics.daily_activity;
              const maxVal = Math.max(1, ...activity.map((day) =>
                activeBarChartKey === 'tasks' ? day.tasks_completed : day.micro_steps_completed
              ));

              return (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-1.5 sm:gap-2.5 h-64 w-full pt-6 pb-2 px-2 border-b border-border/80">
                    {activity.map((item) => {
                      const val = activeBarChartKey === 'tasks'
                        ? item.tasks_completed
                        : item.micro_steps_completed;
                      const heightPercent = val ? Math.max(6, Math.round((val / maxVal) * 100)) : 0;
                      const [year, month, day] = item.date.split('-').map(Number);
                      const dateLabel = new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                      });

                      return (
                        <div key={item.date} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-text-primary text-bg-primary text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 shadow-md">
                            {dateLabel}: {val} {activeBarChartKey === 'tasks' ? 'задач' : 'шагов'}
                          </div>
                          <div
                            className="w-full max-w-[28px] bg-brand rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-[10px] font-semibold text-text-secondary px-2">
                    {activity.map((item, idx, arr) => {
                      if (idx % Math.ceil(arr.length / 6) === 0 || idx === arr.length - 1) {
                        const [year, month, day] = item.date.split('-').map(Number);
                        const dateLabel = new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        });
                        return <span key={item.date}>{dateLabel}</span>;
                      }
                      return <span key={item.date} className="hidden sm:inline opacity-0">.</span>;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Основной блок: 12-колоночная сетка */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Левая колонка: Компактный и менее сбалансированный Radar Chart */}
          <div className="lg:col-span-7 space-y-8">
            <div className="landing__feature-card rounded-3xl border border-border bg-bg-primary overflow-hidden shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-stretch border-b border-border">
                <div className="p-6 flex-1 space-y-1">
                  <span className="landing__section-label">Профиль поступающего</span>
                  <h2 className="text-xl font-black text-text-primary mt-1">Оценка готовности по осям</h2>
                </div>

                <div className="flex divide-x divide-border border-t sm:border-t-0 border-border">
                  <button
                    type="button"
                    onClick={() => setActiveRadarTab('desktop')}
                    className={`flex-1 sm:w-36 p-4 text-left transition-colors ${
                      activeRadarTab === 'desktop' ? 'bg-bg-secondary/80' : 'hover:bg-bg-secondary/30'
                    }`}
                  >
                    <span className="text-[11px] uppercase font-bold text-text-secondary block">Основной</span>
                    <span className="text-xl font-black text-text-primary block mt-1">Desktop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRadarTab('mobile')}
                    className={`flex-1 sm:w-36 p-4 text-left transition-colors ${
                      activeRadarTab === 'mobile' ? 'bg-bg-secondary/80' : 'hover:bg-bg-secondary/30'
                    }`}
                  >
                    <span className="text-[11px] uppercase font-bold text-text-secondary block">Резервный</span>
                    <span className="text-xl font-black text-text-primary block mt-1">Mobile</span>
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Уменьшенный контейнер графика */}
                  <div className="md:col-span-6 flex justify-center relative aspect-square max-w-[260px] mx-auto w-full">
                    <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full overflow-visible">
                      {[0.25, 0.5, 0.75, 1].map((level) => (
                        <circle
                          key={level}
                          cx={center}
                          cy={center}
                          r={radius * level}
                          fill="none"
                          stroke="currentColor"
                          className="text-border"
                          strokeDasharray={level === 1 ? 'none' : '3 3'}
                          strokeWidth="1"
                        />
                      ))}

                      {currentRadarData.map((_, i) => {
                        const { x, y } = getCoordinates(i, 100);
                        return (
                          <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke="currentColor"
                            className="text-border"
                            strokeWidth="1"
                          />
                        );
                      })}

                      <polygon
                        points={radarPolygonPoints}
                        fill="var(--brand, #2563eb)"
                        fillOpacity="0.22"
                        stroke="var(--brand, #2563eb)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />

                      {currentRadarData.map((d, i) => {
                        const { x, y } = getCoordinates(i, d.score);
                        return (
                          <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="4.5"
                            className="fill-brand stroke-bg-primary"
                            strokeWidth="2"
                          />
                        );
                      })}

                      {currentRadarData.map((d, i) => {
                        const labelPos = getCoordinates(i, 132);
                        return (
                          <text
                            key={d.label}
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[9px] font-bold fill-text-primary uppercase tracking-tight"
                          >
                            {d.label}
                          </text>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="md:col-span-6 space-y-3">
                    {currentRadarData.map((item) => {
                      const AxisIcon = item.icon;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="flex items-center gap-2 text-text-primary">
                              <AxisIcon className="h-3.5 w-3.5 text-brand shrink-0" /> <span className="truncate">{item.label}</span>
                            </span>
                            <span className="font-bold text-brand">{item.score}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                            <div
                              className="h-full rounded-full bg-brand transition-all duration-500"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Выполнение по этапам */}
            <div className="landing__feature-card p-6 sm:p-8 rounded-3xl border border-border bg-bg-primary space-y-6">
              <div className="flex items-end justify-between border-b border-border pb-4">
                <div>
                  <span className="landing__section-label">Этапы подготовки</span>
                  <h2 className="text-xl font-black text-text-primary mt-1">
                    План {roadmap.start_grade} — {roadmap.end_grade} класс
                  </h2>
                </div>
                <span className="text-sm font-extrabold text-brand bg-brand-light/50 px-3 py-1 rounded-full">
                  {progressPercent}% завершено
                </span>
              </div>

              <div className="space-y-5">
                {roadmap.steps.map((step) => {
                  const done = step.tasks.filter((task) => task.completed).length;
                  const percent = step.tasks.length ? Math.round((done / step.tasks.length) * 100) : 0;
                  return (
                    <article key={step.id} className="space-y-2.5 pb-4 border-b border-border/60 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-brand">{step.phase}</p>
                          <h3 className="text-base font-bold text-text-primary leading-snug">{step.title}</h3>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-bg-secondary text-text-secondary shrink-0">
                          {STATUS_LABELS[step.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary">
                          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="w-24 text-right text-xs font-bold text-text-secondary shrink-0">
                          {done}/{step.tasks.length} задач
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span>Impact Score: <strong className="text-text-primary font-bold">{step.impactScore}/100</strong></span>
                        <span>{step.estimatedTime}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Правая колонка: Очередь задач */}
          <div className="lg:col-span-5 space-y-8">
            <div className="landing__feature-card p-6 sm:p-8 rounded-3xl border border-border bg-bg-primary h-full flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="landing__section-label">Фокус в работе</span>
                    <h2 className="text-xl font-black text-text-primary mt-1">Очередь задач</h2>
                  </div>
                  <Link to="/roadmap" className="text-xs font-bold text-brand hover:underline">
                    Все задачи &rarr;
                  </Link>
                </div>

                <ol className="space-y-3.5">
                  {tasks
                    .filter((task) => !task.completed)
                    .slice(0, 8)
                    .map((task, index) => (
                      <li
                        key={task.id}
                        className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-border/60 bg-bg-secondary/40 hover:bg-bg-secondary transition-colors"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand text-xs font-extrabold text-white">
                          {index + 1}
                        </span>
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary leading-snug">{task.title}</p>
                          <p className="text-xs font-medium text-text-secondary">{task.duration}</p>
                        </div>
                      </li>
                    ))}
                </ol>
              </div>

              <div className="mt-8 pt-6 border-t border-border flex items-center justify-between text-xs text-text-secondary">
                <span>Осталось задач: <strong className="text-text-primary">{roadmapMetrics.total_tasks - roadmapMetrics.completed_tasks}</strong></span>
                <Link to="/roadmap" className="font-bold text-brand hover:underline">
                  Перейти в план &rarr;
                </Link>
              </div>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}