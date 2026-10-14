import { useSession } from '../lib/session';
import { CabinetNav } from '../components/CabinetNav';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Star, 
  ChevronRight, 
  GraduationCap,
  MessageSquare,
  Sparkles,
  Target
} from 'lucide-react';

type UserRole = 'student' | 'mentor';

interface StudentProfileData {
  school_grade?: number;
  interests: string[];
  strengths: string[];
  weaknesses: string[];
  portfolio_stage: string;
}

interface CurrentProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  student_profile?: StudentProfileData;
}

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
  description: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  estimatedTime: string;
  impactScore: number;
  tasks: RoadmapTask[];
  artifacts: string[];
}

interface CurrentRoadmap {
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
const PORTFOLIO_STAGE_LABELS: Record<string, string> = {
  starting: 'Только начинаю',
  in_progress: 'Есть первые наработки',
  achieving: 'Есть первые достижения',
  completed: 'Портфолио готово',
};

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [roadmapError, setRoadmapError] = useState('');
  const [roadmap, setRoadmap] = useState<CurrentRoadmap | null>(null);

useEffect(() => {
  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) {
    navigate('/login', { replace: true });
    return;
  }

  const controller = new AbortController();
  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/profile/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as (CurrentProfile & { error?: string }) | null;

      // 1. Если токен невалиден или пользователь не найден — чистим токен и редиректим
      if (response.status === 401 || response.status === 404) {
        localStorage.removeItem('access_token');
        navigate('/login', { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(result && 'error' in result ? result.error : 'Не удалось загрузить профиль');
      }

      if (!result || !result.id || !result.role) {
        throw new Error('Сервер вернул некорректный профиль');
      }

      // 2. Если роль student, но самого профиля ученика нет в БД — чистим токен и на логин
      if (result.role === 'student' && !result.student_profile) {
        localStorage.removeItem('access_token');
        navigate('/login', { replace: true });
        return;
      }

      setProfile(result);

      if (result.role === 'student') {
        const roadmapResponse = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/roadmap/current`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (roadmapResponse.status !== 404) {
          const roadmapResult = await roadmapResponse.json().catch(() => null) as (CurrentRoadmap & { error?: string }) | null;
          if (!roadmapResponse.ok) {
            setRoadmapError(roadmapResult?.error ?? 'Не удалось загрузить roadmap');
          } else if (!roadmapResult || !roadmapResult.plan_id || !Array.isArray(roadmapResult.steps)) {
            setRoadmapError('Сервер вернул некорректный roadmap');
          } else {
            setRoadmap(roadmapResult);
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось подключиться к серверу');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  void loadProfile();
  return () => controller.abort();
}, [navigate]);

  if (isLoading) {
    return <main className="landing__container min-h-screen pt-28">Загружаем профиль...</main>;
  }

  if (errorMessage) {
    return (
      <main className="landing__container min-h-screen pt-28">
        <p role="alert" className="text-sm font-semibold text-red-700">{errorMessage}</p>
      </main>
    );
  }

  if (profile?.role !== 'student') {
    return (
      <main className="landing__container min-h-screen pt-28">
        <section className="landing__feature-card space-y-3">
          <h1 className="landing__feature-title">Профиль ученика</h1>
          <p className="landing__feature-description">
            {profile?.full_name}, раздел с классом, интересами и учебным планом доступен для аккаунтов ученика.
          </p>
        </section>
      </main>
    );
  }

  const student = profile.student_profile;
  if (!student) {
    return <main className="landing__container min-h-screen pt-28">Профиль ученика не найден.</main>;
  }

  const stats = [
    { label: 'Класс', value: student.school_grade ? `${student.school_grade} класс` : 'Не указан', accent: true },
    { label: 'Интересы', value: String(student.interests.length), accent: false },
    { label: 'Сильные стороны', value: String(student.strengths.length), accent: true },
    { label: 'Точки роста', value: String(student.weaknesses.length), accent: false },
  ];

  const studentSections = [
    { title: 'Интересы и направления', items: student.interests },
    { title: 'Сильные стороны', items: student.strengths },
    { title: 'Точки роста', items: student.weaknesses },
  ];
  const roadmapTasks = roadmap?.steps.flatMap((step) => step.tasks.map((task) => ({
    ...task,
    stepTitle: step.title,
  }))) ?? [];
  const totalRoadmapTasks = roadmapTasks.length;
  const completedRoadmapTasks = roadmapTasks.filter((task) => task.completed).length;
  const roadmapProgress = totalRoadmapTasks
    ? Math.round((completedRoadmapTasks / totalRoadmapTasks) * 100)
    : 0;

  return (
    <div className="landing-page min-h-screen">
      {/* Главный контейнер */}
      <div className="cabinet-layout"><CabinetNav /><main className="cabinet-content space-y-10">
        
        {/* Баннер приветствия */}
        <section className="landing__feature-card bg-linear-to-r from-bg-surface via-brand-light/30 to-bg-surface border-brand/30">
          <div className="landing__hero-decoration"></div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="landing__badge">
                <GraduationCap />
                {student.school_grade ? `Ученик · ${student.school_grade} класс` : 'Ученик'}
              </div>
              <h1 className="landing__title text-3xl sm:text-4xl lg:text-4xl">
                С возвращением, <span className="landing__title-accent">{profile.full_name.split(' ')[0]}</span>!
              </h1>
              <p className="landing__description text-sm sm:text-base">
                {profile.email} · {PORTFOLIO_STAGE_LABELS[student.portfolio_stage] ?? student.portfolio_stage}
              </p>
            </div>
            
            <Link to="/roadmap" className="landing__primary-button shrink-0">
              Roadmap обучения <ChevronRight />
            </Link>
          </div>
        </section>

        {/* Сетка статистики */}
        <section className="landing__stats rounded-3xl border border-border">
          <div className="landing__stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="landing__stat">
                <div className={`landing__stat-value ${stat.accent ? 'landing__stat-value--accent' : ''}`}>
                  {stat.value}
                </div>
                <div className="landing__stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {studentSections.map((section) => (
            <div key={section.title} className="landing__feature-card space-y-4">
              <h2 className="landing__feature-title">{section.title}</h2>
              {section.items.length > 0 ? (
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm font-medium text-text-secondary">
                      <Circle className="h-3.5 w-3.5 text-brand shrink-0 mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">Пока не заполнено</p>
              )}
            </div>
          ))}
        </section>

        {/* Основной контент (Roadmap и Твой Ментор + Микро-шаги) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Левая колонка: Roadmap (2 столбца) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-text-primary flex items-center gap-2">
                <MapPin className="text-brand h-6 w-6" /> Roadmap обучения
              </h2>
              {roadmap && (
                <span className="text-xs font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-full border border-brand/20">
                  {roadmapProgress}% выполнено
                </span>
              )}
            </div>

            {roadmap ? (
              <div className="grid gap-6">
              {roadmap.steps.map((step) => {
                const completedTasks = step.tasks.filter((task) => task.completed).length;
                const stepProgress = step.tasks.length
                  ? Math.round((completedTasks / step.tasks.length) * 100)
                  : 0;
                return (
                <div
                  key={step.id}
                  className="landing__feature-card"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="landing__section-label">
                      {step.phase} · {step.status === 'completed' ? 'Завершено' : step.status === 'in_progress' ? 'В процессе' : 'Запланировано'}
                    </span>
                    <span className="text-xs font-bold text-brand">Impact {step.impactScore}/100</span>
                  </div>

                  <h3 className="landing__feature-title mb-2">{step.title}</h3>
                  <p className="text-sm text-text-secondary mb-4">{step.description}</p>
                  <p className="text-xs font-semibold text-text-secondary mb-3">
                    Срок: {step.estimatedTime} · Задач: {completedTasks}/{step.tasks.length}
                  </p>
                  
                  {/* Прогресс-бар этапа */}
                  <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden border border-border mb-6">
                    <div 
                      className="h-full bg-brand rounded-full transition-all duration-500" 
                      style={{ width: `${stepProgress}%` }}
                    ></div>
                  </div>

                  {/* Список подшагов */}
                  <div className="space-y-3">
                    {step.tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 text-sm">
                        {task.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 text-text-secondary shrink-0 mt-0.5" />
                        )}
                        <span className={task.completed ? 'line-through text-text-secondary' : 'text-text-primary font-medium'}>
                          {task.title} <span className="text-xs text-text-secondary">({task.duration})</span>
                        </span>
                      </div>
                    ))}
                    {step.artifacts.length > 0 && (
                      <p className="pt-2 text-xs text-text-secondary">
                        Результаты: {step.artifacts.join(', ')}
                      </p>
                    )}
                  </div>

                  {step.status === 'in_progress' && (
                    <div className="mt-6 pt-4 border-t border-border flex justify-end">
                      <Link to="/roadmap" className="landing__primary-button py-2 px-4 text-sm">Продолжить этап</Link>
                    </div>
                  )}
                </div>
                );
              })}
              </div>
            ) : (
              <div className="landing__feature-card space-y-3">
                <p className="text-sm text-text-secondary">
                  {roadmapError || 'Активный план ещё не создан.'}
                </p>
                <Link to="/roadmap" className="landing__primary-button inline-flex">
                  Создать учебный план <ChevronRight />
                </Link>
              </div>
            )}
          </div>

          {/* Правая колонка: Твой Ментор и Микро-шаги */}
          <div className="space-y-6">
            
            {/* Вкладка Ментора */}
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-text-primary flex items-center gap-2">
                <Sparkles className="text-brand h-6 w-6" /> Твой ментор
              </h2>

              <div className="landing__mentor-card">
                <div className="landing__mentor-card-content">
                  <div className="landing__mentor-card-header">
                    <span className="landing__mentor-role">Персональный наставник</span>
                    <div className="landing__mentor-rating">
                      <Star /> 5.0
                    </div>
                  </div>
                  <div className="landing__mentor-name">Анна Соколова</div>
                  <div className="landing__mentor-university">
                    <GraduationCap /> МГУ им. Ломоносова
                  </div>
                  <div className="landing__mentor-tags">
                    <span className="landing__mentor-tag">Roadmap Review</span>
                    <span className="landing__mentor-tag">Q&A Сессии</span>
                  </div>
                </div>
                <button className="landing__mentor-button mt-4 flex items-center justify-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Связаться с ментором
                </button>
              </div>
            </div>

            {/* Блок Микро-шагов */}
            <div className="space-y-3 pt-4">
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Target className="text-brand h-5 w-5" /> Микро-шаги на сегодня
              </h3>

              <div className="landing__feature-card space-y-3 p-5">
                {roadmapTasks.filter((task) => !task.completed).slice(0, 3).map((task) => (
                  <div 
                    key={task.id}
                    className="p-3.5 rounded-xl bg-bg-primary border border-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Circle className="h-4 w-4 text-text-secondary shrink-0" />
                      <span className="text-xs font-bold text-text-primary">
                        {task.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-brand flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" /> {task.duration}
                    </span>
                  </div>
                ))}

                {roadmapTasks.filter((task) => !task.completed).length === 0 && (
                  <p className="text-xs text-text-secondary">
                    {roadmap ? 'Все задачи плана выполнены.' : 'Сгенерируйте план, чтобы увидеть задачи.'}
                  </p>
                )}
              </div>
            </div>

          </div>

        </div>

      </main></div>

      {/* Футер личного кабинета */}
      <footer className="landing__footer mt-16">
        <div className="landing__footer-container">
          <div className="landing__footer-brand">
            <div className="landing__footer-logo">U</div>
            <div>
              <div className="landing__footer-name">UniBridge</div>
              <div className="landing__footer-copy">© 2026 Все права защищены.</div>
            </div>
          </div>
          
          <div className="landing__footer-links">
            <a href="#help">Помощь и FAQ</a>
            <a href="#terms">Условия сервиса</a>
            <a href="#privacy">Конфиденциальность</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Profile;