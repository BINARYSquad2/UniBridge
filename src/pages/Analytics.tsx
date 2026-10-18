import { useEffect, useState, useMemo } from 'react';
import '../styles/Analytics.css';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Landing.css';
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
      <main className="tw-6da6a3c3f7 tw-793346c736 tw-ca36a3519d tw-f0faeb26d6 tw-8fb6f42ff2 tw-ca6bf63030 tw-2689f39580">
        Загружаем аналитику...
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="tw-6da6a3c3f7 tw-793346c736 tw-ca36a3519d tw-f0faeb26d6 tw-8fb6f42ff2">
        <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261">
          {errorMessage}
        </p>
      </main>
    );
  }

  if (!roadmap || !hasPlan) {
    return (
      <main className="tw-6da6a3c3f7 tw-793346c736 tw-ca36a3519d tw-e4256535da tw-f0faeb26d6 tw-8fb6f42ff2 tw-726bb2cc91 tw-0e12dc7de9">
        <section className="landing__feature-card tw-3e7ce58d64">
          <h1 className="landing__feature-title">Аналитика появится после создания roadmap</h1>
          <p className="landing__feature-description">
            Сгенерируйте учебный план, чтобы увидеть прогресс по этапам и готовность профиля.
          </p>
          <Link to="/roadmap" className="landing__primary-button tw-52083e7da4 tw-3960ffc248 tw-77a2a20e90">
            Перейти к roadmap <ArrowRight className="tw-11e59c6d5f tw-dc7972ebf3" />
          </Link>
        </section>
      </main>
    );
  }

  if (!roadmapMetrics) {
    return (
      <main className="tw-6da6a3c3f7 tw-793346c736 tw-ca36a3519d tw-f0faeb26d6 tw-8fb6f42ff2">
        <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261">
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
    <div className="landing-page tw-793346c736">
      <main className="tw-6da6a3c3f7 tw-9e3dc30c26 tw-0e12dc7de9 tw-f0faeb26d6 tw-8fb6f42ff2 tw-0cd9a4cdb5 tw-db15dd1d5b tw-793f9e26e2">
        
        {/* Шапка */}
        <header className="tw-60fbb77139 tw-8dddea0773 tw-0c3bc98565 tw-65fdbade20 tw-18049387f0 tw-fe985ca216 tw-4102dddfda tw-bf60a82ffb tw-db6dd3a2aa">
          <div className="tw-6ed543e2fb tw-2eba0d65d0">
            <span className="landing__section-label tw-60fbb77139 tw-92e7450ad2 tw-3960ffc248 tw-77a2a20e90">
              <BarChart3 className="tw-11e59c6d5f tw-dc7972ebf3" /> Аналитическая панель
            </span>
            <h1 className="landing__title tw-751fb0d102 tw-a8e2faff04 tw-33832db49c tw-7fbb85697d tw-2eba0d65d0">{roadmap.title}</h1>
            <p className="tw-fc7473ca09 tw-9bcf466577 tw-16720c5987 tw-fa3f7111e5 tw-2eba0d65d0 tw-6b189c6eda tw-74f9876a68">
              {roadmap.summary}
            </p>
          </div>
          <div className="tw-60fbb77139 tw-012fbd121f tw-3960ffc248 tw-77a2a20e90 tw-a217b4eaa9 tw-03571b673c tw-f0faeb26d6 tw-03b4dd7f17 tw-fc7473ca09 tw-e83a7042bc tw-16720c5987 tw-ca6bcd4b6f tw-18049387f0">
            <CalendarRange className="tw-11e59c6d5f tw-dc7972ebf3 tw-17d820623e" />
            {roadmap.start_academic_year} — {roadmap.end_academic_year}
          </div>
        </header>

        {/* Метрики */}
        <section className="tw-f3c543ad5f tw-8e75e3db48 tw-d59f314ff6 tw-0c3bc98565">
          {metricCards.map(({ label, value, detail, icon: Icon }) => (
            <div
              key={label}
              className="landing__feature-card tw-c07e54fd14 tw-60fbb77139 tw-8dddea0773 tw-8ef2268efb tw-6ed543e2fb tw-68f2db624d tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2"
            >
              <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb">
                <span className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">{label}</span>
                <div className="tw-7660b45090 tw-5f22e64f22 tw-a94cadb680 tw-17d820623e">
                  <Icon className="tw-cd0d9c512c tw-72470489ff" />
                </div>
              </div>
              <div>
                <div className="tw-3febee094e tw-b6496ebe70 tw-7fbb85697d tw-5358eecb47">{value}</div>
                <p className="tw-b6b02c0ebe tw-359090c2d5 tw-16720c5987 tw-2689f39580">{detail}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ИНТЕРАКТИВНЫЙ BAR CHART */}
        <section className="landing__feature-card tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-2cd02d11d1 tw-438b2237b8">
          <div className="tw-60fbb77139 tw-8dddea0773 tw-020ba687fa tw-e6b609c282 tw-65fdbade20 tw-18049387f0">
            <div className="tw-0478c89a15 tw-36e579c0b4 tw-da7c36cd88">
              <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47">Bar Chart - Interactive</h2>
              <p className="tw-359090c2d5 tw-16720c5987 tw-2689f39580">
                Showing total visitors for the last 3 months
              </p>
            </div>

            <div className="tw-60fbb77139 tw-3746131ec0 tw-e783642739 tw-b950dda299 tw-c0c13d8a96 tw-18049387f0">
              <button
                type="button"
                onClick={() => setActiveBarChartKey('tasks')}
                className={`tw-36e579c0b4 tw-effafd4e38 tw-8e63407b5c tw-2eba0d65d0 tw-ceb69a6b0e ${
                  activeBarChartKey === "tasks" ? "tw-5285f0988c" : "tw-583f0cb48a"
                }`}
              >
                <span className="tw-d058ca6de6 tw-117ec720ea tw-69450ef148 tw-16720c5987 tw-0214b4b355">Задачи</span>
                <span className="tw-3febee094e tw-b6496ebe70 tw-7fbb85697d tw-5358eecb47 tw-0214b4b355 tw-b6b02c0ebe">
                  {barChartTotals.tasks.toLocaleString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBarChartKey('microSteps')}
                className={`tw-36e579c0b4 tw-effafd4e38 tw-8e63407b5c tw-2eba0d65d0 tw-ceb69a6b0e ${
                  activeBarChartKey === "microSteps" ? "tw-5285f0988c" : "tw-583f0cb48a"
                }`}
              >
                <span className="tw-d058ca6de6 tw-117ec720ea tw-69450ef148 tw-16720c5987 tw-0214b4b355">Микрошаги</span>
                <span className="tw-3febee094e tw-b6496ebe70 tw-7fbb85697d tw-5358eecb47 tw-0214b4b355 tw-b6b02c0ebe">
                  {barChartTotals.microSteps.toLocaleString()}
                </span>
              </button>
            </div>
          </div>

          <div className="tw-0478c89a15 tw-ba31a7fc62">
            {(() => {
              const activity = roadmapMetrics.daily_activity;
              const maxVal = Math.max(1, ...activity.map((day) =>
                activeBarChartKey === 'tasks' ? day.tasks_completed : day.micro_steps_completed
              ));

              return (
                <div className="tw-3e7ce58d64">
                  <div className="tw-60fbb77139 tw-6f27f4f79e tw-8ef2268efb tw-58284b4ea5 tw-0a3e3a7952 tw-14ce684b98 tw-6da6a3c3f7 tw-30c1d058f0 tw-f4cc511ff0 tw-d5eab218aa tw-65fdbade20 tw-c9ed8c5f79">
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
                        <div key={item.date} className="group tw-d89972fe17 tw-36e579c0b4 tw-60fbb77139 tw-8dddea0773 tw-3960ffc248 tw-668b21aa54 tw-77c08e015d">
                          <div className="tw-7065497e1c tw-181f3d6c98 tw-67d6184a00 tw-da4dbfbc4f tw-be106ce41b tw-a2765f83f5 tw-ff7825560b tw-1dc571a360 tw-69450ef148 tw-660d2effb8 tw-d5eab218aa tw-07389a777c tw-a4326536b8 tw-e82ae8be04 tw-236812d64c tw-febc34e471">
                            {dateLabel}: {val} {activeBarChartKey === 'tasks' ? 'задач' : 'шагов'}
                          </div>
                          <div
                            className={`tw-6da6a3c3f7 tw-cdc9eec3e1 tw-da1032643a tw-a34aa64bb3 tw-0fe7d7d814 tw-7890552ecd tw-6d2e60891b progress-height--${heightPercent}`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="tw-60fbb77139 tw-8ef2268efb tw-1dc571a360 tw-e83a7042bc tw-16720c5987 tw-d5eab218aa">
                    {activity.map((item, idx, arr) => {
                      if (idx % Math.ceil(arr.length / 6) === 0 || idx === arr.length - 1) {
                        const [year, month, day] = item.date.split('-').map(Number);
                        const dateLabel = new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                        });
                        return <span key={item.date}>{dateLabel}</span>;
                      }
                      return <span key={item.date} className="tw-99d72c7fc3 tw-ee3c1259a3 tw-7065497e1c">.</span>;
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Основной блок: 12-колоночная сетка */}
        <section className="tw-f3c543ad5f tw-d7c8339810 tw-6f0825385d tw-1500488ab7 tw-60541e1e26">
          
          {/* Левая колонка: Компактный и менее сбалансированный Radar Chart */}
          <div className="tw-d663bdce5e tw-793f9e26e2">
            <div className="landing__feature-card tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-2cd02d11d1 tw-438b2237b8">
              <div className="tw-60fbb77139 tw-8dddea0773 tw-020ba687fa tw-e6b609c282 tw-65fdbade20 tw-18049387f0">
                <div className="tw-0478c89a15 tw-36e579c0b4 tw-da7c36cd88">
                  <span className="landing__section-label">Профиль поступающего</span>
                  <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-b6b02c0ebe">Оценка готовности по осям</h2>
                </div>

                <div className="tw-60fbb77139 tw-3746131ec0 tw-e783642739 tw-b950dda299 tw-c0c13d8a96 tw-18049387f0">
                  <button
                    type="button"
                    onClick={() => setActiveRadarTab('desktop')}
                    className={`tw-36e579c0b4 tw-4110d623a9 tw-8e63407b5c tw-2eba0d65d0 tw-ceb69a6b0e ${
                      activeRadarTab === "desktop" ? "tw-5285f0988c" : "tw-583f0cb48a"
                    }`}
                  >
                    <span className="tw-d058ca6de6 tw-117ec720ea tw-69450ef148 tw-16720c5987 tw-0214b4b355">Основной</span>
                    <span className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-0214b4b355 tw-b6b02c0ebe">Desktop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRadarTab('mobile')}
                    className={`tw-36e579c0b4 tw-4110d623a9 tw-8e63407b5c tw-2eba0d65d0 tw-ceb69a6b0e ${
                      activeRadarTab === "mobile" ? "tw-5285f0988c" : "tw-583f0cb48a"
                    }`}
                  >
                    <span className="tw-d058ca6de6 tw-117ec720ea tw-69450ef148 tw-16720c5987 tw-0214b4b355">Резервный</span>
                    <span className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-0214b4b355 tw-b6b02c0ebe">Mobile</span>
                  </button>
                </div>
              </div>

              <div className="tw-0478c89a15 tw-e91f4cd397">
                <div className="tw-f3c543ad5f tw-d7c8339810 tw-fb9158e3f0 tw-0d304f904c tw-3960ffc248">
                  {/* Уменьшенный контейнер графика */}
                  <div className="tw-ab31535bca tw-60fbb77139 tw-86843cf1e2 tw-d89972fe17 tw-b59cd297c3 tw-d3e6c6c360 tw-0e12dc7de9 tw-6da6a3c3f7">
                    <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="tw-6da6a3c3f7 tw-668b21aa54 tw-5b5e833133">
                      {[0.25, 0.5, 0.75, 1].map((level) => (
                        <circle
                          key={level}
                          cx={center}
                          cy={center}
                          r={radius * level}
                          fill="none"
                          stroke="currentColor"
                          className="tw-a7a24445ff"
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
                            className="tw-a7a24445ff"
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
                            className="tw-a620cce488 tw-7756a63f45"
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
                            className="tw-e09880869d tw-69450ef148 tw-36df92d011 tw-117ec720ea tw-1d7f28b046"
                          >
                            {d.label}
                          </text>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="tw-ab31535bca tw-6ed543e2fb">
                    {currentRadarData.map((item) => {
                      const AxisIcon = item.icon;
                      return (
                        <div key={item.label} className="tw-da7c36cd88">
                          <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-359090c2d5 tw-e83a7042bc">
                            <span className="tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90 tw-5358eecb47">
                              <AxisIcon className="tw-7fc7f732bf tw-bf600f8e02 tw-17d820623e tw-012fbd121f" /> <span className="tw-f283ea9bea">{item.label}</span>
                            </span>
                            <span className="tw-69450ef148 tw-17d820623e">{item.score}%</span>
                          </div>
                          <div className="tw-095acb2755 tw-6da6a3c3f7 tw-2cd02d11d1 tw-ac204c1088 tw-03571b673c">
                            <div
                              className={`tw-668b21aa54 tw-ac204c1088 tw-da1032643a tw-0fe7d7d814 tw-844322115e progress-width--${item.score}`}
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
            <div className="landing__feature-card tw-0478c89a15 tw-e91f4cd397 tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-b3542e0588">
              <div className="tw-60fbb77139 tw-6f27f4f79e tw-8ef2268efb tw-65fdbade20 tw-18049387f0 tw-9fcd8a1382">
                <div>
                  <span className="landing__section-label">Этапы подготовки</span>
                  <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-b6b02c0ebe">
                    План {roadmap.start_grade} — {roadmap.end_grade} класс
                  </h2>
                </div>
                <span className="tw-fc7473ca09 tw-0ce2a7f443 tw-17d820623e tw-1044b865a7 tw-0e17f2bd90 tw-660d2effb8 tw-ac204c1088">
                  {progressPercent}% завершено
                </span>
              </div>

              <div className="tw-b43b4c086d">
                {roadmap.steps.map((step) => {
                  const done = step.tasks.filter((task) => task.completed).length;
                  const percent = step.tasks.length ? Math.round((done / step.tasks.length) * 100) : 0;
                  return (
                    <article key={step.id} className="tw-14dd497ee9 tw-9fcd8a1382 tw-65fdbade20 tw-05faf5c801 tw-c2db4490e0 tw-dcd339c66d">
                      <div className="tw-60fbb77139 tw-1eb5c6df38 tw-3960ffc248 tw-8ef2268efb tw-77a2a20e90">
                        <div className="tw-e2eedc5718">
                          <p className="tw-1dc571a360 tw-7fbb85697d tw-117ec720ea tw-09ace3a4d9 tw-17d820623e">{step.phase}</p>
                          <h3 className="tw-4ee734926f tw-69450ef148 tw-5358eecb47 tw-e25ca6535d">{step.title}</h3>
                        </div>
                        <span className="tw-359090c2d5 tw-e83a7042bc tw-0b91436deb tw-660d2effb8 tw-421ac2be50 tw-03571b673c tw-16720c5987 tw-012fbd121f">
                          {STATUS_LABELS[step.status]}
                        </span>
                      </div>
                      <div className="tw-60fbb77139 tw-3960ffc248 tw-1004c0c395">
                        <div className="tw-2f2a842e50 tw-36e579c0b4 tw-2cd02d11d1 tw-ac204c1088 tw-03571b673c">
                          <div className={`tw-668b21aa54 tw-ac204c1088 tw-da1032643a tw-0fe7d7d814 tw-7890552ecd progress-width--${Math.round(percent)}`} />
                        </div>
                        <span className="tw-69da7e4ff9 tw-308fc069e4 tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-012fbd121f">
                          {done}/{step.tasks.length} задач
                        </span>
                      </div>
                      <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-359090c2d5 tw-16720c5987">
                        <span>Impact Score: <strong className="tw-5358eecb47 tw-69450ef148">{step.impactScore}/100</strong></span>
                        <span>{step.estimatedTime}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Правая колонка: Очередь задач */}
          <div className="tw-8474a71b24 tw-793f9e26e2">
            <div className="landing__feature-card tw-0478c89a15 tw-e91f4cd397 tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-668b21aa54 tw-60fbb77139 tw-8dddea0773 tw-8ef2268efb">
              <div className="tw-b3542e0588">
                <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-65fdbade20 tw-18049387f0 tw-9fcd8a1382">
                  <div>
                    <span className="landing__section-label">Фокус в работе</span>
                    <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-b6b02c0ebe">Очередь задач</h2>
                  </div>
                  <Link to="/roadmap" className="tw-359090c2d5 tw-69450ef148 tw-17d820623e tw-f673f4a7d0">
                    Все задачи &rarr;
                  </Link>
                </div>

                <ol className="tw-9c6cdfa2ba">
                  {tasks
                    .filter((task) => !task.completed)
                    .slice(0, 8)
                    .map((task, index) => (
                      <li
                        key={task.id}
                        className="tw-60fbb77139 tw-60541e1e26 tw-ef22bd5580 tw-56796a90be tw-68f2db624d tw-ca6bcd4b6f tw-05faf5c801 tw-20c3b7f796 tw-bc13c00cab tw-ceb69a6b0e"
                      >
                        <span className="tw-60fbb77139 tw-d0a52b312f tw-cbbf90f9a8 tw-012fbd121f tw-3960ffc248 tw-86843cf1e2 tw-a217b4eaa9 tw-da1032643a tw-359090c2d5 tw-0ce2a7f443 tw-72a4c7cdee">
                          {index + 1}
                        </span>
                        <div className="tw-da7c36cd88 tw-36e579c0b4 tw-7e0b7cdf1a">
                          <p className="tw-fc7473ca09 tw-69450ef148 tw-5358eecb47 tw-e25ca6535d">{task.title}</p>
                          <p className="tw-359090c2d5 tw-2689f39580 tw-16720c5987">{task.duration}</p>
                        </div>
                      </li>
                    ))}
                </ol>
              </div>

              <div className="tw-4e5d2af5fc tw-30c1d058f0 tw-b950dda299 tw-18049387f0 tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-359090c2d5 tw-16720c5987">
                <span>Осталось задач: <strong className="tw-5358eecb47">{roadmapMetrics.total_tasks - roadmapMetrics.completed_tasks}</strong></span>
                <Link to="/roadmap" className="tw-69450ef148 tw-17d820623e tw-f673f4a7d0">
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