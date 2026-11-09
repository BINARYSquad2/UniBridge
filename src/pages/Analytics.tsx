import { useEffect, useState, useMemo } from 'react';
import '../styles/Analytics.css';
import '../styles/TaskTypeTag.css';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Landing.css';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Target,
  Award,
  BookOpen,
  Code2,
  UserCheck,
  Clock,
  ListTodo
} from 'lucide-react';
import { api } from '../lib/session';
import { taskTypeLabel } from '../lib/taskTypes';

interface RoadmapTask {
  id: string;
  title: string;
  task_type: string;
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
  steps: RoadmapStep[];
}

interface RoadmapMetrics {
  plan_id: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  total_micro_steps: number;
  completed_micro_steps: number;
  by_task_type: Array<{
    task_type: string;
    total: number;
    completed: number;
  }>;
  daily_activity: Array<{
    date: string;
    tasks_completed: number;
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
  ec: { label: 'Внеучебные', icon: Activity },
  test: { label: 'Тесты', icon: BookOpen },
  essay: { label: 'Эссе', icon: Code2 },
  recommendation: { label: 'Рекомендации', icon: UserCheck },
  academic: { label: 'Академические', icon: Target },
  other: { label: 'Прочее', icon: Award },
};

export default function Analytics() {
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [roadmapMetrics, setRoadmapMetrics] = useState<RoadmapMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPlan, setHasPlan] = useState(true);

  const [activeBarChartKey, setActiveBarChartKey] = useState<'tasks' | 'microSteps'>('tasks');

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
        const metricsResult = await api<RoadmapMetrics>('/roadmap/metrics', {
          signal: controller.signal,
        });
        if (
          metricsResult.plan_id !== result.plan_id ||
          !Array.isArray(metricsResult.by_task_type) ||
          !Array.isArray(metricsResult.daily_activity)
        ) {
          throw new Error('Сервер вернул некорректные метрики');
        }
        setRoadmap(result);
        setRoadmapMetrics(metricsResult);
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

  const metricCards = [
    { label: 'Общий прогресс', value: `${progressPercent}%`, detail: `${roadmapMetrics.completed_tasks} из ${roadmapMetrics.total_tasks} задач`, icon: Activity },
    { label: 'Этапы завершены', value: `${completedSteps}/${roadmap.steps.length}`, detail: 'по текущему плану', icon: CheckCircle2 },
    { label: 'Средний impact', value: `${averageImpact}/100`, detail: 'оценка портфолио', icon: Target },
  ];

  const svgSize = 200;
  const center = svgSize / 2;
  const radius = 65;
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
      {/* Главный центрированный контейнер с ограничением ширины и отступами */}
      <main className="tw-726bb2cc91 tw-0e12dc7de9 tw-ca36a3519d tw-db15dd1d5b tw-f0faeb26d6 tw-8fb6f42ff2" style={{ maxWidth: '1400px' }}>
        
        {/* ЖЕСТКО ВЫРАВНЕННЫЙ ПО ЛЕВОМУ КРАЮ ЗАГОЛОВОК */}
        <header className="tw-60fbb77139 tw-8dddea0773 tw-0c3bc98565 tw-65fdbade20 tw-18049387f0 tw-fe985ca216 tw-4102dddfda tw-bf60a82ffb tw-db6dd3a2aa" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
            <span className="landing__section-label tw-60fbb77139 tw-92e7450ad2 tw-3960ffc248 tw-77a2a20e90" style={{ margin: 0 }}>
              <BarChart3 className="tw-11e59c6d5f tw-dc7972ebf3" /> Аналитика профиля
            </span>
            <h1 className="landing__title tw-751fb0d102 tw-a8e2faff04 tw-33832db49c tw-7fbb85697d" style={{ textAlign: 'left', width: '100%', margin: '8px 0' }}>
              Панель академического развития
            </h1>
            <p className="tw-fc7473ca09 tw-9bcf466577 tw-16720c5987 tw-fa3f7111e5 tw-6b189c6eda tw-74f9876a68" style={{ textAlign: 'left', margin: 0 }}>
              Стратегический мониторинг выполнения задач, прогресса по осям готовности и ключевых этапов подготовки к поступлению.
            </p>
          </div>
          <div className="tw-60fbb77139 tw-012fbd121f tw-3960ffc248 tw-77a2a20e90 tw-a217b4eaa9 tw-03571b673c tw-f0faeb26d6 tw-03b4dd7f17 tw-fc7473ca09 tw-e83a7042bc tw-16720c5987 tw-ca6bcd4b6f tw-18049387f0">
            <CalendarRange className="tw-11e59c6d5f tw-dc7972ebf3 tw-17d820623e" />
            {roadmap.start_academic_year} — {roadmap.end_academic_year}
          </div>
        </header>

