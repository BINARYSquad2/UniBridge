import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Возможности', to: '/#features' },
  { label: 'Менторы', to: '/mentorslist' },
  { label: 'О платформе', to: '/#stats' },
  { label: 'Кабинет', to: '/profile' },
];

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Отслеживаем скролл для стилизации фона навигации
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-bg-surface/80 backdrop-blur-md border-b border-border shadow-xs py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-text-primary font-black text-xl shadow-xs transition-transform duration-300 group-hover:scale-105">
              U
            </div>
            <span className="text-xl font-black tracking-tight text-text-primary">
              Uni<span className="text-brand">Bridge</span>
            </span>
          </Link>

          {/* Десктопное меню */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-bold text-text-secondary hover:text-brand transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Кнопки действий (Десктоп) */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-bold text-text-primary hover:text-brand transition-colors duration-200"
            >
              Войти
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-text-primary shadow-xs transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-95"
            >
              Начать бесплатно
            </Link>
          </div>

          {/* Гамбургер для мобильных устройств */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-border bg-bg-surface text-text-primary hover:bg-brand-light hover:border-brand/40 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Мобильное выпадение меню */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 rounded-2xl border border-border bg-bg-surface p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col gap-4">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-base font-bold text-text-primary hover:text-brand transition-colors py-1"
                >
                  {item.label}
                </Link>
              ))}
              <hr className="border-border my-2" />
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-center py-2.5 text-base font-bold text-text-primary border border-border rounded-xl hover:bg-bg-primary transition-colors"
              >
                Войти
              </Link>
              <Link
                to="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-center py-2.5 text-base font-bold text-text-primary bg-brand rounded-xl hover:bg-brand-hover transition-colors shadow-xs"
              >
                Начать бесплатно
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};