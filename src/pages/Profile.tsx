import { CabinetNav } from '../components/CabinetNav';
import '../styles/CabinetLayout.css';
import '../styles/Landing.css';
import '../styles/Profile.css';
import '../styles/TaskTypeTag.css';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  CheckCircle2, 
  Circle, 
  Star, 
  ChevronRight, 
  GraduationCap,
  MessageSquare,
  Sparkles,
  Target
} from 'lucide-react';
import { taskTypeLabel } from '../lib/taskTypes';

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
  task_type: string;
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
  steps: RoadmapStep[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const PORTFOLIO_STAGE_LABELS: Record<string, string> = {
  starting: 'Только начинаю (формирую круг интересов)',
  in_progress: 'Есть первые наработки (участвую в мероприятиях/курсах)',
  achieving: 'Есть четкое видение и первые достижения (проекты/награды)',
  completed: 'Сформированное портфолио (готов к подаче документов)',
};

const STATS = [
  { label: 'Пройдено шагов', value: '18/24', accent: false },
  { label: 'Часов обучения', value: '148', accent: true },
  { label: 'Сессий с ментором', value: '8', accent: false },
  { label: 'Текущий Streak', value: '12 дней', accent: true },
];

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
    return <main className="landing__container tw-793346c736 tw-ca36a3519d">Загружаем профиль...</main>;
  }

  if (errorMessage) {
    return (
      <main className="landing__container tw-793346c736 tw-ca36a3519d">
        <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-f3376ad261">{errorMessage}</p>
      </main>
    );
  }

  if (profile?.role === 'mentor') {
    return (
      <div className="landing-page tw-793346c736">
        <div className="cabinet-layout">
          <CabinetNav />

          <main className="cabinet-content">
            <header className="profile-heading">
              <span className="landing__section-label">Личный кабинет</span>
              <h1 className="landing__section-title tw-eccd13ef4f">Мой профиль</h1>
              <p className="tw-16720c5987 tw-0ab8667228">
                Информация о вас и вашей работе на платформе.
              </p>
            </header>

            <section className="profile-card profile-summary" aria-labelledby="profile-name">
              <div className="profile-avatar-large" aria-hidden="true">
                {profile.full_name.slice(0, 1).toUpperCase()}
              </div>

              <div className="profile-summary-info">
                <span className="landing__section-label">Ментор</span>
                <h2 id="profile-name">{profile.full_name}</h2>
                <p>{profile.email}</p>
              </div>
            </section>

            <section className="profile-card">
              <h2>Основная информация</h2>

              <dl className="profile-details">
                <div>
                  <dt>Имя и фамилия</dt>
                  <dd>{profile.full_name}</dd>
                </div>
                <div>
                  <dt>Электронная почта</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div>
                  <dt>Роль на платформе</dt>
                  <dd>Ментор</dd>
                </div>
                <div>
                  <dt>Город</dt>
                  <dd className="profile-muted">Не указан</dd>
                </div>
              </dl>
            </section>

            <div className="profile-sections">
              <section className="profile-card">
                <h2>О себе</h2>
                <div className="profile-empty">
                  <p>Описание пока не добавлено</p>
                  <span>Здесь будет информация об опыте ментора.</span>
                </div>
              </section>

              <section className="profile-card">
                <h2>Образование</h2>
                <div className="profile-empty">
                  <p>Образование пока не указано</p>
                  <span>Учебное заведение и специальность.</span>
                </div>
              </section>

              <section className="profile-card">
                <h2>Направления менторства</h2>
                <div className="profile-empty">
                  <p>Направления пока не добавлены</p>
                  <span>Предметы и темы, с которыми помогает ментор.</span>
                </div>
              </section>

              <section className="profile-card">
                <h2>Опыт и достижения</h2>
                <div className="profile-empty">
                  <p>Информация пока не добавлена</p>
                  <span>Проекты, профессиональный опыт и достижения.</span>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'student') {
    return <main className="landing__container tw-793346c736 tw-ca36a3519d">Профиль не найден.</main>;
  }

  const student = profile.student_profile;
  if (!student) {
    return <main className="landing__container tw-793346c736 tw-ca36a3519d">Профиль ученика не найден.</main>;
  }

  const stats = [
    { label: 'Класс', value: student.school_grade ? `${student.school_grade} класс` : 'Не указан', accent: true },
    { label: 'Интересы', value: String(student.interests.length), accent: false },
    { label: 'Сильные стороны', value: String(student.strengths.length), accent: true },
    { label: 'Точки роста', value: String(student.weaknesses.length), accent: false },
  ];

    const studentSections = [
    { title: 'Интересы', items: student.interests },
    { title: 'Сильные стороны', items: student.strengths },
    { title: 'Точки роста', items: student.weaknesses },
  ];

  // Считаем прогресс roadmap
  const roadmapTasks = roadmap?.steps.flatMap(s => s.tasks) ?? [];
  const completedTasksCount = roadmapTasks.filter(t => t.completed).length;
  const roadmapProgress = roadmapTasks.length
    ? Math.round((completedTasksCount / roadmapTasks.length) * 100)
    : 0;

  return (
    <div className="landing-page tw-793346c736">
      <div className="cabinet-layout">
        <CabinetNav />
        <main className="cabinet-content tw-8107d37319">
          
          {/* Баннер приветствия */}
          <section className="landing__feature-card tw-a071d694e3 tw-1b51d35d70 tw-11bf117a71 tw-2bc47d731f tw-5c5681dfff">
            <div className="landing__hero-decoration"></div>
            <div className="tw-60fbb77139 tw-8dddea0773 tw-4102dddfda tw-60541e1e26 tw-3e62563924 tw-8ef2268efb tw-0d304f904c tw-d89972fe17 tw-236812d64c">
              <div className="tw-6f7e013d64">
                <div className="landing__badge">
                  <GraduationCap />
                  {student.school_grade ? `Ученик · ${student.school_grade} класс` : 'Ученик'}
                </div>
                <h1 className="landing__title tw-751fb0d102 tw-a8e2faff04 tw-0c5d33694a">
                  С возвращением, <span className="landing__title-accent">{profile.full_name.split(' ')[0]}</span>!
                </h1>
                <p className="landing__description tw-fc7473ca09 tw-9bcf466577">
                  {profile.email} · {PORTFOLIO_STAGE_LABELS[student.portfolio_stage] ?? student.portfolio_stage}
                </p>
              </div>
              
              <Link to="/roadmap" className="landing__primary-button tw-012fbd121f">
                Roadmap обучения <ChevronRight />
              </Link>
            </div>
          </section>

          {/* Сетка статистики */}
          <section className="landing__stats tw-ea189a088a tw-ca6bcd4b6f tw-18049387f0">
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

          {/* Интересы / Сильные стороны / Точки роста */}
          <section className="tw-f3c543ad5f tw-d7c8339810 tw-9a638cfe82 tw-0d304f904c">
            {studentSections.map((section) => (
              <div key={section.title} className="landing__feature-card tw-3e7ce58d64">
                <h2 className="landing__feature-title">{section.title}</h2>
                {section.items.length > 0 ? (
                  <ul className="tw-6f7e013d64">
                    {section.items.map((item) => (
                      <li key={item} className="tw-60fbb77139 tw-60541e1e26 tw-77a2a20e90 tw-fc7473ca09 tw-2689f39580 tw-16720c5987">
                        <Circle className="tw-7fc7f732bf tw-bf600f8e02 tw-17d820623e tw-012fbd121f tw-b6b02c0ebe" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tw-fc7473ca09 tw-16720c5987">Пока не заполнено</p>
                )}
              </div>
            ))}
          </section>

          {/* Основной контент */}
          <div className="tw-f3c543ad5f tw-d7c8339810 tw-19d9b25e8f tw-1500488ab7">
            
            {/* Левая колонка: Roadmap */}
            <div className="tw-422d10025c tw-b3542e0588">
              <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb">
                <h2 className="tw-3febee094e tw-7fbb85697d tw-5358eecb47 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90">
                  <MapPin className="tw-17d820623e tw-f6fe902450 tw-7ec10f86d9" /> Roadmap обучения
                </h2>
                {roadmap && (
                  <span className="tw-359090c2d5 tw-69450ef148 tw-17d820623e tw-ce45d053a5 tw-0e17f2bd90 tw-ec0091ee00 tw-ac204c1088 tw-ca6bcd4b6f tw-8609a13c3e">
                    {roadmapProgress}% выполнено
                  </span>
                )}
              </div>

              {roadmap ? (
                <div className="tw-f3c543ad5f tw-0d304f904c">
                  {roadmap.steps.map((step) => {
                    const completedTasks = step.tasks.filter((task) => task.completed).length;
                    const stepProgress = step.tasks.length
                      ? Math.round((completedTasks / step.tasks.length) * 100)
                      : 0;
                    return (
                      <div key={step.id} className="landing__feature-card">
                        <div className="tw-60fbb77139 tw-8ef2268efb tw-3960ffc248 tw-da019856f2">
                          <span className="landing__section-label">
                            {step.phase} · {step.status === 'completed' ? 'Завершено' : step.status === 'in_progress' ? 'В процессе' : 'Запланировано'}
                          </span>
                          <span className="tw-359090c2d5 tw-69450ef148 tw-17d820623e">Impact {step.impactScore}/100</span>
                        </div>

                        <h3 className="landing__feature-title tw-a77ed4d908">{step.title}</h3>
                        <p className="tw-fc7473ca09 tw-16720c5987 tw-da019856f2">{step.description}</p>
                        <p className="tw-359090c2d5 tw-e83a7042bc tw-16720c5987 tw-1bb883263e">
                          Срок: {step.estimatedTime} · Задач: {completedTasks}/{step.tasks.length}
                        </p>
                        
                        <div className="tw-6da6a3c3f7 tw-2f2a842e50 tw-6a2c73aab2 tw-ac204c1088 tw-2cd02d11d1 tw-ca6bcd4b6f tw-18049387f0 tw-b6777c6db9">
                          <div 
                            className={`tw-668b21aa54 tw-da1032643a tw-ac204c1088 tw-0fe7d7d814 tw-844322115e progress-width--${stepProgress}`}
                          ></div>
                        </div>

                        <div className="tw-6ed543e2fb">
                          {step.tasks.map((task) => (
                            <div key={task.id} className="tw-60fbb77139 tw-60541e1e26 tw-1004c0c395 tw-fc7473ca09">
                              {task.completed ? (
                                <CheckCircle2 className="tw-cd0d9c512c tw-72470489ff tw-17d820623e tw-012fbd121f tw-15e1b1f444" />
                              ) : (
                                <Circle className="tw-cd0d9c512c tw-72470489ff tw-16720c5987 tw-012fbd121f tw-15e1b1f444" />
                              )}
                              <div className="tw-36e579c0b4 tw-7e0b7cdf1a">
                                <span className={task.completed ? "tw-093ca5623c tw-16720c5987" : "tw-5358eecb47 tw-2689f39580"}>
                                  {task.title}
                                </span>
                                <span className="task-type-tag">{taskTypeLabel(task.task_type)}</span>
                              </div>
                            </div>
                          ))}
                          {step.artifacts.length > 0 && (
                            <p className="tw-f46b61a9b3 tw-359090c2d5 tw-16720c5987">
                              Результаты: {step.artifacts.join(', ')}
                            </p>
                          )}
                        </div>

                        {step.status === 'in_progress' && (
                          <div className="tw-31f2553311 tw-173fa8f067 tw-b950dda299 tw-18049387f0 tw-60fbb77139 tw-77c08e015d">
                            <Link to="/roadmap" className="landing__primary-button tw-03b4dd7f17 tw-f0faeb26d6 tw-fc7473ca09">
                              Продолжить этап
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="landing__feature-card tw-6ed543e2fb">
                  <p className="tw-fc7473ca09 tw-16720c5987">
                    {roadmapError || 'Активный план ещё не создан.'}
                  </p>
                  <Link to="/roadmap" className="landing__primary-button tw-52083e7da4">
                    Создать учебный план <ChevronRight />
                  </Link>
                </div>
              )}
            </div>

            {/* Правая колонка */}
            <div className="tw-b3542e0588">
              
              {/* Ментор */}
              <div className="tw-6ed543e2fb">
                <h2 className="tw-3febee094e tw-7fbb85697d tw-5358eecb47 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90">
                  <Sparkles className="tw-17d820623e tw-f6fe902450 tw-7ec10f86d9" /> Твой ментор
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
                  <button className="landing__mentor-button tw-0ab8667228 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-77a2a20e90">
                    <MessageSquare className="tw-11e59c6d5f tw-dc7972ebf3" /> Связаться с ментором
                  </button>
                </div>
              </div>

              {/* Микро-шаги */}
              <div className="tw-6ed543e2fb tw-173fa8f067">
                <h3 className="tw-d5c9b0001e tw-69450ef148 tw-5358eecb47 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90">
                  <Target className="tw-17d820623e tw-cd0d9c512c tw-72470489ff" /> Микро-шаги на сегодня
                </h3>

                <div className="landing__feature-card tw-6ed543e2fb tw-c07e54fd14">
                  {roadmapTasks.filter((task) => !task.completed).slice(0, 3).map((task) => (
                    <div 
                      key={task.id}
                      className="tw-56796a90be tw-a217b4eaa9 tw-6a2c73aab2 tw-ca6bcd4b6f tw-18049387f0 tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-1004c0c395"
                    >
                      <div className="tw-60fbb77139 tw-3960ffc248 tw-1004c0c395">
                        <Circle className="tw-11e59c6d5f tw-dc7972ebf3 tw-16720c5987 tw-012fbd121f" />
                        <div className="tw-36e579c0b4 tw-7e0b7cdf1a">
                          <span className="tw-359090c2d5 tw-69450ef148 tw-5358eecb47">{task.title}</span>
                          <span className="task-type-tag">{taskTypeLabel(task.task_type)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {roadmapTasks.filter((task) => !task.completed).length === 0 && (
                    <p className="tw-359090c2d5 tw-16720c5987">
                      {roadmap ? 'Все задачи плана выполнены.' : 'Сгенерируйте план, чтобы увидеть задачи.'}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>

        </main>
      </div>

      {/* Футер */}
      <footer className="landing__footer tw-5c8999fa38">
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