import React, { useState, useEffect } from 'react';
import '../styles/Kanban.css';
import { useLocation } from 'react-router-dom';
import '../styles/Landing.css';
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
    <div className="landing-page tw-793346c736">
      <div className="landing__hero-decoration" />
      
      <div className="tw-6da6a3c3f7 tw-c0491287cc tw-0e12dc7de9 tw-f0faeb26d6 tw-8fb6f42ff2 tw-61357c0c2f tw-8107d37319">
        
        {/* Шапка и переключатель */}
        <header className="tw-60fbb77139 tw-8dddea0773 tw-4102dddfda tw-bf60a82ffb tw-db6dd3a2aa tw-0d304f904c tw-fe985ca216 tw-65fdbade20 tw-18049387f0">
          <div className="tw-6ed543e2fb">
            <div className="landing__badge">
              <Kanban className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e" />
              <span>Фокус-режим и задачи</span>
            </div>
            <h1 className="landing__title tw-751fb0d102 tw-c3c844442d tw-7fbb85697d">
              Доска и <span className="landing__title-accent">таймер фокуса</span>
            </h1>
            <p className="landing__description tw-2eba0d65d0 tw-ba8928735d tw-9ef2b581bf">
              Управляйте процессом с помощью Kanban-доски или переключайтесь на полноэкранный таймер микрошагов.
            </p>
          </div>

          <div className="tw-60fbb77139 tw-3960ffc248 tw-1004c0c395">
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="landing__primary-button tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90"
            >
              <Plus className="tw-dc7972ebf3 tw-11e59c6d5f" /> Добавить задачу
            </button>

            <div className="tw-60fbb77139 tw-3960ffc248 tw-44ee8ba0a4 tw-48a2a9e0eb tw-cd009d7d20 tw-68f2db624d tw-ca6bcd4b6f tw-18049387f0 tw-ea11cab451">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90 tw-f0faeb26d6 tw-03b4dd7f17 tw-359090c2d5 tw-7fbb85697d tw-a217b4eaa9 tw-0fe7d7d814 ${
                  activeTab === "kanban" ? "tw-da1032643a tw-dffcdbf826 tw-cef5b893cf" : "tw-16720c5987 tw-1852007365"
                }`}
              >
                <LayoutGrid className="tw-dc7972ebf3 tw-11e59c6d5f" /> Kanban
              </button>
              <button
                onClick={() => setActiveTab('timer')}
                className={`tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90 tw-f0faeb26d6 tw-03b4dd7f17 tw-359090c2d5 tw-7fbb85697d tw-a217b4eaa9 tw-0fe7d7d814 ${
                  activeTab === "timer" ? "tw-da1032643a tw-dffcdbf826 tw-cef5b893cf" : "tw-16720c5987 tw-1852007365"
                }`}
              >
                <Timer className="tw-dc7972ebf3 tw-11e59c6d5f" /> Таймер
              </button>
            </div>
          </div>
        </header>

        {errorMessage && <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261">{errorMessage}</p>}
        {typeof (location.state as { importedCount?: unknown } | null)?.importedCount === 'number' && (
          <p role="status" className="tw-fc7473ca09 tw-e83a7042bc tw-16720c5987">
            {(location.state as { importedCount: number }).importedCount > 0
              ? `Добавлено задач из Roadmap: ${(location.state as { importedCount: number }).importedCount}`
              : 'Задачи этого этапа уже есть в Kanban'}
          </p>
        )}

        {/* Модальное окно создания задачи */}
        {isTaskModalOpen && (
          <div className="tw-7bc555991d tw-7b7df0449b tw-181b286668 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-fd9dca32f4 tw-1839ae9d4d tw-8e63407b5c">
            <div className="tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-ea189a088a tw-0478c89a15 tw-9794ab4509 tw-6da6a3c3f7 tw-a739868a85 tw-3e7ce58d64">
              <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-65fdbade20 tw-18049387f0 tw-7fcf9124b5">
                <h3 className="tw-4ee734926f tw-7fbb85697d tw-5358eecb47">Добавить новую задачу</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="tw-16720c5987 tw-1852007365 tw-69450ef148">✕</button>
              </div>

              <form onSubmit={handleCreateTask} className="tw-3e7ce58d64">
                <div>
                  <label className="tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-0214b4b355 tw-65281709da">Название задачи</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Например: Настроить CI/CD пайплайн"
                    className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-e0d9cc7f06 tw-e7ee55ac7f tw-359090c2d5 tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb"
                    required
                  />
                </div>

                <div className="tw-f3c543ad5f tw-8e75e3db48 tw-1004c0c395">
                  <div>
                    <label className="tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-0214b4b355 tw-65281709da">Длительность</label>
                    <input
                      type="text"
                      value={newTaskDuration}
                      onChange={(e) => setNewTaskDuration(e.target.value)}
                      placeholder="2 часа"
                      className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-e0d9cc7f06 tw-e7ee55ac7f tw-359090c2d5 tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb"
                    />
                  </div>
                  <div>
                    <label className="tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-0214b4b355 tw-65281709da">Тип</label>
                    <select
                      value={newTaskType}
                      onChange={(e) => setNewTaskType(e.target.value)}
                      className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-0e17f2bd90 tw-e7ee55ac7f tw-359090c2d5 tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb"
                    >
                      <option value="development">Development</option>
                      <option value="backend">Backend</option>
                      <option value="database">Database</option>
                      <option value="presentation">Presentation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-0214b4b355 tw-65281709da">Микрошаги (каждый с новой строки)</label>
                  <textarea
                    rows={4}
                    value={newTaskMicroSteps}
                    onChange={(e) => setNewTaskMicroSteps(e.target.value)}
                    className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-e0d9cc7f06 tw-e7ee55ac7f tw-359090c2d5 tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb tw-6aef320168"
                  />
                </div>

                <div className="tw-60fbb77139 tw-77c08e015d tw-77a2a20e90 tw-f46b61a9b3">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="tw-f0faeb26d6 tw-03b4dd7f17 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-1852007365"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="landing__primary-button tw-d139dd09e3 tw-03b4dd7f17 tw-359090c2d5"
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
          <div className="tw-60fbb77139 tw-07f663aa26 tw-3960ffc248 tw-86843cf1e2 tw-fc7473ca09 tw-e83a7042bc tw-16720c5987">Загружаем задачи...</div>
        ) : (
          /* Kanban Доска */
          <div className="tw-f3c543ad5f tw-d7c8339810 tw-9a638cfe82 tw-0d304f904c tw-60541e1e26">
            {COLUMNS.map((col) => {
              const columnTasks = tasks.filter((task) => task.status === col.id);

              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className="tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-ea189a088a tw-c07e54fd14 tw-60fbb77139 tw-8dddea0773 tw-b2fe516767 tw-ea11cab451"
                >
                  <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-7fcf9124b5 tw-da019856f2 tw-65fdbade20 tw-18049387f0">
                    <span className="tw-359090c2d5 tw-7fbb85697d tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">
                      {col.title}
                    </span>
                    <span className="tw-359090c2d5 tw-69450ef148 tw-0b91436deb tw-465609a240 tw-ac204c1088 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-17d820623e">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="tw-3e7ce58d64 tw-36e579c0b4">
                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-68f2db624d tw-8e63407b5c tw-ea11cab451 tw-8d08385288 tw-d9bff91ef7 tw-99235827a9 tw-0fe7d7d814 tw-6ed543e2fb"
                      >
                        <div className="tw-60fbb77139 tw-60541e1e26 tw-8ef2268efb tw-77a2a20e90">
                          <h3 className="tw-fc7473ca09 tw-7fbb85697d tw-5358eecb47 tw-e25ca6535d">
                            {task.title}
                          </h3>
                          <span className="tw-1dc571a360 tw-69450ef148 tw-d5eab218aa tw-465609a240 tw-07389a777c tw-84c2118f8b tw-17d820623e tw-012fbd121f">
                            {task.duration}
                          </span>
                        </div>

                        <div className="tw-6f7e013d64 tw-f46b61a9b3 tw-b950dda299 tw-c9ed8c5f79">
                          <span className="tw-1dc571a360 tw-69450ef148 tw-16720c5987 tw-117ec720ea tw-09ace3a4d9 tw-0214b4b355">
                            Микрошаги:
                          </span>
                          {task.micro_steps.map((micro) => (
                            <div
                              key={micro.id}
                              className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-77a2a20e90 tw-7660b45090 tw-a217b4eaa9 tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-359090c2d5"
                            >
                              <div className="tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90 tw-7e0b7cdf1a">
                                {micro.completed ? (
                                  <CheckCircle2 className="tw-dc7972ebf3 tw-11e59c6d5f tw-17d820623e tw-012fbd121f" />
                                ) : (
                                  <Circle className="tw-dc7972ebf3 tw-11e59c6d5f tw-16720c5987 tw-012fbd121f" />
                                )}
                                <span className={`tw-f283ea9bea ${micro.completed ? "tw-093ca5623c tw-16720c5987" : "tw-e83a7042bc tw-5358eecb47"}`}>
                                  {micro.title}
                                </span>
                              </div>

                              {!micro.completed && (
                                <button
                                  onClick={() => startTimerForMicroStep(task, micro)}
                                  className="tw-d5eab218aa tw-660d2effb8 tw-5f22e64f22 tw-da1032643a tw-dffcdbf826 tw-6dc89721e0 tw-ceb69a6b0e tw-012fbd121f tw-1dc571a360 tw-69450ef148 tw-60fbb77139 tw-3960ffc248 tw-44ee8ba0a4"
                                >
                                  <Play className="tw-650758f457 tw-9b3d0721b6 tw-20269b6b37" /> Старт
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="tw-aadad6871a tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-359090c2d5 tw-b9651dc646 tw-65935df577 tw-a29b7a649c tw-18049387f0 tw-68f2db624d">
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
          <div className="tw-f3c543ad5f tw-d7c8339810 tw-6f0825385d tw-1500488ab7 tw-a13d486c14">
            
            {/* Левая плашка: Информация о задаче и микрошаге */}
            <div className="tw-31d80d2964 tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-ea189a088a tw-845f53365c tw-a739868a85 tw-60fbb77139 tw-8dddea0773 tw-8ef2268efb tw-b3542e0588">
              {activeMicroStep ? (
                <div className="tw-3e7ce58d64">
                  <div className="tw-52083e7da4 tw-3960ffc248 tw-58284b4ea5 tw-0e17f2bd90 tw-660d2effb8 tw-ac204c1088 tw-84c2118f8b tw-17d820623e tw-359090c2d5 tw-7fbb85697d tw-117ec720ea tw-09ace3a4d9">
                    <Flame className="tw-dc7972ebf3 tw-11e59c6d5f" /> Активный фокус
                  </div>
                  <div className="tw-6f7e013d64">
                    <span className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">Микрошаг</span>
                    <h2 className="tw-3febee094e tw-7fbb85697d tw-5358eecb47 tw-e9fadafbd4">{activeMicroStep.title}</h2>
                  </div>
                  <div className="tw-da7c36cd88 tw-173fa8f067 tw-b950dda299 tw-18049387f0">
                    <span className="tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">Родительская задача</span>
                    <p className="tw-4ee734926f tw-69450ef148 tw-5358eecb47">{activeTask?.title}</p>
                    <p className="tw-359090c2d5 tw-16720c5987">Длительность: {activeTask?.duration}</p>
                  </div>
                </div>
              ) : (
                <div className="tw-6ed543e2fb tw-705e7c2001 tw-ca6bf63030 tw-61357c0c2f">
                  <span className="tw-359090c2d5 tw-0ce2a7f443 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-0214b4b355">
                    Ожидание фокуса
                  </span>
                  <h2 className="tw-3febee094e tw-7fbb85697d tw-5358eecb47">Микрошаг не выбран</h2>
                  <p className="tw-fc7473ca09 tw-16720c5987 tw-2472e9b81a tw-0e12dc7de9">
                    Перейдите на Kanban-доску и нажмите «Старт» на любом микрошаге задачи, чтобы запустить сессию.
                  </p>
                </div>
              )}

              {activeMicroStep && (
                <button
                  onClick={stopTimerAndSave}
                  className="landing__primary-button tw-6da6a3c3f7 tw-69e76918fe tw-fc7473ca09 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-77a2a20e90 tw-febc34e471"
                >
                  <Check className="tw-72470489ff tw-cd0d9c512c" /> Завершить микрошаг
                </button>
              )}
            </div>

            {/* Правая плашка: Гигантский круглый таймер и управление */}
            <div className="tw-31d80d2964 tw-48a2a9e0eb tw-ca6bcd4b6f tw-18049387f0 tw-ea189a088a tw-845f53365c tw-a739868a85 tw-60fbb77139 tw-8dddea0773 tw-3960ffc248 tw-86843cf1e2 tw-ca6bf63030 tw-b3542e0588">
              
              <div className="tw-d89972fe17 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2">
                <svg className="tw-92e13d146f tw-ff4a6777f1 tw-dd8ce13ad1 tw-31c8b9f7c5">
                  <circle
                    cx="144"
                    cy="144"
                    r={circleRadius}
                    className="tw-7756a63f45"
                    strokeWidth="16"
                    fill="transparent"
                  />
                  <circle
                    cx="144"
                    cy="144"
                    r={circleRadius}
                    className="tw-792e0e4de8 tw-0fe7d7d814 tw-844322115e"
                    strokeWidth="16"
                    strokeDasharray={circleCircumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="tw-da4dbfbc4f tw-60fbb77139 tw-8dddea0773 tw-3960ffc248 tw-86843cf1e2 tw-ca6bf63030">
                  <span className="tw-0f9d55973b tw-7fbb85697d tw-5358eecb47 tw-0e65706bcc tw-59eb8729d4">
                    {formatTime(secondsElapsed)}
                  </span>
                  <span className="tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-117ec720ea tw-09ace3a4d9 tw-50d0d216a2">
                    цель: {Math.round(targetSeconds / 60)} мин
                  </span>
                </div>
              </div>

              {/* Панель регуляции времени */}
              <div className="tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-1004c0c395 tw-6da6a3c3f7">
                <button 
                  onClick={() => adjustTime(-5)} 
                  className="tw-f0faeb26d6 tw-03b4dd7f17 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-a217b4eaa9 tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-1852007365"
                >
                  -5 мин
                </button>
                <button 
                  onClick={() => adjustTime(5)} 
                  className="tw-f0faeb26d6 tw-03b4dd7f17 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-a217b4eaa9 tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-1852007365"
                >
                  +5 мин
                </button>
                {isTimerRunning ? (
                  <button
                    onClick={() => setIsTimerRunning(false)}
                    className="tw-9fe52d5d50 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-a217b4eaa9 tw-5358eecb47 tw-bc13c00cab"
                    title="Пауза"
                  >
                    <Pause className="tw-72470489ff tw-cd0d9c512c" />
                  </button>
                ) : (
                  activeMicroStep && (
                    <button
                      onClick={() => setIsTimerRunning(true)}
                      className="tw-9fe52d5d50 tw-da1032643a tw-dffcdbf826 tw-a217b4eaa9 tw-6dc89721e0"
                      title="Продолжить"
                    >
                      <Play className="tw-72470489ff tw-cd0d9c512c tw-20269b6b37" />
                    </button>
                  )
                )}
                <button
                  onClick={resetTimer}
                  className="tw-9fe52d5d50 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-a217b4eaa9 tw-16720c5987 tw-1852007365"
                  title="Сбросить"
                >
                  <RotateCcw className="tw-72470489ff tw-cd0d9c512c" />
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