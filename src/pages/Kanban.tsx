import React, { useState, useEffect } from 'react';
import '../styles/Kanban.css';
import '../styles/Landing.css';
import '../styles/TaskTypeTag.css';
import { 
  CheckCircle2, 
  Circle, 
  Plus,
  Sparkles,
  FileText,
  Link as LinkIcon,
  X,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { taskTypeLabel } from '../lib/taskTypes';

interface MicroStep {
  id: string;
  title: string;
  completed: boolean;
}

interface TaskArtifact {
  type: 'link' | 'explanation';
  value: string;
}

interface Task {
  id: string;
  title: string;
  task_type: string;
  status: 'todo' | 'in_progress' | 'done';
  micro_steps: MicroStep[];
  artifact?: TaskArtifact;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const MAX_DAILY_TASKS = 5;

export const KanbanBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Стейт сворачивания описания/шапки
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  
  // Модалка создания задачи
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState('development');
  const [newTaskMicroSteps, setNewTaskMicroSteps] = useState<string>('Изучить требования\nНаписать код\nПроверить');
  
  // Стейт генерации из Roadmap с помощью AI
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);

  // Модалка артефакта при завершении микро-шага
  const [completingTarget, setCompletingTarget] = useState<{ task: Task; microStep: MicroStep } | null>(null);
  const [artifactType, setArtifactType] = useState<'explanation' | 'link'>('explanation');
  const [artifactValue, setArtifactValue] = useState('');
  const [artifactError, setArtifactError] = useState('');

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const controller = new AbortController();
    void fetch(`${API_BASE_URL.replace(/\/$/, '')}/kanban/tasks`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json().catch(() => null) as Task[] | { error?: string } | null;
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(result && !Array.isArray(result) ? result.error : 'Не удалось загрузить задачи');
      }
      setTasks(result);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить задачи');
    }).finally(() => setIsLoadingTasks(false));

    return () => controller.abort();
  }, []);

  const saveTask = async (task: Task): Promise<boolean> => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setErrorMessage('Сессия истекла. Войдите снова.');
      return false;
    }
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/kanban/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: task.status, 
          micro_steps: task.micro_steps,
          artifact: task.artifact 
        }),
      });
      const result = await response.json().catch(() => null) as Task & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? 'Не удалось сохранить задачу');
      setTasks((previous) => previous.map((item) => item.id === result.id ? result : item));
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить задачу');
      return false;
    }
  };

  const handleToggleMicroStep = (task: Task, microStep: MicroStep) => {
    if (!microStep.completed) {
      setCompletingTarget({ task, microStep });
      setArtifactValue('');
      setArtifactError('');
      return;
    }

    const microSteps = task.micro_steps.map((item) => item.id === microStep.id
      ? { ...item, completed: false }
      : item);
    
    const anyDone = microSteps.some((item) => item.completed);
    const nextStatus = anyDone ? 'in_progress' : 'todo';

    void saveTask({ ...task, status: nextStatus, micro_steps: microSteps });
  };

  const confirmMicroStepCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTarget) return;

    const { task, microStep } = completingTarget;
    const trimmed = artifactValue.trim();

    if (artifactType === 'link') {
      try {
        new URL(trimmed);
      } catch {
        setArtifactError('Укажите корректную ссылку (http:// или https://)');
        return;
      }
    } else if (trimmed.length < 5) {
      setArtifactError('Опишите результат подробнее (мин. 5 символов).');
      return;
    }

    const microSteps = task.micro_steps.map((item) => item.id === microStep.id
      ? { ...item, completed: true }
      : item);

    const allDone = microSteps.every((item) => item.completed);
    const nextStatus = allDone ? 'done' : 'in_progress';

    const updatedTask: Task = {
      ...task,
      status: nextStatus,
      micro_steps: microSteps,
      artifact: { type: artifactType, value: trimmed }
    };

    const success = await saveTask(updatedTask);
    if (success) {
      setCompletingTarget(null);
    }
  };

  const handleGenerateRoadmapPlan = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setErrorMessage('Сессия истекла. Войдите снова.');
      return;
    }

    setIsGeneratingRoadmap(true);
    setErrorMessage('');

    try {
      await new Promise(r => setTimeout(r, 700));

      const mockRoadmapTask = {
        title: 'Реализовать защиту роутов и JWT авторизацию',
        task_type: 'backend',
        micro_steps: [
          { id: crypto.randomUUID(), title: 'Написать middleware проверки токена', completed: false },
          { id: crypto.randomUUID(), title: 'Интегрировать в Go роутер', completed: false },
          { id: crypto.randomUUID(), title: 'Протестировать через Postman', completed: false }
        ],
        status: 'todo'
      };

      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/kanban/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mockRoadmapTask),
      });

      const result = await response.json().catch(() => null) as Task & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? 'Не удалось сгенерировать план из Roadmap');
      
      setTasks((previous) => [result, ...previous]);
      setIsTaskModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось получить план от AI');
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (tasks.length >= MAX_DAILY_TASKS) {
      setErrorMessage(`Достигнут лимит фокуса: не более ${MAX_DAILY_TASKS} целей на день.`);
      return;
    }

    const microStepsList: MicroStep[] = newTaskMicroSteps
      .split('\n')
      .filter((s) => s.trim().length > 0)
      .map((s) => ({
        id: crypto.randomUUID(),
        title: s.replace(/^[-*]\s*/, '').trim(),
        completed: false,
      }));

    const taskInput = {
      title: newTaskTitle.trim(),
      task_type: newTaskType,
      micro_steps: microStepsList.length > 0 ? microStepsList : [{ id: crypto.randomUUID(), title: 'Основной шаг', completed: false }],
      status: 'todo',
    };

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return setErrorMessage('Сессия истекла. Войдите снова.');
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/kanban/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(taskInput),
      });
      const result = await response.json().catch(() => null) as Task & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? 'Не удалось создать задачу');
      setTasks((previous) => [result, ...previous]);
      setNewTaskTitle('');
      setIsTaskModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать задачу');
    }
  };

  const allMicroSteps = tasks.flatMap((task) => 
    task.micro_steps.map((micro) => ({
      ...micro,
      parentTask: task,
    }))
  );

  const todoSteps = allMicroSteps.filter((m) => !m.completed && m.parentTask.status !== 'done');
  const doneSteps = allMicroSteps.filter((m) => m.completed || m.parentTask.status === 'done');

  const totalStepsCount = allMicroSteps.length;
  const completedStepsCount = doneSteps.length;
  const progressPercentage = totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0;

  return (
    <div className="landing-page tw-793346c736" style={{ paddingBottom: '32px', paddingTop: '84px' }}>
      <div className="landing__hero-decoration" />
      
      <div className="tw-6da6a3c3f7 tw-c0491287cc tw-0e12dc7de9 tw-f0faeb26d6 tw-8fb6f42ff2 tw-61357c0c2f tw-8107d37319" style={{ padding: '16px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Хедер фокуса с возможностью сворачивания */}
        <header className="tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div className="landing__badge" style={{ marginBottom: '4px', padding: '2px 8px', fontSize: '11px' }}>
                <Layers className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e" style={{ width: '12px', height: '12px' }} />
                <span>Микро-шаги фокуса ({tasks.length} задач / {totalStepsCount} шагов)</span>
              </div>
              <h1 className="tw-751fb0d102 tw-c3c844442d tw-7fbb85697d" style={{ fontSize: '20px', margin: 0 }}>
                Доска микро-шагов
              </h1>
            </div>

            <button
              type="button"
              onClick={() => setIsHeaderCollapsed((prev) => !prev)}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#475569',
                fontWeight: 500
              }}
            >
              {isHeaderCollapsed ? (
                <>Развернуть описание <ChevronDown size={14} /></>
              ) : (
                <>Свернуть описание <ChevronUp size={14} /></>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              if (tasks.length >= MAX_DAILY_TASKS) {
                setErrorMessage(`Достигнут лимит фокуса: не более ${MAX_DAILY_TASKS} целей на день.`);
                return;
              }
              setIsTaskModalOpen(true);
            }}
            className="landing__primary-button tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <Plus className="tw-dc7972ebf3 tw-11e59c6d5f" style={{ width: '14px', height: '14px' }} /> Добавить цель с шагами
          </button>
        </header>

        {/* Сворачиваемая область описания и прогресс-бара */}
        {!isHeaderCollapsed && (
          <div style={{ transition: 'all 0.3s ease', marginBottom: '20px' }}>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>
              Разбивайте глобальные цели на атомарные микро-шаги. Отмечайте выполненные задачи и прикрепляйте артефакты для контроля прогресса.
            </p>
            {totalStepsCount > 0 && (
              <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, background: '#e2e8f0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercentage}%`, background: '#111', height: '100%', transition: 'width 0.3s ease' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Выполнено микро-шагов: {completedStepsCount} из {totalStepsCount} ({progressPercentage}%)
                </span>
              </div>
            )}
          </div>
        )}

        {errorMessage && <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261" style={{ fontSize: '12px', margin: '4px 0' }}>{errorMessage}</p>}

        {/* Модальное окно создания задачи */}
        {isTaskModalOpen && (
          <div className="tw-7bc555991d tw-7b7df0449b tw-181b286668 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-fd9dca32f4 tw-1839ae9d4d tw-8e63407b5c">
            <div className="tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-ea189a088a tw-0478c89a15 tw-9794ab4509 tw-6da6a3c3f7 tw-a739868a85 tw-3e7ce58d64" style={{ maxWidth: '460px', width: '100%', padding: '20px' }}>
              <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-65fdbade20 tw-18049387f0 tw-7fcf9124b5" style={{ marginBottom: '12px' }}>
                <h3 className="tw-4ee734926f tw-7fbb85697d tw-5358eecb47" style={{ fontSize: '15px', margin: 0 }}>Добавление цели и шагов</h3>
                <button onClick={() => setIsTaskModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <button
                  type="button"
                  disabled={isGeneratingRoadmap}
                  onClick={handleGenerateRoadmapPlan}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #111 0%, #333 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <Sparkles size={15} />
                  {isGeneratingRoadmap ? 'Анализирую Roadmap...' : 'Составить план с помощью AI (из Roadmap)'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', color: '#94a3b8', fontSize: '11px' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span>или вручную</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>Название задачи (родительская цель)</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Например: Архитектура бэкенда"
                    style={{ width: '100%', fontSize: '13px', padding: '8px', borderRadius: 6, border: '1px solid #ccc' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>Направление (Тег)</label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    style={{ width: '100%', fontSize: '13px', padding: '6px', borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="development">Development</option>
                    <option value="backend">Backend</option>
                    <option value="database">Database</option>
                    <option value="presentation">Presentation</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>Микро-шаги (каждый с новой строки)</label>
                  <textarea
                    rows={3}
                    value={newTaskMicroSteps}
                    onChange={(e) => setNewTaskMicroSteps(e.target.value)}
                    style={{ width: '100%', fontSize: '13px', padding: '8px', borderRadius: 6, border: '1px solid #ccc' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    style={{ padding: '6px 12px', fontSize: '12px', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="landing__primary-button"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    Добавить цель
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Модальное окно артефакта */}
        {completingTarget && (
          <div className="tw-7bc555991d tw-7b7df0449b tw-181b286668 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-fd9dca32f4 tw-1839ae9d4d tw-8e63407b5c">
            <form onSubmit={confirmMicroStepCompletion} className="tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-ea189a088a tw-0478c89a15 tw-9794ab4509 tw-6da6a3c3f7 tw-a739868a85 tw-3e7ce58d64" style={{ maxWidth: '400px', width: '100%', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '15px', margin: 0 }}>Результат микро-шага</h3>
                <button type="button" onClick={() => setCompletingTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>

              <p style={{ fontSize: '12px', color: '#666', marginBottom: 12 }}>
                Для шага <strong>«{completingTarget.microStep.title}»</strong> (задача: <em>{completingTarget.task.title}</em>) прикрепите артефакт или вывод.
              </p>

              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setArtifactType('explanation')}
                  style={{
                    flex: 1, padding: '6px', borderRadius: 6, border: 'none', fontSize: '12px', cursor: 'pointer',
                    background: artifactType === 'explanation' ? '#111' : '#f1f1f3',
                    color: artifactType === 'explanation' ? '#fff' : '#333'
                  }}
                >
                  <FileText size={12} style={{ display: 'inline', marginRight: 4 }} /> Вывод
                </button>
                <button
                  type="button"
                  onClick={() => setArtifactType('link')}
                  style={{
                    flex: 1, padding: '6px', borderRadius: 6, border: 'none', fontSize: '12px', cursor: 'pointer',
                    background: artifactType === 'link' ? '#111' : '#f1f1f3',
                    color: artifactType === 'link' ? '#fff' : '#333'
                  }}
                >
                  <LinkIcon size={12} style={{ display: 'inline', marginRight: 4 }} /> Ссылка
                </button>
              </div>

              {artifactType === 'explanation' ? (
                <textarea
                  rows={2}
                  value={artifactValue}
                  onChange={(e) => setArtifactValue(e.target.value)}
                  placeholder="Что сделано / инсайт (мин. 5 символов)..."
                  style={{ width: '100%', fontSize: '12px', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginBottom: 8 }}
                />
              ) : (
                <input
                  type="url"
                  value={artifactValue}
                  onChange={(e) => setArtifactValue(e.target.value)}
                  placeholder="https://github.com/..."
                  style={{ width: '100%', fontSize: '12px', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginBottom: 8 }}
                />
              )}

              {artifactError && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: 8 }}>{artifactError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" onClick={() => setCompletingTarget(null)} style={{ padding: '6px 10px', fontSize: '12px', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отмена</button>
                <button type="submit" style={{ padding: '6px 12px', fontSize: '12px', background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Подтвердить ✓</button>
              </div>
            </form>
          </div>
        )}

        {/* Канбан-лейаут для микро-шагов */}
        {isLoadingTasks ? (
          <div style={{ textAlign: 'center', padding: '30px', fontSize: '13px', color: '#666' }}>Загружаем микро-шаги...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
            
            {/* Колонка: К выполнению */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Circle size={14} style={{ color: '#64748b' }} /> К выполнению
                </h3>
                <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px' }}>
                  {todoSteps.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todoSteps.map((micro) => (
                  <div
                    key={micro.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span className="task-type-tag" style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px' }}>
                        {taskTypeLabel(micro.parentTask.task_type)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                        {micro.parentTask.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleMicroStep(micro.parentTask, micro)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: '2px' }}
                      >
                        <Circle size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      </button>
                      <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500, lineHeight: 1.3 }}>
                        {micro.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleMicroStep(micro.parentTask, micro)}
                        style={{ background: '#111', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
                      >
                        Завершить шаг ✓
                      </button>
                    </div>
                  </div>
                ))}

                {todoSteps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', fontSize: '12px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                    Все микро-шаги выполнены! 🎉
                  </div>
                )}
              </div>
            </div>

            {/* Колонка: Выполнено */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a' }} /> Выполнено
                </h3>
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px' }}>
                  {doneSteps.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {doneSteps.map((micro) => (
                  <div
                    key={micro.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '12px',
                      opacity: 0.8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span className="task-type-tag" style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '4px' }}>
                        {taskTypeLabel(micro.parentTask.task_type)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, textDecoration: 'line-through' }}>
                        {micro.parentTask.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleMicroStep(micro.parentTask, micro)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: '2px' }}
                      >
                        <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                      </button>
                      <span style={{ fontSize: '13px', color: '#64748b', textDecoration: 'line-through', lineHeight: 1.3 }}>
                        {micro.title}
                      </span>
                    </div>

                    {micro.parentTask.artifact && (
                      <div style={{ marginTop: '4px', padding: '6px 8px', background: '#edf2f7', borderRadius: '6px', fontSize: '11px' }}>
                        <span style={{ fontWeight: 500, color: '#475569' }}>Артефакт: </span>
                        {micro.parentTask.artifact.type === 'link' ? (
                          <a href={micro.parentTask.artifact.value} target="_blank" rel="noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>
                            {micro.parentTask.artifact.value}
                          </a>
                        ) : (
                          <span style={{ color: '#334155' }}>{micro.parentTask.artifact.value}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {doneSteps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', fontSize: '12px', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                    Пока нет завершенных шагов
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {tasks.length === 0 && !isLoadingTasks && (
          <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: '13px', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '12px', background: '#fafafa', marginTop: '20px' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
            На сегодня микроцелей пока нет. Нажмите «Добавить цель с шагами» или сгенерируйте план из Roadmap с помощью AI.
          </div>
        )}

      </div>
    </div>
  );
};

export default KanbanBoard;