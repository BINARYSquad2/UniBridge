import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="landing-page">
      {/* Hero / Background elements */}
      <div className="landing__hero-decoration" />
      <div className="landing__hero-decoration-2" />

      <div className="landing__container py-12 md:py-16 space-y-12">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b border-border">
          <div className="space-y-4 max-w-2xl">
            <div className="landing__badge">
              <Sparkles className="w-4 h-4 text-brand" />
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
            <p className="landing__description text-left mx-0">
              {generatedPlan
                ? generatedPlan.summary
                : 'Персонализированный трек подготовки инженерных проектов с акцентом на чистую архитектуру, масштабируемость и доказанные метрики.'}
            </p>
          </div>

          {/* Action Button & Progress Card */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-4 min-w-[280px]">
            <label className="flex flex-col gap-2 text-sm font-semibold text-text-primary">
              Предпочтения для плана
              <textarea
                value={preferences}
                onChange={(event) => setPreferences(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Например: интересуюсь робототехникой, предпочитаю заниматься по выходным"
                className="w-full resize-y rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm font-normal leading-relaxed text-text-primary placeholder:text-text-secondary/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              onClick={handleGenerateRoadmap}
              disabled={isGenerating}
              className="landing__primary-button w-full justify-center gap-2 py-3.5 shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-text-inverse" />
                  <span>Парсинг JSON плана...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-text-inverse" />
                  <span>{isGenerated ? 'Пересоздать план' : 'Сгенерировать roadmap'}</span>
                </>
              )}
            </button>
            {errorMessage && (
              <p role="alert" className="text-sm font-semibold text-red-700">{errorMessage}</p>
            )}

            {/* Progress Card */}
            <div className="bg-bg-surface border border-border rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Общий прогресс
                </span>
                <span className="text-base font-black text-brand">{overallProgress}%</span>
              </div>
              <div className="w-full bg-bg-primary h-2.5 rounded-full overflow-hidden border border-border/50">
                <div 
                  className="bg-brand h-full transition-all duration-500 ease-out rounded-full" 
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary font-medium pt-1">
                <span>Задач: {completedTasks}/{totalTasks}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-brand" /> {generatedPlan ? `${generatedPlan.weekly_hours} ч/неделю` : 'План до 11 класса'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Steps List (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <span className="landing__section-label">
              Этапы дорожной карты
            </span>

            <div className="relative border-l-2 border-border ml-4 pl-6 space-y-5 pt-2">
              {steps.map((step) => {
                const isActive = step.id === activeStepId;
                const isCompleted = step.status === 'completed';
                const isInProgress = step.status === 'in_progress';

                return (
                  <div key={step.id} className="relative">
                    {/* Timeline Dot */}
                    <div 
                      className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 transition-all ${
                        isCompleted
                          ? 'bg-brand border-brand text-text-inverse'
                          : isInProgress
                          ? 'bg-bg-surface border-brand ring-4 ring-brand/20'
                          : 'bg-bg-surface border-border'
                      }`}
                    />

                    {/* Step Card */}
                    <div
                      onClick={() => setActiveStepId(step.id)}
                      className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                        isActive
                          ? 'bg-bg-surface border-brand shadow-xs translate-x-1'
                          : 'bg-bg-surface/60 border-border hover:border-brand/40 hover:bg-bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary bg-brand-light px-2.5 py-1 rounded-lg border border-brand/20">
                          {step.phase}
                        </span>
                        <span className="text-xs font-semibold text-text-secondary">
                          {step.estimatedTime}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-text-primary mb-3">
                        {step.title}
                      </h3>

                      <div className="flex items-center justify-between text-xs font-semibold text-text-secondary pt-3 border-t border-border">
                        <span>Задачи: {step.tasks.filter(t => t.completed).length}/{step.tasks.length}</span>
                        <span className="text-brand font-bold">
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
          <div className="lg:col-span-7 bg-bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6 shadow-2xs sticky top-6">
            
            {/* Step Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand">
                  Детализация: {activeStep.phase}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                  activeStep.status === 'completed'
                    ? 'bg-brand-light border-brand/30 text-brand'
                    : activeStep.status === 'in_progress'
                    ? 'bg-brand border-brand text-text-primary'
                    : 'bg-bg-primary border-border text-text-secondary'
                }`}>
                  {activeStep.status === 'completed' && 'Завершено'}
                  {activeStep.status === 'in_progress' && 'В процессе'}
                  {activeStep.status === 'upcoming' && 'Запланировано'}
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-text-primary">
                {activeStep.title}
              </h2>
              <p className="text-text-secondary text-sm md:text-base leading-relaxed font-medium">
                {activeStep.description}
              </p>
            </div>

            {/* AI Insights / Key Metrics Card */}
            <div className="bg-brand-light border border-brand/30 rounded-2xl p-4 flex items-start gap-3">
              <Zap className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-text-primary font-medium leading-relaxed">
                {isGenerated ? (
                  <>
                    <strong className="font-bold text-brand-hover">Период плана:</strong> с {generatedPlan?.start_grade} по 11 класс, учебные годы {generatedPlan?.start_academic_year} — {generatedPlan?.end_academic_year}.
                  </>
                ) : (
                  <>
                    <strong className="font-bold text-brand-hover">Инструкция:</strong> Нажмите «Сгенерировать roadmap», чтобы развернуть структуру академического плана `p_001`.
                  </>
                )}
              </div>
            </div>

            {/* Tasks Checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <Target className="w-4 h-4 text-brand" />
                Задачи и чекпоинты этапа
              </h3>

              <div className="space-y-2">
                {activeStep.tasks.map((task) => (
                  <div key={task.id} className="space-y-2">
                    <div
                      onClick={() => toggleTask(activeStep.id, task.id)}
                      aria-disabled={updatingTaskID !== null}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        task.completed
                          ? 'bg-bg-primary/60 border-border text-text-secondary'
                          : 'bg-bg-primary border-border text-text-primary hover:border-brand/50'
                      } ${updatingTaskID === task.id ? 'opacity-60' : ''}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-text-secondary shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className={`text-sm ${task.completed ? 'line-through font-normal' : 'font-bold'}`}>
                            {task.title}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-secondary">
                            <span>{task.task_type || 'other'}</span>
                            <span>Оценка: {task.estimated_minutes ?? '—'} мин</span>
                            {task.actual_minutes !== undefined && <span>Факт: {task.actual_minutes} мин</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-semibold text-text-secondary bg-bg-surface px-2 py-1 rounded-md border border-border">
                          {task.duration}
                        </span>
                        {!task.completed && (
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); void startTask(activeStep.id, task.id); }}
                            disabled={startingTaskID === task.id}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors ${task.started_at ? 'border-brand/40 bg-brand-light text-brand' : 'border-border text-text-secondary hover:border-brand hover:text-brand'}`}
                          >
                            <Timer className="h-3.5 w-3.5" />
                            {task.started_at ? 'Таймер идёт' : 'Старт'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="ml-6 space-y-2 border-l border-border pl-3">
                      {(task.micro_steps ?? []).map((microStep) => (
                        <div key={microStep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-primary px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void toggleMicroStep(activeStep.id, task.id, microStep)}
                            disabled={updatingMicroStepID === microStep.id}
                            className="inline-flex min-w-0 items-center gap-2 text-left text-xs font-semibold text-text-primary disabled:opacity-60"
                          >
                            {microStep.completed
                              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                              : <Circle className="h-4 w-4 shrink-0 text-text-secondary" />}
                            <span className={microStep.completed ? 'line-through text-text-secondary' : ''}>{microStep.title}</span>
                            <span className="text-text-secondary">{microStep.actual_minutes ?? microStep.estimated_minutes ?? '—'} мин</span>
                          </button>
                          {!microStep.completed && (
                            <button
                              type="button"
                              onClick={() => void startMicroStep(activeStep.id, task.id, microStep.id)}
                              disabled={updatingMicroStepID === microStep.id}
                              className="text-[11px] font-bold text-brand hover:underline disabled:opacity-60"
                            >
                              {microStep.started_at ? 'Таймер идёт' : 'Старт'}
                            </button>
                          )}
                        </div>
                      ))}

                      {creatingMicroStepFor === task.id ? (
                        <form onSubmit={(event) => void addMicroStep(event, activeStep.id, task.id)} className="flex flex-wrap items-center gap-2">
                          <input
                            aria-label="Название микрошагa"
                            value={microStepTitle}
                            onChange={(event) => setMicroStepTitle(event.target.value)}
                            maxLength={500}
                            placeholder="Новый микрошаг"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs"
                            required
                          />
                          <input
                            aria-label="Оценка времени в минутах"
                            type="number"
                            min={1}
                            value={microStepMinutes}
                            onChange={(event) => setMicroStepMinutes(event.target.value)}
                            className="w-20 rounded-lg border border-border bg-bg-surface px-2 py-2 text-xs"
                            required
                          />
                          <button type="submit" disabled={updatingMicroStepID === `new:${task.id}`} className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-60">
                            Добавить
                          </button>
                          <button type="button" onClick={() => setCreatingMicroStepFor(null)} className="px-2 py-2 text-xs text-text-secondary hover:text-text-primary">
                            Отмена
                          </button>
                        </form>
                      ) : (
                        !task.completed && (
                          <button
                            type="button"
                            onClick={() => setCreatingMicroStepFor(task.id)}
                            className="inline-flex items-center gap-1 px-1 py-1 text-xs font-bold text-brand hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" /> Добавить микрошаг
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Deliverables / Artifacts */}
            <div className="pt-4 border-t border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                Ожидаемые результаты (Key Deliverables)
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeStep.artifacts.map((artifact, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-primary border border-border text-xs font-bold text-text-primary"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-brand" />
                    {artifact}
                  </span>
                ))}
              </div>
            </div>

            {/* Action CTA Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => void addActiveStepToKanban()}
                disabled={isAddingToKanban || !generatedPlan}
                className="landing__primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
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