import React, { useEffect, useState } from 'react';
import '../styles/Roadmap.css';
import { useNavigate } from 'react-router-dom';
import '../styles/Landing.css';
import '../styles/TaskTypeTag.css';
import { CabinetNav } from '../components/CabinetNav';
import '../styles/CabinetLayout.css';
import { 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  Target, 
  BookOpen, 
  ChevronRight,
  Zap,
  ArrowRight,
  Loader2,
  Wand2,
  Plus,
  X
} from 'lucide-react';
import { taskTypeLabel } from '../lib/taskTypes';

interface MicroStep {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  track: string;
  title: string;
  task_type: string;
  completed: boolean;
  micro_steps: MicroStep[];
}

interface RoadmapStep {
  id: string;
  track: string;
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
  steps: RoadmapStep[];
}

type RoadmapTrack = 'academics' | 'leadership' | 'impact';

const ROADMAP_TRACKS: { id: RoadmapTrack; label: string }[] = [
  { id: 'academics', label: 'Академический' },
  { id: 'leadership', label: 'Лидерство' },
  { id: 'impact', label: 'Влияние' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// Данные по умолчанию (До генерации)
const INITIAL_STEPS: RoadmapStep[] = [
  {
    id: 'step-1',
    track: 'academics',
    phase: 'Фаза 1',
    title: 'Подготовка к планированию',
    description: 'Нажмите кнопку «Сгенерировать roadmap», чтобы загрузить академический план на 2026–2029 гг.',
    status: 'in_progress',
    estimatedTime: 'Текущий этап',
    impactScore: 50,
    artifacts: ['Draft Plan JSON'],
    tasks: [
      { id: 't0', track: 'academics', title: 'Нажать кнопку генерации плана выше', task_type: 'other', completed: false, micro_steps: [] }
    ]
  }
];

export const Roadmap: React.FC = () => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<RoadmapStep[]>(INITIAL_STEPS);
  const [activeStepId, setActiveStepId] = useState<string>('step-1');
  const [selectedTrack, setSelectedTrack] = useState<RoadmapTrack>('academics');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAddingToKanban, setIsAddingToKanban] = useState(false);
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedRoadmap | null>(null);
  const [preferences, setPreferences] = useState('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingTaskID, setUpdatingTaskID] = useState<string | null>(null);
  const [updatingMicroStepID, setUpdatingMicroStepID] = useState<string | null>(null);
  const [creatingMicroStepFor, setCreatingMicroStepFor] = useState<string | null>(null);
  const [microStepTitle, setMicroStepTitle] = useState('');

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
        const result = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(result && 'error' in result ? result.error : 'Не удалось сохранить задачу');
        }
        setSteps((previous) => previous.map((item) => item.id === stepId
          ? {
              ...item,
              tasks: item.tasks.map((currentTask) => currentTask.id === taskId
                ? { ...currentTask, completed }
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
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? 'Не удалось сохранить микрошаг');
      setSteps((previous) => previous.map((step) => step.id === stepId
        ? { ...step, tasks: step.tasks.map((task) => task.id === taskId
            ? { ...task, micro_steps: task.micro_steps.map((micro) => micro.id === microStep.id
                ? { ...micro, completed }
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
    if (!title) {
      setErrorMessage('Укажите название микрошагa.');
      return;
    }
    if (!generatedPlan?.plan_id) {
      setErrorMessage('Сначала сгенерируйте roadmap, чтобы добавить микрошаг.');
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
        body: JSON.stringify({ title }),
      });
      const result = await response.json().catch(() => null) as MicroStep & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? 'Не удалось добавить микрошаг');
      setSteps((previous) => previous.map((step) => step.id === stepId
        ? { ...step, tasks: step.tasks.map((task) => task.id === taskId ? { ...task, micro_steps: [...task.micro_steps, result] } : task) }
        : step));
      setMicroStepTitle('');
      setCreatingMicroStepFor(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось добавить микрошаг');
    } finally {
      setUpdatingMicroStepID(null);
    }
  };

  const handleOpenGenerateModal = () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setErrorMessage('Войдите в аккаунт, чтобы сгенерировать план.');
      return;
    }
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleGenerateRoadmap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      setIsModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось подключиться к серверу');
    } finally {
      setIsGenerating(false);
    }
  };

  const addActiveStepToKanban = async () => {
    if (!activeStep) return;
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

  const visibleSteps = steps.filter((step) => (step.track || 'academics') === selectedTrack);
  const activeStep = visibleSteps.find((step) => step.id === activeStepId) || visibleSteps[0];

  const selectTrack = (track: RoadmapTrack) => {
    setSelectedTrack(track);
    const firstStep = steps.find((step) => (step.track || 'academics') === track);
    if (firstStep) setActiveStepId(firstStep.id);
  };

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

      <div className="cabinet-layout">
        <CabinetNav />
        <main className="cabinet-content">
          <div className="landing__container roadmap-container">
        
        {/* Header Section */}
        <header className="roadmap-header" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid #f3f4f6', textAlign: 'left' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '20px' }}>
            <div className="roadmap-header__intro">
              <div className="landing__badge" style={{ marginBottom: '6px' }}>
                <Sparkles className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e" />
                <span>
                  {generatedPlan
                    ? `Классы ${generatedPlan.start_grade}–${generatedPlan.end_grade} · ${generatedPlan.start_academic_year} — ${generatedPlan.end_academic_year}`
                    : 'Персональный трек'}
                </span>
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1f2937', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                Персонализированный план
              </h1>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: '1.4' }}>
                {generatedPlan ? generatedPlan.summary : 'Индивидуальная стратегия академического развития и формирования портфолио.'}
              </p>
            </div>

            {/* Прогресс-бар справа */}
            <div className="roadmap-progress" style={{ minWidth: '240px', margin: 0 }}>
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
                <span>{generatedPlan ? `До ${generatedPlan.end_grade} класса` : 'План до 11 класса'}</span>
              </div>
            </div>
          </div>

          {/* Кнопка открытия модального окна */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginTop: '4px' }}>
            <button
              onClick={handleOpenGenerateModal}
              disabled={isGenerating}
              className="landing__primary-button roadmap-generate"
              style={{ padding: '10px 24px', width: 'auto', margin: 0 }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="tw-dc7972ebf3 tw-11e59c6d5f tw-afbdd13a38 tw-dffcdbf826" />
                  <span>Создание...</span>
                </>
              ) : (
                <>
                  <Wand2 className="tw-dc7972ebf3 tw-11e59c6d5f tw-dffcdbf826" />
                  <span>{isGenerated ? 'Пересоздать план' : 'Сгенерировать план'}</span>
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261" style={{ margin: 0 }}>{errorMessage}</p>
          )}

        </header>

        {isGenerated && (
          <div className="roadmap-track-switcher" role="group" aria-label="Направление дорожной карты">
            {ROADMAP_TRACKS.map((track) => {
              const trackSteps = steps.filter((step) => (step.track || 'academics') === track.id);
              const isSelected = selectedTrack === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={trackSteps.length === 0}
                  onClick={() => selectTrack(track.id)}
                  className={`roadmap-track-switcher__tab${isSelected ? ' roadmap-track-switcher__tab--active' : ''}`}
                >
                  <span>{track.label}</span>
                  <span className="roadmap-track-switcher__count">{trackSteps.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Grid Layout */}
        <div
          className="roadmap-grid"
          id="roadmap-track-panel"
          style={{ marginTop: '24px' }}
        >
          
          {/* Left Column: Steps List (5 cols) */}
          <div className="roadmap-steps">
            <span className="landing__section-label">
              Этапы дорожной карты
            </span>

            <div className="roadmap-timeline">
              {visibleSteps.map((step) => {
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
          {activeStep ? <div className="roadmap-details">
            
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
                    <strong className="tw-69450ef148 tw-93914e0db1">Инструкция:</strong> Нажмите «Сгенерировать план», чтобы развернуть структуру академического плана.
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
                          <span className="task-type-tag">{taskTypeLabel(task.task_type)}</span>
                        </div>
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
                          </button>
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

          </div> : (
            <div className="roadmap-details roadmap-details--empty">
              <p>В этом направлении пока нет этапов. Сгенерируйте план заново, чтобы добавить их.</p>
            </div>
          )}

        </div>

      </div>

      {/* Modal Dialog for Preferences */}
      {isModalOpen && (
        <div className="roadmap-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="roadmap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="roadmap-modal__header">
              <div className="roadmap-modal__title-wrap">
                <Wand2 className="roadmap-modal__icon" />
                <h2>Параметры генерации</h2>
              </div>
              <button 
                type="button" 
                className="roadmap-modal__close" 
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateRoadmap} className="roadmap-modal__body">
              <label htmlFor="modal-preferences" className="roadmap-modal__label">
                Дополнительные пожелания и предпочтения
              </label>
              <textarea
                id="modal-preferences"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                maxLength={500}
                placeholder="Укажите ваши интересы, желаемые олимпиады или направления (например: фокус на Machine Learning, подбор стажировок, олимпиады по CS)..."
                className="roadmap-modal__textarea"
                rows={4}
                autoFocus
              />

              <div className="roadmap-modal__footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="roadmap-modal__btn-secondary"
                  disabled={isGenerating}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="landing__primary-button roadmap-modal__btn-primary"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="roadmap-spinner" />
                      <span>Генерация...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      <span>Сгенерировать</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </main>
      </div>
    </div>
  );
};

export default Roadmap;