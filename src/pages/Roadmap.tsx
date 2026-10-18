import React, { useEffect, useState } from 'react';
import '../styles/Roadmap.css';
import { useNavigate } from 'react-router-dom';
import '../styles/Landing.css';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Sparkles, 
  Target, 
  BookOpen, 
  ChevronRight,
  Zap,
  ArrowRight,
  Loader2,
  Wand2,
  Plus,
  Timer
} from 'lucide-react';

interface MicroStep {
  id: string;
  title: string;
  estimated_minutes?: number;
  started_at?: string;
  completed: boolean;
  actual_minutes?: number;
}

interface Task {
  id: string;
  title: string;
  duration: string;
  task_type: string;
  estimated_minutes?: number;
  started_at?: string;
  completed: boolean;
  actual_minutes?: number;
  micro_steps: MicroStep[];
}

interface RoadmapStep {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  estimatedTime: string;
  impactScore: number;
  tasks: Task[];
  artifacts: string[];
}

interface GeneratedRoadmap {
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

// Данные по умолчанию (До генерации)
const INITIAL_STEPS: RoadmapStep[] = [
  {
    id: 'step-1',
    phase: 'Фаза 1',
    title: 'Подготовка к планированию',
    description: 'Нажмите кнопку «Сгенерировать roadmap», чтобы загрузить академический план на 2026–2029 гг.',
    status: 'in_progress',
    estimatedTime: 'Текущий этап',
    impactScore: 50,
    artifacts: ['Draft Plan JSON'],
    tasks: [
      { id: 't0', title: 'Нажать кнопку генерации плана выше', duration: '1 мин', task_type: 'other', completed: false, micro_steps: [] }
    ]
  }
];

export const Roadmap: React.FC = () => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<RoadmapStep[]>(INITIAL_STEPS);
  const [activeStepId, setActiveStepId] = useState<string>('step-1');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAddingToKanban, setIsAddingToKanban] = useState(false);
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedRoadmap | null>(null);
  const [preferences, setPreferences] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingTaskID, setUpdatingTaskID] = useState<string | null>(null);
  const [startingTaskID, setStartingTaskID] = useState<string | null>(null);
  const [updatingMicroStepID, setUpdatingMicroStepID] = useState<string | null>(null);
  const [creatingMicroStepFor, setCreatingMicroStepFor] = useState<string | null>(null);
  const [microStepTitle, setMicroStepTitle] = useState('');
  const [microStepMinutes, setMicroStepMinutes] = useState('15');

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return;

    const controller = new AbortController();
    void fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/current`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 404) return;
      const result = await response.json().catch(() => null) as (GeneratedRoadmap & { error?: string }) | null;
      if (!response.ok) {
        throw new Error(result && 'error' in result ? result.error : 'Не удалось загрузить roadmap');
      }
      if (!result || !result.plan_id || !Array.isArray(result.steps) || result.steps.length === 0) {
        throw new Error('Сервер вернул некорректный roadmap');
      }

      setGeneratedPlan(result);
      setSteps(result.steps);
      setActiveStepId(result.steps[0].id);
      setIsGenerated(true);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить roadmap');
    });

    return () => controller.abort();
  }, []);

  const toggleTask = async (stepId: string, taskId: string) => {
    if (updatingTaskID) return;
    const step = steps.find((item) => item.id === stepId);
    const task = step?.tasks.find((item) => item.id === taskId);
    if (!step || !task) return;

    const completed = !task.completed;
    const updatedTasks = step.tasks.map((item) => item.id === taskId ? { ...item, completed } : item);
    const status = updatedTasks.every((item) => item.completed)
      ? 'completed'
      : updatedTasks.some((item) => item.completed) ? 'in_progress' : 'upcoming';

    if (generatedPlan?.plan_id) {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        setErrorMessage('Сессия истекла. Войдите снова.');
        return;
      }
      setUpdatingTaskID(taskId);
      setErrorMessage('');
      try {
        const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed }),
        });
        const result = await response.json().catch(() => null) as { error?: string; actual_minutes?: number } | null;
        if (!response.ok) {
          throw new Error(result && 'error' in result ? result.error : 'Не удалось сохранить задачу');
        }
        setSteps((previous) => previous.map((item) => item.id === stepId
          ? {
              ...item,
              tasks: item.tasks.map((currentTask) => currentTask.id === taskId
                ? { ...currentTask, completed, started_at: completed ? currentTask.started_at : undefined, actual_minutes: result?.actual_minutes ?? currentTask.actual_minutes }
                : currentTask),
              status,
            }
          : item));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить задачу');
        return;
      } finally {
        setUpdatingTaskID(null);
      }
      return;
    }

    setSteps((previous) => previous.map((item) => item.id === stepId
      ? { ...item, tasks: updatedTasks, status }
      : item));
  };

  const startTask = async (stepId: string, taskId: string) => {
    if (startingTaskID) return;
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return setErrorMessage('Сессия истекла. Войдите снова.');
    setStartingTaskID(taskId);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/tasks/${encodeURIComponent(taskId)}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => null) as { started_at?: string; error?: string } | null;
      if (!response.ok || !result?.started_at) throw new Error(result?.error ?? 'Не удалось запустить таймер');
      setSteps((previous) => previous.map((step) => step.id === stepId
        ? { ...step, tasks: step.tasks.map((task) => task.id === taskId ? { ...task, started_at: result.started_at } : task) }
        : step));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось запустить таймер');
    } finally {
      setStartingTaskID(null);
    }
  };

  const startMicroStep = async (stepId: string, taskId: string, microStepId: string) => {
    if (updatingMicroStepID) return;
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return setErrorMessage('Сессия истекла. Войдите снова.');
    setUpdatingMicroStepID(microStepId);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/micro-steps/${encodeURIComponent(microStepId)}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => null) as { started_at?: string; error?: string } | null;
      if (!response.ok || !result?.started_at) throw new Error(result?.error ?? 'Не удалось запустить микрошаг');
      setSteps((previous) => previous.map((step) => step.id === stepId
        ? { ...step, tasks: step.tasks.map((task) => task.id === taskId
            ? { ...task, micro_steps: task.micro_steps.map((micro) => micro.id === microStepId ? { ...micro, started_at: result.started_at } : micro) }
            : task) }
        : step));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось запустить микрошаг');
    } finally {
      setUpdatingMicroStepID(null);
    }
  };

  const toggleMicroStep = async (stepId: string, taskId: string, microStep: MicroStep) => {
    if (updatingMicroStepID) return;
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return setErrorMessage('Сессия истекла. Войдите снова.');
    const completed = !microStep.completed;
    setUpdatingMicroStepID(microStep.id);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/micro-steps/${encodeURIComponent(microStep.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      const result = await response.json().catch(() => null) as { actual_minutes?: number; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? 'Не удалось сохранить микрошаг');
      setSteps((previous) => previous.map((step) => step.id === stepId
        ? { ...step, tasks: step.tasks.map((task) => task.id === taskId
            ? { ...task, micro_steps: task.micro_steps.map((micro) => micro.id === microStep.id
                ? { ...micro, completed, started_at: completed ? micro.started_at : undefined, actual_minutes: result?.actual_minutes ?? micro.actual_minutes }
                : micro) }
            : task) }
        : step));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить микрошаг');
    } finally {
      setUpdatingMicroStepID(null);
    }
  };

  const addMicroStep = async (event: React.FormEvent, stepId: string, taskId: string) => {
    event.preventDefault();
    const title = microStepTitle.trim();
    const estimatedMinutes = Number(microStepMinutes);
    if (!title || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1) {
      setErrorMessage('Укажите название и время микрошагa в минутах.');
      return;
    }
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return setErrorMessage('Сессия истекла. Войдите снова.');
    setUpdatingMicroStepID(`new:${taskId}`);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/tasks/${encodeURIComponent(taskId)}/micro-steps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, estimated_minutes: estimatedMinutes }),
      });
      const result = await response.json().catch(() => null) as MicroStep & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? 'Не удалось добавить микрошаг');
      setSteps((previous) => previous.map((step) => step.id === stepId
        ? { ...step, tasks: step.tasks.map((task) => task.id === taskId ? { ...task, micro_steps: [...task.micro_steps, result] } : task) }
        : step));
      setMicroStepTitle('');
      setMicroStepMinutes('15');
      setCreatingMicroStepFor(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось добавить микрошаг');
    } finally {
      setUpdatingMicroStepID(null);
    }
  };

  const handleGenerateRoadmap = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setErrorMessage('Войдите в аккаунт, чтобы сгенерировать план.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      });
      const result = await response.json().catch(() => null) as (GeneratedRoadmap & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(result && 'error' in result ? result.error : 'Не удалось сгенерировать план');
      }
      if (!result || !result.plan_id || !Array.isArray(result.steps) || result.steps.length === 0) {
        throw new Error('Сервер вернул пустой или некорректный план');
      }

      setGeneratedPlan(result);
      setSteps(result.steps);
      setActiveStepId(result.steps[0].id);
      setIsGenerated(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось подключиться к серверу');
    } finally {
      setIsGenerating(false);
    }
  };

  const addActiveStepToKanban = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setErrorMessage('Войдите в аккаунт, чтобы добавить задачи в Kanban.');
      return;
    }

    setIsAddingToKanban(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/kanban/roadmap-steps/${encodeURIComponent(activeStep.id)}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => null) as { added?: number; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? 'Не удалось добавить задачи в Kanban');
      navigate('/kanban', { state: { importedCount: result?.added ?? 0 } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось добавить задачи в Kanban');
    } finally {
      setIsAddingToKanban(false);
    }
  };

  const activeStep = steps.find(s => s.id === activeStepId) || steps[0];

  const totalTasks = steps.reduce((acc, s) => acc + s.tasks.length, 0);
  const completedTasks = steps.reduce(
    (acc, s) => acc + s.tasks.filter(t => t.completed).length, 
    0
  );
  const overallProgress = Math.round((completedTasks / totalTasks) * 100) || 0;

  return (
    <div className="landing-page roadmap-page">
      {/* Hero / Background elements */}
      <div className="landing__hero-decoration" />
      <div className="landing__hero-decoration-2" />

      <div className="landing__container roadmap-container">
        
        {/* Header Section */}
        <header className="roadmap-header">
          <div className="roadmap-header__intro">
            <div className="landing__badge">
              <Sparkles className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e" />
              <span>
                {generatedPlan
                  ? `Классы ${generatedPlan.start_grade}–${generatedPlan.end_grade} · ${generatedPlan.start_academic_year} — ${generatedPlan.end_academic_year}`
                  : 'Персональный учебный план'}
              </span>
            </div>
            <h1 className="landing__title">
              {generatedPlan ? (
                <>{generatedPlan.title}</>
              ) : (
                <>Стратегия построения <span className="landing__title-accent">Портфолио</span></>
              )}
            </h1>
            <p className="landing__description roadmap-header__summary">
              {generatedPlan
                ? generatedPlan.summary
                : 'Персонализированный трек подготовки инженерных проектов с акцентом на чистую архитектуру, масштабируемость и доказанные метрики.'}
            </p>
          </div>

          {/* Action Button & Progress Card */}
          <div className="roadmap-header__actions">
            <label className="roadmap-preferences">
              Предпочтения для плана
              <textarea
                value={preferences}
                onChange={(event) => setPreferences(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Например: интересуюсь робототехникой, предпочитаю заниматься по выходным"
                className="roadmap-preferences__input"
              />
            </label>
            <button
              onClick={handleGenerateRoadmap}
              disabled={isGenerating}
              className="landing__primary-button roadmap-generate"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="tw-dc7972ebf3 tw-11e59c6d5f tw-afbdd13a38 tw-dffcdbf826" />
                  <span>Парсинг JSON плана...</span>
                </>
              ) : (
                <>
                  <Wand2 className="tw-dc7972ebf3 tw-11e59c6d5f tw-dffcdbf826" />
                  <span>{isGenerated ? 'Пересоздать план' : 'Сгенерировать roadmap'}</span>
                </>
              )}
            </button>
            {errorMessage && (
              <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261">{errorMessage}</p>
            )}

            {/* Progress Card */}
            <div className="roadmap-progress">
              <div className="roadmap-progress__heading">
                <span className="tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-117ec720ea tw-09ace3a4d9">
                  Общий прогресс
                </span>
                <span className="tw-4ee734926f tw-7fbb85697d tw-17d820623e">{overallProgress}%</span>
              </div>
              <div className="roadmap-progress__track">
                <div className={`roadmap-progress__fill progress-width--${overallProgress}`} />
              </div>
              <div className="roadmap-progress__footer">
                <span>Задач: {completedTasks}/{totalTasks}</span>
                <span className="tw-60fbb77139 tw-3960ffc248 tw-44ee8ba0a4">
                  <Clock className="tw-bf600f8e02 tw-7fc7f732bf tw-17d820623e" /> {generatedPlan ? `${generatedPlan.weekly_hours} ч/неделю` : 'План до 11 класса'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="roadmap-grid">
          
          {/* Left Column: Steps List (5 cols) */}
          <div className="roadmap-steps">
            <span className="landing__section-label">
              Этапы дорожной карты
            </span>

            <div className="roadmap-timeline">
              {steps.map((step) => {
                const isActive = step.id === activeStepId;
                const isCompleted = step.status === 'completed';
                const isInProgress = step.status === 'in_progress';

                return (
                  <div key={step.id} className="roadmap-timeline__item">
                    {/* Timeline Dot */}
                    <div 
                      className={`roadmap-timeline__dot${isCompleted ? ' roadmap-timeline__dot--completed' : isInProgress ? ' roadmap-timeline__dot--active' : ''}`}
                    />

                    {/* Step Card */}
                    <div
                      onClick={() => setActiveStepId(step.id)}
                      className={`roadmap-step${isActive ? ' roadmap-step--active' : ''}`}
                    >
                      <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-a77ed4d908">
                        <span className="tw-1dc571a360 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-84c2118f8b tw-0b91436deb tw-660d2effb8 tw-5f22e64f22 tw-ca6bcd4b6f tw-8609a13c3e">
                          {step.phase}
                        </span>
                        <span className="tw-359090c2d5 tw-e83a7042bc tw-16720c5987">
                          {step.estimatedTime}
                        </span>
                      </div>

                      <h3 className="tw-4ee734926f tw-7fbb85697d tw-5358eecb47 tw-1bb883263e">
                        {step.title}
                      </h3>

                      <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-359090c2d5 tw-e83a7042bc tw-16720c5987 tw-ce335a8e4f tw-b950dda299 tw-18049387f0">
                        <span>Задачи: {step.tasks.filter(t => t.completed).length}/{step.tasks.length}</span>
                        <span className="tw-17d820623e tw-69450ef148">
                          Impact: {step.impactScore}/100
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Step Details (7 cols) */}
          <div className="roadmap-details">
            
            {/* Step Header */}
            <div className="tw-6ed543e2fb">
              <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb">
                <span className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-17d820623e">
                  Детализация: {activeStep.phase}
                </span>
                <span className={`tw-359090c2d5 tw-0e17f2bd90 tw-660d2effb8 tw-ac204c1088 tw-69450ef148 tw-ca6bcd4b6f ${
                  activeStep.status === "completed"
                    ? "tw-84c2118f8b tw-5c5681dfff tw-17d820623e"
                    : activeStep.status === "in_progress"
                    ? "tw-da1032643a tw-9c9f7fcae1 tw-5358eecb47"
                    : "tw-6a2c73aab2 tw-18049387f0 tw-16720c5987"
                }`}>
                  {activeStep.status === 'completed' && 'Завершено'}
                  {activeStep.status === 'in_progress' && 'В процессе'}
                  {activeStep.status === 'upcoming' && 'Запланировано'}
                </span>
              </div>

              <h2 className="tw-3febee094e tw-c58992ca23 tw-7fbb85697d tw-5358eecb47">
                {activeStep.title}
              </h2>
              <p className="tw-16720c5987 tw-fc7473ca09 tw-cd83ad2f11 tw-6b189c6eda tw-2689f39580">
                {activeStep.description}
              </p>
            </div>

            {/* AI Insights / Key Metrics Card */}
            <div className="tw-84c2118f8b tw-ca6bcd4b6f tw-5c5681dfff tw-68f2db624d tw-8e63407b5c tw-60fbb77139 tw-60541e1e26 tw-1004c0c395">
              <Zap className="tw-72470489ff tw-cd0d9c512c tw-17d820623e tw-012fbd121f tw-15e1b1f444" />
              <div className="tw-359090c2d5 tw-e2327d1428 tw-5358eecb47 tw-2689f39580 tw-6b189c6eda">
                {isGenerated ? (
                  <>
                    <strong className="tw-69450ef148 tw-93914e0db1">Период плана:</strong> с {generatedPlan?.start_grade} по 11 класс, учебные годы {generatedPlan?.start_academic_year} — {generatedPlan?.end_academic_year}.
                  </>
                ) : (
                  <>
                    <strong className="tw-69450ef148 tw-93914e0db1">Инструкция:</strong> Нажмите «Сгенерировать roadmap», чтобы развернуть структуру академического плана `p_001`.
                  </>
                )}
              </div>
            </div>

            {/* Tasks Checklist */}
            <div className="tw-6ed543e2fb">
              <h3 className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90">
                <Target className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e" />
                Задачи и чекпоинты этапа
              </h3>

              <div className="tw-6f7e013d64">
                {activeStep.tasks.map((task) => (
                  <div key={task.id} className="tw-6f7e013d64">
                    <div
                      onClick={() => toggleTask(activeStep.id, task.id)}
                      aria-disabled={updatingTaskID !== null}
                      className={`tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-1004c0c395 tw-56796a90be tw-a217b4eaa9 tw-ca6bcd4b6f tw-3451683673 tw-0fe7d7d814 ${
                        task.completed
                          ? "tw-a52c3cf85c tw-18049387f0 tw-16720c5987"
                          : "tw-6a2c73aab2 tw-18049387f0 tw-5358eecb47 tw-7ec4acdb08"
                      } ${updatingTaskID === task.id ? "tw-f2868c227f" : ''}`}
                    >
                      <div className="tw-60fbb77139 tw-7e0b7cdf1a tw-3960ffc248 tw-1004c0c395">
                        {task.completed ? (
                          <CheckCircle2 className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e tw-012fbd121f" />
                        ) : (
                          <Circle className="tw-dc7972ebf3 tw-11e59c6d5f tw-16720c5987 tw-012fbd121f" />
                        )}
                        <div className="tw-7e0b7cdf1a">
                          <span className={`tw-fc7473ca09 ${task.completed ? "tw-093ca5623c tw-8ecebc9f80" : "tw-69450ef148"}`}>
                            {task.title}
                          </span>
                          <div className="tw-b6b02c0ebe tw-60fbb77139 tw-1eb5c6df38 tw-77a2a20e90 tw-d058ca6de6 tw-16720c5987">
                            <span>{task.task_type || 'other'}</span>
                            <span>Оценка: {task.estimated_minutes ?? '—'} мин</span>
                            {task.actual_minutes !== undefined && <span>Факт: {task.actual_minutes} мин</span>}
                          </div>
                        </div>
                      </div>
                      <div className="tw-60fbb77139 tw-012fbd121f tw-3960ffc248 tw-77a2a20e90">
                        <span className="tw-359090c2d5 tw-e83a7042bc tw-16720c5987 tw-48a2a9e0eb tw-d5eab218aa tw-660d2effb8 tw-421ac2be50 tw-ca6bcd4b6f tw-18049387f0">
                          {task.duration}
                        </span>
                        {!task.completed && (
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); void startTask(activeStep.id, task.id); }}
                            disabled={startingTaskID === task.id}
                            className={`tw-52083e7da4 tw-3960ffc248 tw-44ee8ba0a4 tw-5f22e64f22 tw-ca6bcd4b6f tw-d5eab218aa tw-660d2effb8 tw-359090c2d5 tw-69450ef148 tw-ceb69a6b0e ${task.started_at ? "tw-35ddc899c2 tw-84c2118f8b tw-17d820623e" : "tw-18049387f0 tw-16720c5987 tw-de8648da90 tw-f09cea7854"}`}
                          >
                            <Timer className="tw-7fc7f732bf tw-bf600f8e02" />
                            {task.started_at ? 'Таймер идёт' : 'Старт'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="tw-ccdfe155b2 tw-6f7e013d64 tw-d4f78465b3 tw-18049387f0 tw-81976f3f2c">
                      {(task.micro_steps ?? []).map((microStep) => (
                        <div key={microStep.id} className="tw-60fbb77139 tw-1eb5c6df38 tw-3960ffc248 tw-8ef2268efb tw-77a2a20e90 tw-5f22e64f22 tw-6a2c73aab2 tw-0e17f2bd90 tw-03b4dd7f17">
                          <button
                            type="button"
                            onClick={() => void toggleMicroStep(activeStep.id, task.id, microStep)}
                            disabled={updatingMicroStepID === microStep.id}
                            className="tw-52083e7da4 tw-7e0b7cdf1a tw-3960ffc248 tw-77a2a20e90 tw-2eba0d65d0 tw-359090c2d5 tw-e83a7042bc tw-5358eecb47 tw-d463b66401"
                          >
                            {microStep.completed
                              ? <CheckCircle2 className="tw-11e59c6d5f tw-dc7972ebf3 tw-012fbd121f tw-17d820623e" />
                              : <Circle className="tw-11e59c6d5f tw-dc7972ebf3 tw-012fbd121f tw-16720c5987" />}
                            <span className={microStep.completed ? "tw-093ca5623c tw-16720c5987" : ''}>{microStep.title}</span>
                            <span className="tw-16720c5987">{microStep.actual_minutes ?? microStep.estimated_minutes ?? '—'} мин</span>
                          </button>
                          {!microStep.completed && (
                            <button
                              type="button"
                              onClick={() => void startMicroStep(activeStep.id, task.id, microStep.id)}
                              disabled={updatingMicroStepID === microStep.id}
                              className="tw-d058ca6de6 tw-69450ef148 tw-17d820623e tw-f673f4a7d0 tw-d463b66401"
                            >
                              {microStep.started_at ? 'Таймер идёт' : 'Старт'}
                            </button>
                          )}
                        </div>
                      ))}

                      {creatingMicroStepFor === task.id ? (
                        <form onSubmit={(event) => void addMicroStep(event, activeStep.id, task.id)} className="tw-60fbb77139 tw-1eb5c6df38 tw-3960ffc248 tw-77a2a20e90">
                          <input
                            aria-label="Название микрошагa"
                            value={microStepTitle}
                            onChange={(event) => setMicroStepTitle(event.target.value)}
                            maxLength={500}
                            placeholder="Новый микрошаг"
                            className="tw-7e0b7cdf1a tw-36e579c0b4 tw-5f22e64f22 tw-ca6bcd4b6f tw-18049387f0 tw-48a2a9e0eb tw-0e17f2bd90 tw-03b4dd7f17 tw-359090c2d5"
                            required
                          />
                          <input
                            aria-label="Оценка времени в минутах"
                            type="number"
                            min={1}
                            value={microStepMinutes}
                            onChange={(event) => setMicroStepMinutes(event.target.value)}
                            className="tw-ed831a4dff tw-5f22e64f22 tw-ca6bcd4b6f tw-18049387f0 tw-48a2a9e0eb tw-d5eab218aa tw-03b4dd7f17 tw-359090c2d5"
                            required
                          />
                          <button type="submit" disabled={updatingMicroStepID === `new:${task.id}`} className="tw-5f22e64f22 tw-da1032643a tw-0e17f2bd90 tw-03b4dd7f17 tw-359090c2d5 tw-69450ef148 tw-5358eecb47 tw-d463b66401">
                            Добавить
                          </button>
                          <button type="button" onClick={() => setCreatingMicroStepFor(null)} className="tw-d5eab218aa tw-03b4dd7f17 tw-359090c2d5 tw-16720c5987 tw-1852007365">
                            Отмена
                          </button>
                        </form>
                      ) : (
                        !task.completed && (
                          <button
                            type="button"
                            onClick={() => setCreatingMicroStepFor(task.id)}
                            className="tw-52083e7da4 tw-3960ffc248 tw-44ee8ba0a4 tw-d8e0e382c6 tw-660d2effb8 tw-359090c2d5 tw-69450ef148 tw-17d820623e tw-f673f4a7d0"
                          >
                            <Plus className="tw-7fc7f732bf tw-bf600f8e02" /> Добавить микрошаг
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Deliverables / Artifacts */}
            <div className="tw-173fa8f067 tw-b950dda299 tw-18049387f0 tw-6ed543e2fb">
              <h3 className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90">
                <BookOpen className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e" />
                Ожидаемые результаты (Key Deliverables)
              </h3>
              <div className="tw-60fbb77139 tw-1eb5c6df38 tw-77a2a20e90">
                {activeStep.artifacts.map((artifact, idx) => (
                  <span 
                    key={idx}
                    className="tw-52083e7da4 tw-3960ffc248 tw-58284b4ea5 tw-0e17f2bd90 tw-ec0091ee00 tw-a217b4eaa9 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-359090c2d5 tw-69450ef148 tw-5358eecb47"
                  >
                    <ChevronRight className="tw-bf600f8e02 tw-7fc7f732bf tw-17d820623e" />
                    {artifact}
                  </span>
                ))}
              </div>
            </div>

            {/* Action CTA Button */}
            <div className="tw-f46b61a9b3">
              <button
                type="button"
                onClick={() => void addActiveStepToKanban()}
                disabled={isAddingToKanban || !generatedPlan}
                className="landing__primary-button tw-6da6a3c3f7 tw-5f533b3a7d tw-d463b66401"
              >
                <span>
                  {isAddingToKanban
                    ? 'Добавляем задачи...'
                    : generatedPlan ? 'Добавить задачи этапа в Kanban' : 'Сначала сгенерируйте Roadmap'}
                </span>
                <ArrowRight />
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default Roadmap;