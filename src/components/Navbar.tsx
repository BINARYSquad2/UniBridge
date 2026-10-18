import { useEffect, useState } from 'react';
import { LogOut, Menu, X, GraduationCap } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';

const NAV_LINKS = [
  { label: 'Возможности', to: '/#features' },
  { label: 'Менторы', to: '/#mentors' },
  { label: 'О платформе', to: '/#stats' },
];

export const Navbar: React.FC = () => {
  const { logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem('access_token'))
  );

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthenticated(Boolean(localStorage.getItem('access_token')));
    };

    syncAuthState();
    window.addEventListener('storage', syncAuthState);

    return () => window.removeEventListener('storage', syncAuthState);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${isScrolled
          ? 'bg-bg-surface/90 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent border-b border-transparent'
        }`}
    >
      <div
        className={`mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-[height] duration-300 ${isScrolled ? 'h-16' : 'h-20'
          }`}
      >
        {/* Логотип */}
        <Link to="/#main" className="flex items-center gap-3 group shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-text-primary font-black text-xl shadow-sm transition-transform duration-300 group-hover:scale-105">
            <GraduationCap />
          </div>

          <span className="text-xl font-black tracking-tight text-text-primary">
            Uni<span className="text-brand">Bridge</span>
          </span>
        </Link>

        {/* Десктопное меню */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-12">
          {[
            ...NAV_LINKS,
            ...(isAuthenticated
              ? [{ label: 'Аналитика', to: '/analytics' }]
              : []),
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-bold text-text-secondary hover:text-brand transition-colors duration-200 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Десктопные кнопки */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-text-primary shadow-sm transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-95"
              >
                Кабинет
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-transparent px-4 py-2 text-sm font-bold text-text-secondary transition-colors duration-200 hover:border-red-500 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-text-primary shadow-sm transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-95"
            >
              Авторизация
            </Link>

          )}</div>

        {/* Мобильная кнопка меню */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="md:hidden p-2 rounded-xl border border-border bg-bg-surface text-text-primary hover:bg-brand-light hover:border-brand/40 transition-colors"
          aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Мобильное выпадающее меню */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 px-4 pb-4 pt-2">
          <div className="rounded-2xl border border-border bg-bg-surface p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col gap-4">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className="text-base font-bold text-text-primary hover:text-brand transition-colors py-1"
                >
                  {item.label}
                </Link>
              ))}

              {isAuthenticated && (
                <Link
                  to="/analytics"
                  onClick={closeMobileMenu}
                  className="text-base font-bold text-text-primary hover:text-brand transition-colors py-1"
                >
                  Аналитика
                </Link>
              )}

              <hr className="border-border my-2" />

              {isAuthenticated ? (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/profile"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-center py-2.5 text-sm font-bold text-text-primary bg-brand rounded-xl hover:bg-brand-hover transition-colors shadow-sm"
                  >
                    Кабинет
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold text-text-secondary transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="flex w-full items-center justify-center py-3 text-sm font-bold text-text-primary bg-brand rounded-xl hover:bg-brand-hover transition-colors shadow-sm"
                >
                  Авторизация
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};
