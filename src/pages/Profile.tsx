import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import { CabinetNav } from '../components/CabinetNav';
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

interface StudentProfileData {
  name?: string;
  email?: string;
  role?: string;
  school_grade?: number;
  portfolio_stage?: string;
  interests?: string[];
  strengths?: string[];
  weaknesses?: string[];
}

export const Profile: React.FC = () => {
  const { user } = useSession();

  // Объединяем данные из сессии с фоллбеком и приведением типа
  const profile = (user as StudentProfileData) || {
    name: 'Алексей Иванов',
    email: 'alexey@example.com',
    role: 'Студент',
    school_grade: 10,
    portfolio_stage: 'in_progress',
    interests: ['IT & Разработка', 'AI & Data Science'],
    strengths: ['Программирование & Алгоритмы', 'Математика & Аналитика'],
    weaknesses: ['Академическое письмо & Эссе'],
  };

  const student = profile;

  const studentSections = [
    { title: 'Интересы', items: profile.interests || ['IT & Разработка', 'AI & Data Science'] },
    { title: 'Сильные стороны', items: profile.strengths || ['Программирование & Алгоритмы'] },
    { title: 'Точки роста', items: profile.weaknesses || ['Академическое письмо & Эссе'] },
  ];

  // Данные Roadmap и задач
  const roadmap = {
    progress: 60,
    steps: [
      {
        id: 1,
        phase: 'Этап 1',
        title: 'Базовые концепции и архитектура',
        status: 'completed',
        impactScore: 90,
        estimatedTime: '2 недели',
        description: 'Основы структуры проекта и окружение.',
        tasks: [
          { id: '1-1', title: 'Основы структуры проекта и окружение', completed: true, duration: '2ч' },
          { id: '1-2', title: 'Проектирование схемы данных', completed: true, duration: '3ч' },
        ],
        artifacts: ['Архитектурная схема'],
      },
      {
        id: 2,
        phase: 'Этап 2',
        title: 'Практическая реализация и модули',
        status: 'in_progress',
        impactScore: 85,
        estimatedTime: '3 недели',
        description: 'Интеграция сторонних сервисов и оптимизация.',
        tasks: [
          { id: '2-1', title: 'Интеграция сторонних сервисов и API', completed: true, duration: '4ч' },
          { id: '2-2', title: 'Оптимизация запросов и логика взаимодействия', completed: false, duration: '5ч' },
          { id: '2-3', title: 'Тестирование ключевых сценариев', completed: false, duration: '3ч' },
        ],
        artifacts: ['Модуль API'],
      },
    ]
  };

  const roadmapProgress = roadmap.progress;
  const roadmapTasks = roadmap.steps.flatMap((s) => s.tasks);
  const roadmapError = null;

  return (
    <div className="landing-page min-h-screen">
      {/* Главный контейнер */}
      <div className="cabinet-layout">
        <CabinetNav />
        <main className="cabinet-content space-y-10">
          
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
                  С возвращением, <span className="landing__title-accent">{profile.name?.split(' ')[0]}</span>!
                </h1>
                <p className="landing__description text-sm sm:text-base">
                  {profile.email} · {PORTFOLIO_STAGE_LABELS[student.portfolio_stage!] ?? student.portfolio_stage}
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
              {STATS.map((stat, index) => (
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
                    {section.items.map((item: string) => (
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

        </main>
      </div>

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