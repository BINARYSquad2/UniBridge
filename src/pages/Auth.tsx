import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type AuthMode = 'login' | 'register';
type Role = 'student' | 'mentor';

// Предметы и направления
const SUBJECT_DIRECTIONS = [
  'IT & Разработка',
  'AI & Data Science',
  'STEM & Инженерия',
  'Наука & Исследования',
  'Стажировки & Карьера',
  'Экология & Sustainability',
  'Медицина & Биотех',
  'Бизнес & Предпринимательство',
  'Юриспруденция & Law',
  'Международные отношения',
  'Экзамен SAT',
  'Экзамен IELTS',
  'Экзамен NUET',
  'Олимпиады & Хакатоны',
];

// Навыки (для "Сильные стороны" и "Что улучшить")
const SKILLS_LIST = [
  'Программирование & Алгоритмы',
  'Математика & Аналитика',
  'Академическое письмо & Эссе',
  'Ораторское искусство & Питчинг',
  'Английский язык (Speaking/Writing)',
  'Проектный менеджмент',
  'Исследовательская работа (Research)',
  'Критическое мышление',
  'Тайм-менеджмент & Самоорганизация',
  'Дизайн & UX/UI',
  'Командная работа & Лидерство',
];

// Этапы готовности портфолио
const PORTFOLIO_STAGES = [
  'Только начинаю (формирую круг интересов)',
  'Есть первые наработки (участвую в мероприятиях/курсах)',
  'Есть четкое видение и первые достижения (проекты/награды)',
  'Сформированное портфолио (готов к подаче документов)',
];
const PORTFOLIO_STAGE_VALUES = ['starting', 'in_progress', 'achieving', 'completed'] as const;

