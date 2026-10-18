import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import '../styles/Landing.css';
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
  const { user } = useSession();
  const catalog = user?.role === 'mentor' ? '/requests' : '/mentorslist';
  return (
    <div id="main" className="landing-page">
      {/* Background Decorator Gradients */}
      <div className="landing__hero-decoration" />
      <div className="landing__hero-decoration-2" />

      {/* Main Container */}
      <div className="landing__container">

        {/* Hero Section */}
        <section id="main" className="landing__hero tw-5c8999fa38 tw-3f6ca0d934 tw-fe252c20cb tw-b4f77d766f tw-a532608c65 tw-e4256535da tw-ce55e84e0c">
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

            {/* Description (Пункт 1) */}
            <p className="landing__description">
              Мы создаем твой персональный маршрут поступления. Получи честный
              опыт обучения из первых уст и работай со студентами топовых ВУЗов.
            </p>

            {/* Call to Actions (Пункт 10) */}
            <div className="landing__hero-actions">
              <Link to="/login" className="landing__primary-button">
                <span>Подобрать ментора</span>
                <ArrowRight />
              </Link>

              <Link to="/register" className="landing__secondary-button tw-52083e7da4 tw-3960ffc248 tw-86843cf1e2">
                Стать наставником
              </Link>
            </div>

            {/* Social Proof Badges (Пункт 2, 3) */}
            <div className="landing__social-proof">
              <div className="landing__proof-item">
                <ShieldCheck />
                <span>Строгая проверка профилей</span>
              </div>

              <div className="landing__proof-item">
                <Globe />
                <span>Менторы из топ университетов</span>
              </div>

              <div className="landing__proof-item">
                <HeartHandshake />
                <span>Прямая связь и поддержка</span>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Features Section */}
      <section id="features" className="landing__features">
        <div className="landing__container">
          <div className="landing__section-header">
            <span className="landing__section-label">Почему UniBridge</span>
            {/* Пункт 4 */}
            <h2 className="landing__section-title">Все для успешного портфолио в один клик</h2>
          </div>

          <div className="landing__features-grid">

            {/* Feature 1 (Пункт 5) */}
            <div className="landing__feature-card">
              <div className="landing__feature-icon">
                <Users />
              </div>
              <h3 className="landing__feature-title">Наставничество и помощь в построении сильного профиля</h3>
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
                  <span>Помощь с мотивационными эссе и внеучебной активностью</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 (Пункт 6) */}
            <div className="landing__feature-card">
              <div className="landing__feature-icon">
                <Brain />
              </div>
              <h3 className="landing__feature-title">AI-маршрут и аналитика</h3>
              <p className="landing__feature-description">
                Алгоритмы учитывают твои интересы, сильные стороны и зоны роста для постройки конкурентного портфолио.
              </p>
              <ul className="landing__feature-list">
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Персональный трек поступления</span>
                </li>
                <li className="landing__feature-list-item">
                  <span className="landing__bullet" />
                  <span>Выявление точек роста и сильных сторон</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 (Пункт 7) */}
            <div className="landing__feature-card">
              <div className="landing__feature-icon">
                <Target />
              </div>
              <h3 className="landing__feature-title">Сопровождение и поддержка</h3>
              <p className="landing__feature-description">
                Сопровождение при постройке персонального трека и поддержка от студентов на каждом этапе.
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

      {/* Top Mentors Catalog Section (Пункт 8) */}
      <section id="mentors" className="landing__mentors">
        <div className="landing__container">
          <div className="landing__mentors-header">
            <div>
              <span className="landing__section-label">Каталог</span>
              <h2 className="landing__section-title">Каталог менторов</h2>
            </div>
            <Link to={catalog} className="landing__mentors-link">
              <span>{user?.role === 'mentor' ? 'Смотреть запросы' : 'Смотреть всех менторов'}</span>
              <ArrowRight />
            </Link>
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

                <Link to={catalog} className="landing__mentor-button tw-ca6bf63030">
                  Записаться на сессию
                </Link>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* CTA Section (Пункт 9) */}
      <section className="landing__cta">
        <div className="landing__cta-container">
          <div className="landing__cta-content">
            <h2 className="landing__cta-title">Готов сделать первый шаг к поступлению?</h2>
            <p className="landing__cta-description">
              Зарегистрируйся прямо сейчас и начни строить свое будущее прямо сейчас.
            </p>
            <Link to="/register" className="landing__cta-button tw-52083e7da4 tw-3960ffc248 tw-86843cf1e2">
              Начать бесплатно
            </Link>
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