        {/* Сокращенный ряд KPI карточек (3 колонки) */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', marginBottom: '24px', width: '100%' }}>
          {metricCards.map(({ label, value, detail, icon: Icon }) => (
            <div
              key={label}
              className="landing__feature-card tw-c07e54fd14 tw-60fbb77139 tw-8dddea0773 tw-8ef2268efb tw-6ed543e2fb tw-68f2db624d tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2"
              style={{ textAlign: 'left' }}
            >
              <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb" style={{ width: '100%' }}>
                <span className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">{label}</span>
                <div className="tw-7660b45090 tw-5f22e64f22 tw-a94cadb680 tw-17d820623e">
                  <Icon className="tw-cd0d9c512c tw-72470489ff" />
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="tw-3febee094e tw-b6496ebe70 tw-7fbb85697d tw-5358eecb47">{value}</div>
                <p className="tw-b6b02c0ebe tw-359090c2d5 tw-16720c5987 tw-2689f39580">{detail}</p>
              </div>
            </div>
          ))}
        </section>

        {/* СТРОГИЙ ДВУХКОЛОНОЧНЫЙ ДИЗАЙН */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '24px', alignItems: 'start', width: '100%' }}>
          
          {/* ЛЕВАЯ КОЛОНКА */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0, width: '100%', textAlign: 'left' }}>
            
            {/* График активности */}
            <div className="landing__feature-card tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-2cd02d11d1 tw-438b2237b8" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
              <div className="tw-60fbb77139 tw-8dddea0773 tw-020ba687fa tw-e6b609c282 tw-65fdbade20 tw-18049387f0">
                <div className="tw-0478c89a15 tw-36e579c0b4 tw-da7c36cd88" style={{ textAlign: 'left' }}>
                  <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47">Динамика активности</h2>
                  <p className="tw-359090c2d5 tw-16720c5987 tw-2689f39580">
                    Выполненные задачи за последние месяцы
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
                    <span className="tw-0214b4b355">Задачи ({barChartTotals.tasks})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBarChartKey('microSteps')}
                    className={`tw-36e579c0b4 tw-effafd4e38 tw-8e63407b5c tw-2eba0d65d0 tw-ceb69a6b0e ${
                      activeBarChartKey === "microSteps" ? "tw-5285f0988c" : "tw-583f0cb48a"
                    }`}
                  >
                    <span className="tw-0214b4b355">Шаги ({barChartTotals.microSteps})</span>
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
                          const val = activeBarChartKey === 'tasks' ? item.tasks_completed : item.micro_steps_completed;
                          const heightPercent = val ? Math.max(8, Math.round((val / maxVal) * 100)) : 0;
                          const [year, month, day] = item.date.split('-').map(Number);
                          const dateLabel = new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

                          return (
                            <div key={item.date} className="group tw-d89972fe17 tw-36e579c0b4 tw-60fbb77139 tw-8dddea0773 tw-3960ffc248 tw-668b21aa54 tw-77c08e015d">
                              <div className="tw-7065497e1c tw-181f3d6c98 tw-67d6184a00 tw-da4dbfbc4f tw-be106ce41b tw-a2765f83f5 tw-ff7825560b tw-1dc571a360 tw-69450ef148 tw-660d2effb8 tw-d5eab218aa tw-07389a777c tw-a4326536b8 tw-e82ae8be04 tw-236812d64c tw-febc34e471">
                                {dateLabel}: {val}
                              </div>
                              <div className={`tw-6da6a3c3f7 tw-cdc9eec3e1 tw-da1032643a tw-a34aa64bb3 tw-0fe7d7d814 tw-7890552ecd tw-6d2e60891b progress-height--${heightPercent}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Дорожная карта этапов */}
            <div className="landing__feature-card tw-0478c89a15 tw-e91f4cd397 tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-b3542e0588" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
              <div className="tw-60fbb77139 tw-6f27f4f79e tw-8ef2268efb tw-65fdbade20 tw-18049387f0 tw-9fcd8a1382" style={{ textAlign: 'left' }}>
                <div style={{ textAlign: 'left' }}>
                  <span className="landing__section-label">Дорожная карта</span>
                  <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-b6b02c0ebe">
                    План {roadmap.start_grade} — {roadmap.end_grade} класс
                  </h2>
                </div>
                <span className="tw-fc7473ca09 tw-0ce2a7f443 tw-17d820623e tw-1044b865a7 tw-0e17f2bd90 tw-660d2effb8 tw-ac204c1088">
                  {progressPercent}% завершено
                </span>
              </div>

              <div className="tw-b43b4c086d" style={{ textAlign: 'left' }}>
                {roadmap.steps.map((step) => {
                  const done = step.tasks.filter((task) => task.completed).length;
                  const percent = step.tasks.length ? Math.round((done / step.tasks.length) * 100) : 0;
                  return (
                    <article key={step.id} className="tw-14dd497ee9 tw-9fcd8a1382 tw-65fdbade20 tw-05faf5c801 tw-c2db4490e0 tw-dcd339c66d" style={{ textAlign: 'left' }}>
                      <div className="tw-60fbb77139 tw-1eb5c6df38 tw-3960ffc248 tw-8ef2268efb tw-77a2a20e90">
                        <div className="tw-e2eedc5718" style={{ textAlign: 'left' }}>
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
                        <span className="tw-60fbb77139 tw-3960ffc248" style={{ gap: '4px' }}><Clock size={12}/> {step.estimatedTime}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ПРАВАЯ КОЛОНКА (Сайдбар) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '360px', flexShrink: 0, textAlign: 'left' }}>
            
            {/* Компактный Radar Chart */}
            <div className="landing__feature-card tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-2cd02d11d1 tw-438b2237b8" style={{ padding: '16px', boxSizing: 'border-box', textAlign: 'left' }}>
              <div className="tw-60fbb77139 tw-8dddea0773 tw-020ba687fa tw-e6b609c282 tw-65fdbade20 tw-18049387f0" style={{ marginBottom: '8px' }}>
                <div className="tw-0478c89a15 tw-36e579c0b4 tw-da7c36cd88" style={{ textAlign: 'left' }}>
                  <span className="landing__section-label" style={{ fontSize: '11px' }}>Профиль</span>
                  <h2 className="tw-d5c9b0001e tw-7fbb85697d tw-5358eecb47 tw-b6b02c0ebe" style={{ fontSize: '15px' }}>Готовность осей</h2>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ width: '160px', height: '160px', overflow: 'visible' }}>
                  {[0.25, 0.5, 0.75, 1].map((level) => (
                    <circle
                      key={level}
                      cx={center}
                      cy={center}
                      r={radius * level}
                      fill="none"
                      stroke="currentColor"
                      opacity={0.15}
                      strokeDasharray={level === 1 ? 'none' : '2 2'}
                      strokeWidth="1"
                    />
                  ))}

                  {currentRadarData.map((_, i) => {
                    const { x, y } = getCoordinates(i, 100);
                    return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="currentColor" opacity={0.15} strokeWidth="1" />;
                  })}

                  <polygon
                    points={radarPolygonPoints}
                    fill="var(--brand, #2563eb)"
                    fillOpacity={0.25}
                    stroke="var(--brand, #2563eb)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />

                  {currentRadarData.map((d, i) => {
                    const { x, y } = getCoordinates(i, d.score);
                    return <circle key={i} cx={x} cy={y} r="3" fill="var(--brand, #2563eb)" />;
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
                        style={{ fontSize: '9px', fill: 'currentColor', fontWeight: 500 }}
                      >
                        {d.label}
                      </text>
                    );
                  })}
                </svg>

                <div style={{ width: '100%', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {currentRadarData.map((item) => {
                    const AxisIcon = item.icon;
                    return (
                      <div key={item.label} style={{ fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563' }}>
                            <AxisIcon size={12} /> <span>{item.label}</span>
                          </span>
                          <span style={{ fontWeight: 600, color: '#1f2937' }}>{item.score}%</span>
                        </div>
                        <div style={{ width: '100%', height: '3px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${item.score}%`, height: '100%', background: 'var(--brand, #2563eb)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Виджет «Сегодняшний план» */}
            <div className="landing__feature-card tw-0478c89a15 tw-e91f4cd397 tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-668b21aa54 tw-60fbb77139 tw-8dddea0773 tw-8ef2268efb" style={{ padding: '16px', background: '#fff', boxSizing: 'border-box', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ListTodo size={16} className="tw-17d820623e" />
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Сегодняшний план</h2>
                </div>
                <Link to="/roadmap" style={{ fontSize: '12px', color: 'var(--brand, #2563eb)', textDecoration: 'none', fontWeight: 500 }}>
                  Все &rarr;
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {tasks
                  .filter((task) => !task.completed)
                  .slice(0, 5)
                  .map((task) => (
                    <div
                      key={task.id}
                      style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}
                    >
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#1f2937', lineHeight: '1.4' }}>{task.title}</p>
                      <span className="task-type-tag" style={{ fontSize: '10px', padding: '1px 6px', width: 'fit-content' }}>
                        {taskTypeLabel(task.task_type)}
                      </span>
                    </div>
                  ))}
                {tasks.filter((t) => !t.completed).length === 0 && (
                  <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', padding: '12px 0' }}>Все задачи выполнены! 🎉</p>
                )}
              </div>

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                <span>Осталось: <strong style={{ color: '#1f2937' }}>{roadmapMetrics.total_tasks - roadmapMetrics.completed_tasks}</strong></span>
                <Link to="/roadmap" style={{ color: 'var(--brand, #2563eb)', textDecoration: 'none', fontWeight: 500 }}>
                  В план &rarr;
                </Link>
              </div>
            </div>

          </div>

        </section>
      </main>
    </div>
  );
}