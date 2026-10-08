import React from 'react';
import { Link } from 'react-router-dom';
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

// Данные пользователя
const USER_DATA = {
  name: 'Алексей Иванов',
  role: 'Студент',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
  level: 'Продвинутый',
};

const STATS = [
  { label: 'Пройдено шагов', value: '18/24', accent: false },
  { label: 'Часов обучения', value: '148', accent: true },
  { label: 'Сессий с ментором', value: '8', accent: false },
  { label: 'Текущий Streak', value: '12 дней', accent: true },
];

// Roadmap (Дорожная карта)
const ROADMAP_STAGES = [
  {
    id: 1,
    stageTitle: 'Этап 1: Базовые концепции и архитектура',
    status: 'completed', // completed | in-progress | locked
    progress: 100,
    steps: [
      { id: '1-1', title: 'Основы структуры проекта и окружение', completed: true },
      { id: '1-2', title: 'Проектирование схемы данных', completed: true },
    ]
  },
  {
    id: 2,
    stageTitle: 'Этап 2: Практическая реализация и модули',
    status: 'in-progress',
    progress: 60,
    steps: [
      { id: '2-1', title: 'Интеграция сторонних сервисов и API', completed: true },
      { id: '2-2', title: 'Оптимизация запросов и логика взаимодействия', completed: false },
      { id: '2-3', title: 'Тестирование ключевых сценариев', completed: false },
    ]
  },
  {
    id: 3,
    stageTitle: 'Этап 3: Финальная сборка и релиз',
    status: 'locked',
    progress: 0,
    steps: [
      { id: '3-1', title: 'Подготовка документации и деплой', completed: false },
      { id: '3-2', title: 'Финальный разбор с ментором', completed: false },
    ]
  }
];

// Микро-шаги (быстрые задачи)
const MICRO_STEPS = [
  { id: 1, title: 'Изучить модуль миграций', time: '15 мин', done: true },
  { id: 2, title: 'Решить 3 практические задачи', time: '25 мин', done: false },
  { id: 3, title: 'Отправить вопрос ментору по тестам', time: '5 мин', done: false },
];

export const Profile: React.FC = () => {
  return (
    <div className="landing-page min-h-screen">
      {/* Главный контейнер */}
      <main className="landing__container pt-28 pb-8 space-y-10">
        
        {/* Баннер приветствия */}
        <section className="landing__feature-card bg-linear-to-r from-bg-surface via-brand-light/30 to-bg-surface border-brand/30">
          <div className="landing__hero-decoration"></div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="landing__badge">
                <GraduationCap />
                Статус: {USER_DATA.level}
              </div>
              <h1 className="landing__title text-3xl sm:text-4xl lg:text-4xl">
                С возвращением, <span className="landing__title-accent">{USER_DATA.name.split(' ')[0]}</span>!
              </h1>
              <p className="landing__description text-sm sm:text-base">
                Ваш прогресс по Roadmap за эту неделю вырос на <span className="font-bold text-brand">+12%</span>.
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

        {/* Основной контент (Roadmap и Твой Ментор + Микро-шаги) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Левая колонка: Roadmap (2 столбца) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-text-primary flex items-center gap-2">
                <MapPin className="text-brand h-6 w-6" /> Roadmap обучения
              </h2>
              <span className="text-xs font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-full border border-brand/20">
                Активный трек
              </span>
            </div>

            <div className="grid gap-6">
              {ROADMAP_STAGES.map((stage) => (
                <div 
                  key={stage.id} 
                  className={`landing__feature-card ${stage.status === 'locked' ? 'opacity-60' : ''}`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="landing__section-label">
                      {stage.status === 'completed' && 'Завершено'}
                      {stage.status === 'in-progress' && 'В процессе'}
                      {stage.status === 'locked' && 'Заблокировано'}
                    </span>
                    <span className="text-xs font-bold text-brand">{stage.progress}%</span>
                  </div>

                  <h3 className="landing__feature-title mb-4">{stage.stageTitle}</h3>
                  
                  {/* Прогресс-бар этапа */}
                  <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden border border-border mb-6">
                    <div 
                      className="h-full bg-brand rounded-full transition-all duration-500" 
                      style={{ width: `${stage.progress}%` }}
                    ></div>
                  </div>

                  {/* Список подшагов */}
                  <div className="space-y-3">
                    {stage.steps.map((step) => (
                      <div key={step.id} className="flex items-start gap-3 text-sm">
                        {step.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 text-text-secondary shrink-0 mt-0.5" />
                        )}
                        <span className={step.completed ? 'line-through text-text-secondary' : 'text-text-primary font-medium'}>
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {stage.status === 'in-progress' && (
                    <div className="mt-6 pt-4 border-t border-border flex justify-end">
                      <button className="landing__primary-button py-2 px-4 text-sm">
                        Продолжить этап
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                {MICRO_STEPS.map((micro) => (
                  <div 
                    key={micro.id} 
                    className="p-3.5 rounded-xl bg-bg-primary border border-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {micro.done ? (
                        <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-text-secondary shrink-0" />
                      )}
                      <span className={`text-xs font-bold ${micro.done ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                        {micro.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-brand flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" /> {micro.time}
                    </span>
                  </div>
                ))}

                <button className="landing__secondary-button w-full text-xs py-2 mt-1">
                  + Добавить микро-шаг
                </button>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Футер личного кабинета */}
      <footer className="landing__footer mt-16">
        <div className="landing__footer-container">
          <div className="landing__footer-brand">
            <div className="landing__footer-logo">Edu</div>
            <div>
              <div className="landing__footer-name">EduPlatform</div>
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