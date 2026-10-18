import { useEffect, useState } from 'react';
import { Check, ChevronDown, LogOut, Menu, X, GraduationCap, Palette } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import '../styles/Navbar.css';

const NAV_LINKS = [
  { label: 'Возможности', to: '/#features' },
  { label: 'Менторы', to: '/#mentors' },
  { label: 'О платформе', to: '/#stats' },
];

const COLOR_THEMES = [
  { id: 'bridge', name: 'Bridge', description: 'Теплая классика' },
  { id: 'ocean', name: 'Океан', description: 'Светлая морская' },
  { id: 'lavender', name: 'Лаванда', description: 'Светлая мягкая' },
  { id: 'midnight', name: 'Midnight', description: 'Темная янтарная' },
  { id: 'forest', name: 'Forest', description: 'Темная природная' },
] as const;

type ColorTheme = (typeof COLOR_THEMES)[number]['id'];

export const Navbar: React.FC = () => {
  const { logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem('access_token'))
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const savedTheme = localStorage.getItem('unibridge-theme');
    return COLOR_THEMES.find(({ id }) => id === savedTheme)?.id ?? 'bridge';
  });

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

  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme;
    localStorage.setItem('unibridge-theme', colorTheme);
  }, [colorTheme]);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navigationLinks = [
    ...NAV_LINKS,
    ...(isAuthenticated
      ? [{ label: 'Аналитика', to: '/analytics' }]
      : []),
  ];

  const currentTheme = COLOR_THEMES.find(({ id }) => id === colorTheme) ?? COLOR_THEMES[0];
  const themePicker = (placement: 'desktop' | 'mobile') => (
    <div className={`navbar__theme-picker navbar__theme-picker--${placement}`}>
      <button
        type="button"
        className="navbar__theme-trigger"
        aria-label={`Цветовая тема: ${currentTheme.name}`}
        aria-expanded={isThemeMenuOpen}
        aria-controls={`navbar-theme-menu-${placement}`}
        onClick={() => setIsThemeMenuOpen((open) => !open)}
      >
        <Palette aria-hidden="true" />
        <span className={`navbar__theme-swatch navbar__theme-swatch--${colorTheme}`} aria-hidden="true" />
        <span className="navbar__theme-current">{currentTheme.name}</span>
        <ChevronDown className="navbar__theme-chevron" aria-hidden="true" />
      </button>

      {isThemeMenuOpen && (
        <div
          id={`navbar-theme-menu-${placement}`}
          className="navbar__theme-menu"
          role="group"
          aria-label="Выберите цветовую тему"
        >
          <p className="navbar__theme-menu-title">Цветовая тема</p>
          {COLOR_THEMES.map(({ id, name, description }) => (
            <button
              key={id}
              type="button"
              className={`navbar__theme-option${colorTheme === id ? ' navbar__theme-option--selected' : ''}`}
              aria-pressed={colorTheme === id}
              onClick={() => {
                setColorTheme(id);
                setIsThemeMenuOpen(false);
              }}
            >
              <span className={`navbar__theme-swatch navbar__theme-swatch--${id}`} aria-hidden="true" />
              <span className="navbar__theme-option-copy">
                <span className="navbar__theme-option-name">{name}</span>
                <span className="navbar__theme-option-description">{description}</span>
              </span>
              {colorTheme === id && <Check className="navbar__theme-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header
      className={`navbar${isScrolled ? ' navbar--scrolled' : ''}`}
    >
      <div
        className={`navbar__container${
          isScrolled ? ' navbar__container--scrolled' : ''
        }`}
      >
        <Link to="/#main" className="navbar__brand">
          <div className="navbar__brand-icon">
            <GraduationCap />
          </div>

          <span className="navbar__brand-name">
            Uni<span className="navbar__brand-accent">Bridge</span>
          </span>
        </Link>

        <nav className="navbar__desktop-nav">
          {navigationLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="navbar__desktop-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="navbar__desktop-actions">
          {themePicker('desktop')}
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="navbar__button-primary"
              >
                Кабинет
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="navbar__logout-button"
              >
                <LogOut />
                Выйти
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="navbar__button-primary"
            >
              Авторизация
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="navbar__menu-toggle"
          aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="navbar__mobile-menu">
          <div className="navbar__mobile-panel">
            <nav className="navbar__mobile-nav">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className="navbar__mobile-link"
                >
                  {item.label}
                </Link>
              ))}

              {isAuthenticated && (
                <Link
                  to="/analytics"
                  onClick={closeMobileMenu}
                  className="navbar__mobile-link"
                >
                  Аналитика
                </Link>
              )}

              {themePicker('mobile')}

              <hr className="navbar__mobile-divider" />

              {isAuthenticated ? (
                <div className="navbar__mobile-actions">
                  <Link
                    to="/profile"
                    onClick={closeMobileMenu}
                    className="navbar__mobile-primary"
                  >
                    Кабинет
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="navbar__mobile-logout"
                  >
                    <LogOut />
                    Выйти
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="navbar__mobile-primary navbar__mobile-login"
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