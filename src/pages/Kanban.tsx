import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Kanban, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle2, 
  Circle, 
  Timer, 
  Check,
  Flame,
  Plus,
  LayoutGrid
} from 'lucide-react';

interface MicroStep {
  id: string;
  title: string;
  estimated_minutes?: number;
  completed: boolean;
  actual_minutes?: number;
}

interface Task {
  id: string;
  title: string;
  duration: string;
  task_type: string;
  status: 'todo' | 'in_progress' | 'done';
  micro_steps: MicroStep[];
}

interface KanbanColumn {
  id: 'todo' | 'in_progress' | 'done';
  title: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: 'todo', title: 'К выполнению' },
  { id: 'in_progress', title: 'В процессе' },
  { id: 'done', title: 'Готово' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const KanbanBoard: React.FC = () => {
  const location = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'kanban' | 'timer'>('kanban');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('1 час');
  const [newTaskType, setNewTaskType] = useState('development');
  const [newTaskMicroSteps, setNewTaskMicroSteps] = useState<string>('Настроить окружение\nНаписать базовый код\nПротестировать');

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeMicroStep, setActiveMicroStep] = useState<MicroStep | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [targetSeconds, setTargetSeconds] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const controller = new AbortController();
    void fetch(`${API_BASE_URL.replace(/\/$/, '')}/kanban/tasks`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json().catch(() => null) as Task[] | { error?: string } | null;
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(result && !Array.isArray(result) ? result.error : 'Не удалось загрузить задачи Kanban');
      }
      setTasks(result);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить задачи Kanban');
    }).finally(() => setIsLoadingTasks(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let interval: number;
    if (isTimerRunning) {
      interval = window.setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const startTimerForMicroStep = (task: Task, microStep: MicroStep) => {
    setActiveTask(task);
    setActiveMicroStep(microStep);
    setSecondsElapsed(0);
    setTargetSeconds((microStep.estimated_minutes ?? 25) * 60);
    setIsTimerRunning(true);
    setActiveTab('timer');
  };

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
        body: JSON.stringify({ status: task.status, micro_steps: task.micro_steps }),
      });
      const result = await response.json().catch(() => null) as Task & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? 'Не удалось сохранить задачу');
      setTasks((previous) => previous.map((item) => item.id === result.id ? result : item));
      setActiveTask((previous) => previous?.id === result.id ? result : previous);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить задачу');
      return false;
    }
  };

  const stopTimerAndSave = async () => {
    if (!activeTask || !activeMicroStep) return;
    const spentMinutes = Math.max(1, Math.round(secondsElapsed / 60));
    const task = tasks.find((item) => item.id === activeTask.id);
    if (!task) return;
    const microSteps = task.micro_steps.map((micro) => micro.id === activeMicroStep.id
      ? { ...micro, completed: true, actual_minutes: spentMinutes }
      : micro);
    const status = microSteps.every((micro) => micro.completed) ? 'done' : 'in_progress';
    if (!await saveTask({ ...task, status, micro_steps: microSteps })) return;

    setIsTimerRunning(false);
    setActiveTask(null);
    setActiveMicroStep(null);
    setSecondsElapsed(0);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const microStepsList: MicroStep[] = newTaskMicroSteps
      .split('\n')
      .filter((s) => s.trim().length > 0)
      .map((s) => ({
        id: crypto.randomUUID(),
        title: s.trim(),
        estimated_minutes: 20,
        completed: false,
      }));

    const taskInput = {
      title: newTaskTitle.trim(),
      duration: newTaskDuration.trim() || '1 час',
      task_type: newTaskType,
      micro_steps: microStepsList.length > 0 ? microStepsList : [{ id: crypto.randomUUID(), title: 'Основная задача', estimated_minutes: 30, completed: false }],
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

  const adjustTime = (minutes: number) => {
    setTargetSeconds((prev) => Math.max(60, prev + minutes * 60));
  };

  const resetTimer = () => {
    setSecondsElapsed(0);
    setIsTimerRunning(false);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumn: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find((item) => item.id === taskId);
    if (task && task.status !== targetColumn) void saveTask({ ...task, status: targetColumn });
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  // Гигантский размер радиуса кругового таймера
  const progressPercent = Math.min(100, (secondsElapsed / targetSeconds) * 100);
  const circleRadius = 140;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (progressPercent / 100) * circleCircumference;

  return (
    <div className="landing-page min-h-screen">
      <div className="landing__hero-decoration" />
      
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-12 space-y-10">
        
        {/* Шапка и переключатель */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-border">
          <div className="space-y-3">
            <div className="landing__badge">
              <Kanban className="w-4 h-4 text-brand" />
              <span>Фокус-режим и задачи</span>
            </div>
            <h1 className="landing__title text-3xl md:text-4xl font-black">
              Доска и <span className="landing__title-accent">таймер фокуса</span>
            </h1>
            <p className="landing__description text-left mx-0 max-w-xl">
              Управляйте процессом с помощью Kanban-доски или переключайтесь на полноэкранный таймер микрошагов.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="landing__primary-button px-4 py-2.5 text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Добавить задачу
            </button>

            <div className="flex items-center gap-1 bg-bg-surface p-1.5 rounded-2xl border border-border shadow-2xs">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
                  activeTab === 'kanban' ? 'bg-brand text-text-inverse shadow-xs' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Kanban
              </button>
              <button
                onClick={() => setActiveTab('timer')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
                  activeTab === 'timer' ? 'bg-brand text-text-inverse shadow-xs' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Timer className="w-4 h-4" /> Таймер
              </button>
            </div>
          </div>
        </header>

        {errorMessage && <p role="alert" className="text-sm font-semibold text-red-700">{errorMessage}</p>}
        {typeof (location.state as { importedCount?: unknown } | null)?.importedCount === 'number' && (
          <p role="status" className="text-sm font-semibold text-text-secondary">
            {(location.state as { importedCount: number }).importedCount > 0
              ? `Добавлено задач из Roadmap: ${(location.state as { importedCount: number }).importedCount}`
              : 'Задачи этого этапа уже есть в Kanban'}
          </p>
        )}

        {/* Модальное окно создания задачи */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-bg-surface border border-border rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-black text-text-primary">Добавить новую задачу</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="text-text-secondary hover:text-text-primary font-bold">✕</button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Название задачи</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Например: Настроить CI/CD пайплайн"
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-secondary block mb-1">Длительность</label>
                    <input
                      type="text"
                      value={newTaskDuration}
                      onChange={(e) => setNewTaskDuration(e.target.value)}
                      placeholder="2 часа"
                      className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary block mb-1">Тип</label>
                    <select
                      value={newTaskType}
                      onChange={(e) => setNewTaskType(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none"
                    >
                      <option value="development">Development</option>
                      <option value="backend">Backend</option>
                      <option value="database">Database</option>
                      <option value="presentation">Presentation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Микрошаги (каждый с новой строки)</label>
                  <textarea
                    rows={4}
                    value={newTaskMicroSteps}
                    onChange={(e) => setNewTaskMicroSteps(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:border-brand focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-secondary hover:text-text-primary"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="landing__primary-button px-5 py-2 text-xs"
                  >
                    Создать задачу
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Основной контент */}
        {activeTab === 'kanban' ? isLoadingTasks ? (
          <div className="flex min-h-60 items-center justify-center text-sm font-semibold text-text-secondary">Загружаем задачи...</div>
        ) : (
          /* Kanban Доска */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {COLUMNS.map((col) => {
              const columnTasks = tasks.filter((task) => task.status === col.id);

              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className="bg-bg-surface border border-border rounded-3xl p-5 flex flex-col min-h-[540px] shadow-2xs"
                >
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                    <span className="text-xs font-black uppercase tracking-wider text-text-secondary">
                      {col.title}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-bg-primary border border-border text-brand">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="space-y-4 flex-1">
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="bg-bg-primary border border-border rounded-2xl p-4 shadow-2xs cursor-grab active:cursor-grabbing hover:border-brand/60 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-black text-text-primary leading-snug">
                            {task.title}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-light text-brand shrink-0">
                            {task.duration}
                          </span>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/80">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                            Микрошаги:
                          </span>
                          {task.micro_steps.map((micro) => (
                            <div
                              key={micro.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-bg-surface border border-border text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {micro.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                                ) : (
                                  <Circle className="w-4 h-4 text-text-secondary shrink-0" />
                                )}
                                <span className={`truncate ${micro.completed ? 'line-through text-text-secondary' : 'font-semibold text-text-primary'}`}>
                                  {micro.title}
                                </span>
                              </div>

                              {!micro.completed && (
                                <button
                                  onClick={() => startTimerForMicroStep(task, micro)}
                                  className="px-2 py-1 rounded-lg bg-brand text-text-inverse hover:bg-brand-hover transition-colors shrink-0 text-[10px] font-bold flex items-center gap-1"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" /> Старт
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="h-40 flex items-center justify-center text-xs text-text-secondary/60 border-2 border-dashed border-border rounded-2xl">
                        Перетащите карточку сюда
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* РАЗДЕЛИМ НА ДВЕ ПЛАШКИ: СЛЕВА ТЕКСТ, СПРАВА ГИГАНТСКИЙ ТАЙМЕР */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Левая плашка: Информация о задаче и микрошаге */}
            <div className="lg:col-span-6 bg-bg-surface border border-border rounded-3xl p-8 shadow-xl flex flex-col justify-between space-y-6">
              {activeMicroStep ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-light text-brand text-xs font-black uppercase tracking-wider">
                    <Flame className="w-4 h-4" /> Активный фокус
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Микрошаг</span>
                    <h2 className="text-2xl font-black text-text-primary leading-tight">{activeMicroStep.title}</h2>
                  </div>
                  <div className="space-y-1 pt-4 border-t border-border">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Родительская задача</span>
                    <p className="text-base font-bold text-text-primary">{activeTask?.title}</p>
                    <p className="text-xs text-text-secondary">Длительность: {activeTask?.duration}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 my-auto text-center py-12">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-text-secondary block">
                    Ожидание фокуса
                  </span>
                  <h2 className="text-2xl font-black text-text-primary">Микрошаг не выбран</h2>
                  <p className="text-sm text-text-secondary max-w-sm mx-auto">
                    Перейдите на Kanban-доску и нажмите «Старт» на любом микрошаге задачи, чтобы запустить сессию.
                  </p>
                </div>
              )}

              {activeMicroStep && (
                <button
                  onClick={stopTimerAndSave}
                  className="landing__primary-button w-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-md"
                >
                  <Check className="w-5 h-5" /> Завершить микрошаг
                </button>
              )}
            </div>

            {/* Правая плашка: Гигантский круглый таймер и управление */}
            <div className="lg:col-span-6 bg-bg-surface border border-border rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center text-center space-y-6">
              
              <div className="relative flex items-center justify-center">
                <svg className="w-72 h-72 transform -rotate-90">
                  <circle
                    cx="144"
                    cy="144"
                    r={circleRadius}
                    className="stroke-bg-primary"
                    strokeWidth="16"
                    fill="transparent"
                  />
                  <circle
                    cx="144"
                    cy="144"
                    r={circleRadius}
                    className="stroke-brand transition-all duration-500"
                    strokeWidth="16"
                    strokeDasharray={circleCircumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-6xl font-black text-text-primary font-mono tracking-tighter">
                    {formatTime(secondsElapsed)}
                  </span>
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider mt-2">
                    цель: {Math.round(targetSeconds / 60)} мин
                  </span>
                </div>
              </div>

              {/* Панель регуляции времени */}
              <div className="flex items-center justify-center gap-3 w-full">
                <button 
                  onClick={() => adjustTime(-5)} 
                  className="px-4 py-2 bg-bg-primary border border-border rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary"
                >
                  -5 мин
                </button>
                <button 
                  onClick={() => adjustTime(5)} 
                  className="px-4 py-2 bg-bg-primary border border-border rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary"
                >
                  +5 мин
                </button>
                {isTimerRunning ? (
                  <button
                    onClick={() => setIsTimerRunning(false)}
                    className="p-2.5 bg-bg-primary border border-border rounded-xl text-text-primary hover:bg-bg-secondary"
                    title="Пауза"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  activeMicroStep && (
                    <button
                      onClick={() => setIsTimerRunning(true)}
                      className="p-2.5 bg-brand text-text-inverse rounded-xl hover:bg-brand-hover"
                      title="Продолжить"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </button>
                  )
                )}
                <button
                  onClick={resetTimer}
                  className="p-2.5 bg-bg-primary border border-border rounded-xl text-text-secondary hover:text-text-primary"
                  title="Сбросить"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default KanbanBoard;