interface AuthProps {
  initialMode?: AuthMode;
  onClose?: () => void;
}

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    school_grade?: number;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const Auth: React.FC<AuthProps> = ({ initialMode = 'login', onClose }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<number>(1); // 1: Аккаунт, 2: Класс, 3: Интересы, 4: Сильные стороны, 5: Точки роста, 6: Портфолио
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student' as Role,
    schoolGrade: '7',
    interests: [] as string[],
    strengths: [] as string[],
    weaknesses: [] as string[],
    portfolioStage: PORTFOLIO_STAGES[0],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleTag = (category: 'interests' | 'strengths' | 'weaknesses', tag: string) => {
    setFormData((prev) => {
      const list = prev[category];
      const updated = list.includes(tag)
        ? list.filter((item) => item !== tag)
        : [...list, tag];
      return { ...prev, [category]: updated };
    });
  };

  const submitAuth = async (endpoint: 'login' | 'register') => {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    const payload = endpoint === 'login'
      ? { email: formData.email, password: formData.password }
      : {
          full_name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          ...(formData.role === 'student' && {
            school_grade: Number(formData.schoolGrade),
            interests: formData.interests,
            strengths: formData.strengths,
            weaknesses: formData.weaknesses,
            portfolio_stage: PORTFOLIO_STAGE_VALUES[PORTFOLIO_STAGES.indexOf(formData.portfolioStage)],
          }),
        };

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as AuthResponse | { error?: string } | null;

      if (!response.ok) {
        throw new Error(result && 'error' in result ? result.error : 'Не удалось выполнить запрос');
      }
      if (!result || !('access_token' in result)) {
        throw new Error('Сервер вернул некорректный ответ');
      }

      localStorage.setItem('access_token', result.access_token);
      setSuccessMessage(endpoint === 'login' ? 'Вход выполнен' : 'Аккаунт создан');
      onClose?.();
      navigate('/profile');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось подключиться к серверу');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'login') {
      await submitAuth('login');
      return;
    }

    // Если ментор — завершаем сразу на 1 шаге
    if (formData.role === 'mentor') {
      await submitAuth('register');
      return;
    }

    // Пошаговый переход для ученика
    if (step < 6) {
      setStep((prev) => prev + 1);
    } else {
      await submitAuth('register');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen w-full bg-bg-primary flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Декоративный фон */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-10 -z-10 h-64 w-64 rounded-full bg-brand-hover/10 blur-3xl" />

      {/* Кнопка "Назад" на главную */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-6 left-6 flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-brand transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          На главную
        </button>
      )}

      {/* Карточка */}
      <div className="w-full max-w-xl bg-bg-surface rounded-3xl border border-border/80 p-8 sm:p-10 shadow-xl transition-all relative z-10">
        
        {/* Индикатор прогресса (только при регистрации ученика со 2 шага) */}
        {mode === 'register' && formData.role === 'student' && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold text-text-secondary mb-2">
              <span>Шаг {step} из 6</span>
              <span>
                {step === 1 && 'Аккаунт'}
                {step === 2 && 'Класс'}
                {step === 3 && 'Интересы'}
                {step === 4 && 'Сильные стороны'}
                {step === 5 && 'Точки роста'}
                {step === 6 && 'Портфолио'}
              </span>
            </div>
            <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Шапка */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-text-primary font-black text-2xl shadow-xs mb-4">
            U
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            {mode === 'login' && 'С возвращением!'}
            {mode === 'register' && step === 1 && 'Создать аккаунт'}
            {mode === 'register' && step === 2 && 'В каком вы классе?'}
            {mode === 'register' && step === 3 && 'Что вам интересно?'}
            {mode === 'register' && step === 4 && 'В чем вы сильны?'}
            {mode === 'register' && step === 5 && 'Что хотите улучшить?'}
            {mode === 'register' && step === 6 && 'Этап портфолио'}
          </h2>
          <p className="text-sm font-medium text-text-secondary mt-2">
            {mode === 'login' && 'Введите данные для входа в UniBridge'}
            {mode === 'register' && step === 1 && 'Присоединяйтесь к платформе менторства'}
            {mode === 'register' && step === 2 && 'Выберите класс с 7-го по 11-й'}
            {mode === 'register' && step === 3 && 'Выберите 3-4 предмета и направления, которые вам импонируют'}
            {mode === 'register' && step === 4 && 'Отметьте навыки, в которых вы чувствуете уверенность'}
            {mode === 'register' && step === 5 && 'Укажите навыки, над которыми стоит поработать'}
            {mode === 'register' && step === 6 && 'На каком этапе построения маршрута вы находитесь'}
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleNext} className="space-y-5">
          
          {/* ЭКРАН 1: Основные данные */}
          {step === 1 && (
            <>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Полное имя
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Иван Иванов"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary placeholder:text-text-secondary/50 focus:border-brand focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="example@mail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary placeholder:text-text-secondary/50 focus:border-brand focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Пароль
                  </label>
                  {mode === 'login' && (
                    <a href="#forgot" className="text-xs font-bold text-brand hover:underline">
                      Забыли?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary placeholder:text-text-secondary/50 focus:border-brand focus:outline-none transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.018 10.018 0 013.68-.825c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-2.112 1.341c-1.077.36-2.228.563-3.418.563a9.98 9.98 0 01-4.22-.924" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Я хочу зарегистрироваться как
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary focus:border-brand focus:outline-none transition-colors"
                  >
                    <option value="student">Ученик</option>
                    <option value="mentor">Ментор</option>
                  </select>
                </div>
              )}

            </>
          )}

          {/* ЭКРАН 2: Класс */}
          {step === 2 && mode === 'register' && formData.role === 'student' && (
            <div>
              <label htmlFor="schoolGrade" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                Класс
              </label>
              <select
                id="schoolGrade"
                name="schoolGrade"
                required
                value={formData.schoolGrade}
                onChange={handleChange}
                className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary focus:border-brand focus:outline-none transition-colors"
              >
                {[7, 8, 9, 10, 11].map((grade) => (
                  <option key={grade} value={grade}>{grade} класс</option>
                ))}
              </select>
            </div>
          )}

          {/* ЭКРАН 3: Интересы (Предметы и направления) */}
          {step === 3 && mode === 'register' && (
            <div className="flex flex-wrap gap-2.5 max-h-[320px] overflow-y-auto p-1">
              {SUBJECT_DIRECTIONS.map((item) => {
                const isSelected = formData.interests.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleTag('interests', item)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                      isSelected
                        ? 'border-brand bg-brand text-text-primary shadow-xs'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-brand/40 hover:text-text-primary'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          )}

          {/* ЭКРАН 4: Сильные стороны (Навыки) */}
          {step === 4 && mode === 'register' && (
            <div className="flex flex-wrap gap-2.5 max-h-[320px] overflow-y-auto p-1">
              {SKILLS_LIST.map((skill) => {
                const isSelected = formData.strengths.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleTag('strengths', skill)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                      isSelected
                        ? 'border-brand bg-brand text-text-primary shadow-xs'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-brand/40 hover:text-text-primary'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          )}

          {/* ЭКРАН 5: Что хотите улучшить (Навыки) */}
          {step === 5 && mode === 'register' && (
            <div className="flex flex-wrap gap-2.5 max-h-[320px] overflow-y-auto p-1">
              {SKILLS_LIST.map((skill) => {
                const isSelected = formData.weaknesses.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleTag('weaknesses', skill)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                      isSelected
                        ? 'border-brand bg-brand text-text-primary shadow-xs'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-brand/40 hover:text-text-primary'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          )}

          {/* ЭКРАН 6: Этап в построении маршрута / Портфолио */}
          {step === 6 && mode === 'register' && (
            <div className="space-y-3">
              {PORTFOLIO_STAGES.map((stage) => {
                const isSelected = formData.portfolioStage === stage;
                return (
                  <div
                    key={stage}
                    onClick={() => setFormData((prev) => ({ ...prev, portfolioStage: stage }))}
                    className={`cursor-pointer rounded-2xl border p-4 text-sm font-semibold transition-all ${
                      isSelected
                        ? 'border-brand bg-brand/10 text-text-primary shadow-xs'
                        : 'border-border bg-bg-primary text-text-secondary hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-brand bg-brand' : 'border-border'
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-text-primary" />}
                      </div>
                      <span>{stage}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Кнопки управления */}
          {errorMessage && (
            <p role="alert" className="text-sm font-semibold text-red-600">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" className="text-sm font-semibold text-green-700">
              {successMessage}
            </p>
          )}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="w-1/3 rounded-xl border border-border bg-bg-primary py-3.5 text-sm font-bold text-text-primary transition-colors hover:bg-bg-surface"
              >
                Назад
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-brand py-3.5 text-base font-bold text-text-primary shadow-xs transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-98"
            >
              {isSubmitting
                ? 'Отправка...'
                : mode === 'login'
                ? 'Войти в аккаунт'
                : formData.role === 'mentor'
                ? 'Зарегистрироваться'
                : step < 6
                ? 'Продолжить'
                : 'Завершить регистрацию'}
            </button>
          </div>
        </form>

        {/* Переключение режима (только на 1 шаге) */}
        {step === 1 && (
          <div className="mt-8 text-center text-xs font-semibold text-text-secondary">
            {mode === 'login' ? (
              <>
                Еще нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setStep(1);
                    navigate('/register');
                  }}
                  className="font-bold text-brand hover:underline"
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setStep(1);
                    navigate('/login');
                  }}
                  className="font-bold text-brand hover:underline"
                >
                  Войти
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};