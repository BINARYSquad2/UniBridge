import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Globe,
  HeartHandshake,
  Star,
  Building2,
  Users,
  Target,
  Brain
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="landing-page">
      {/* Background Decorator Gradients */}
      <div className="landing__hero-decoration" />
      <div className="landing__hero-decoration-2" />

      {/* Main Container */}
      <div className="landing__container">
        
        {/* Hero Section */}
        <section className="landing__hero">
          <div className="landing__hero-content">
            
            {/* Top Badge */}
            <div>
              <div className="landing__badge">
                <Sparkles />
                <span>Твой осознанный выбор профессии и ВУЗа</span>
              </div>
            </div>

            {/* Main Title */}
            <h1 className="landing__title">
              Поступай уверенно с помощью{' '}
              <span className="landing__title-accent">текущих студентов</span>{' '}
              и лучших экспертов
            </h1>

            {/* Description */}
            <p className="landing__description">
              Мы создаем твой персональный маршрут поступления. Получи честный
              опыт обучения из первых уст и работай с профессиональными
              профориентаторами без переплат.
            </p>

            {/* Call to Actions */}
            <div className="landing__hero-actions">
              <button className="landing__primary-button">
                <span>Подобрать ментора прямо сейчас</span>
                <ArrowRight />
              </button>

              <button className="landing__secondary-button">
                Я хочу стать ментором
              </button>
            </div>

            {/* Social Proof Badges */}
            <div className="landing__social-proof">
              <div className="landing__proof-item">
                <ShieldCheck />
                <span>Строгая проверка профилей</span>
              </div>

              <div className="landing__proof-item">
                <Globe />
                <span>Менторы из 15+ стран</span>
              </div>

              <div className="landing__proof-item">
                <HeartHandshake />
                <span>Прямая связь и поддержка</span>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Statistics Section */}
      <section id="stats" className="landing__stats">
        <div className="landing__stats-grid">
          <div className="landing__stat">
            <div className="landing__stat-value landing__stat-value--accent">500+</div>
            <div className="landing__stat-label">Проверенных менторов</div>
          </div>
          <div className="landing__stat">
            <div className="landing__stat-value">98%</div>
            <div className="landing__stat-label">Успешных поступлений</div>
          </div>
          <div className="landing__stat">
            <div className="landing__stat-value">15+</div>
            <div className="landing__stat-label">Стран мира</div>
          </div>
          <div className="landing__stat">
            <div className="landing__stat-value landing__stat-value--accent">4.9</div>
            <div className="landing__stat-label">Средняя оценка</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing__features">
        <div className="landing__container">
          <div className="landing__section-header">
            <span className="landing__section-label">Почему UniBridge</span>
            <h2 className="landing__section-title">Всё для успешного поступления в один клик</h2>
          </div>

          <div className="landing__features-grid">
            
            {/* Feature 1 */}
            <div className="landing__feature-card">
              <div className="landing__feature-icon">
                <Users />
              </div>
              <h3 className="landing__feature-title">Менторство от студентов</h3>
              <p className="landing__feature-description">
                Общайся с теми, кто уже проходит этот путь прямо сейчас в топовых ВУЗах мира.
              </p>
              <ul className="landing__feature-list">
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Честные отзывы об учебе и кампусе</span>
                </li>
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Помощь с мотивационными эссе</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="landing__feature-card">
              <div className="landing__feature-icon">
                <Brain />
              </div>
              <h3 className="landing__feature-title">AI-Подбор маршрута</h3>
              <p className="landing__feature-description">
                Умные алгоритмы анализируют твои интересы, оценки и бюджет для поиска лучших вариантов.
              </p>
              <ul className="landing__feature-list">
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Персональный трек поступления</span>
                </li>
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Анализ шансов на грант</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="landing__feature-card">
              <div className="landing__feature-icon">
                <Target />
              </div>
              <h3 className="landing__feature-title">Прямая поддержка</h3>
              <p className="landing__feature-description">
                Сопровождение на каждом этапе — от выбора специальности до подачи документов.
              </p>
              <ul className="landing__feature-list">
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Проверка всех пакетов документов</span>
                </li>
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Подготовка к собеседованиям</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* Top Mentors Catalog Section */}
      <section id="mentors" className="landing__mentors">
        <div className="landing__container">
          <div className="landing__mentors-header">
            <div>
              <span className="landing__section-label">Каталог</span>
              <h2 className="landing__section-title">Популярные менторы</h2>
            </div>
            <a href="#mentors" className="landing__mentors-link">
              <span>Смотреть всех менторов</span>
              <ArrowRight />
            </a>
          </div>

          <div className="landing__mentor-grid">
            
            {/* Mentor Card Sample */}
            {[
              { name: 'Алихан Смаилов', role: 'Студент', uni: 'NUS (Сингапур)', rating: '4.9', tags: ['Computer Science', 'Full Scholarship', 'SAT'] },
              { name: 'Диана Аспанова', role: 'Выпускник', uni: 'KAIST (Южная Корея)', rating: '5.0', tags: ['AI & Robotics', 'GKS Grant', 'IELTS'] },
              { name: 'Санжар Жаксылык', role: 'Студент', uni: 'Purdue University (США)', rating: '4.8', tags: ['Engineering', 'Financial Aid', 'Common App'] },
              { name: 'Мадина Нурланова', role: 'Эксперт', uni: 'NU (Казахстан)', rating: '5.0', tags: ['Профориентация', 'NUET', 'Motivation Letter'] },
            ].map((mentor, index) => (
              <div key={index} className="landing__mentor-card">
                <div className="landing__mentor-card-content">
                  <div className="landing__mentor-card-header">
                    <span className="landing__mentor-role">{mentor.role}</span>
                    <div className="landing__mentor-rating">
                      <Star />
                      <span>{mentor.rating}</span>
                    </div>
                  </div>

                  <h3 className="landing__mentor-name">{mentor.name}</h3>

                  <div className="landing__mentor-university">
                    <Building2 />
                    <span>{mentor.uni}</span>
                  </div>

                  <div className="landing__mentor-tags">
                    {mentor.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="landing__mentor-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <button className="landing__mentor-button">
                  Записаться на сессию
                </button>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing__cta">
        <div className="landing__cta-container">
          <div className="landing__cta-content">
            <h2 className="landing__cta-title">Готов сделать первый шаг к поступлению?</h2>
            <p className="landing__cta-description">
              Зарегистрируйся прямо сейчас и получи первую консультацию по подбору ментора бесплатно.
            </p>
            <button className="landing__cta-button">
              Начать бесплатно
            </button>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="landing__footer">
        <div className="landing__footer-container">
          <div className="landing__footer-brand">
            <div className="landing__footer-logo">
              <GraduationCap />
            </div>
            <div>
              <span className="landing__footer-name">UniBridge</span>
              <p className="landing__footer-copy">© 2026 UniBridge. Все права защищены.</p>
            </div>
          </div>

          <div className="landing__footer-links">
            <a href="#about">О платформе</a>
            <a href="#mentors">Каталог менторов</a>
            <a href="#ai">AI Тест</a>
            <a href="#privacy">Конфиденциальность</a>
          </div>
        </div>
      </footer>
    </div>
  );
}