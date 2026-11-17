import React, { useState } from 'react';
import '../styles/Auth.css';
import { SUBJECT_DIRECTIONS } from '../lib/subjectDirections';
import { useNavigate } from 'react-router-dom';
import { useSession, type User } from '../lib/session';

type AuthMode = 'login' | 'register';
type Role = 'student' | 'mentor';

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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const API_ERROR_MESSAGES: Record<string, string> = {
  'invalid request body': 'Проверьте данные в форме и попробуйте ещё раз.',
  'invalid registration details': 'Проверьте имя, фамилию, email и пароль.',
  'invalid login details': 'Проверьте email и пароль.',
  'school_grade must be between 7 and 11': 'Выберите класс с 7-го по 11-й.',
  'invalid portfolio_stage': 'Выберите этап портфолио.',
  'email is already registered': 'Этот email уже зарегистрирован.',
  'could not create student profile': 'Не удалось создать профиль ученика. Попробуйте ещё раз.',
  'could not create account': 'Не удалось создать аккаунт. Попробуйте ещё раз.',
  'could not sign in': 'Не удалось выполнить вход. Попробуйте позже.',
};

const getApiErrorMessage = (body: string, fallback: string) => {
  let message = body.trim();
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      const response = parsed as { error?: unknown; message?: unknown };
      const responseMessage = response.error ?? response.message;
      if (typeof responseMessage === 'string') message = responseMessage;
    }
  } catch {
    // Plain text fallback
  }

  if (!message) return fallback;
  return API_ERROR_MESSAGES[message] ?? message;
};

export const Auth: React.FC<AuthProps> = ({ initialMode = 'login', onClose }) => {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<number>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [   isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    bio: '',
    name: '',
    surname: '',
    email: '',
    password: '',
    role: 'student' as Role,
    schoolGrade: '7',
    interests: [] as string[],
    strengths: [] as string[],
    weaknesses: [] as string[],
    portfolioStage: PORTFOLIO_STAGES[0],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

    localStorage.removeItem('access_token');

    const payload = endpoint === 'login'
      ? { email: formData.email, password: formData.password }
      : {
          name: formData.name,
          surname: formData.surname,
          full_name: `${formData.name} ${formData.surname}`.trim(),
          email: formData.email,
          password: formData.password,
          role: formData.role,
          ...(formData.role === 'mentor' && { bio: formData.bio, subjects: formData.interests }),
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

      const responseBody = await response.text();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(getApiErrorMessage(
            responseBody,
            'Сервис авторизации не найден (404). Проверьте адрес API и запущен ли сервер.'
          ));
        }
        if (endpoint === 'login' && response.status === 401) {
          throw new Error('Неверный email или пароль');
        }
        throw new Error(getApiErrorMessage(
          responseBody,
          endpoint === 'login' ? 'Не удалось выполнить вход' : 'Ошибка регистрации'
        ));
      }

      const result = responseBody ? JSON.parse(responseBody) as { access_token?: string; user?: User } : null;
      if (
        !result ||
        typeof result !== 'object' ||
        !result.access_token ||
        !result.user?.id ||
        !result.user.full_name ||
        !result.user.email ||
        !['student', 'mentor'].includes(result.user.role)
      ) {
        if (endpoint === 'login') {
          throw new Error('Неверный email или пароль');
        }
        throw new Error('Сервер вернул некорректный ответ');
      }

      signIn(result.access_token, result.user);
      setSuccessMessage(endpoint === 'login' ? 'Вход выполнен' : 'Аккаунт создан');
      onClose?.();
      navigate('/profile', { replace: true });
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

    if (formData.role === 'mentor') {
      if (step === 1) {
        setStep(2);
        return;
      }
      if (step === 2) {
        if (!formData.interests.length) {
          setErrorMessage('Выберите хотя бы одно направление');
          return;
        }
        await submitAuth('register');
        return;
      }
    }

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
    <div className="tw-793346c736 tw-6da6a3c3f7 tw-6a2c73aab2 tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 tw-8e63407b5c tw-59c7996bbc tw-d89972fe17 tw-2cd02d11d1">
      <div className="tw-a4326536b8 tw-da4dbfbc4f tw-bd25655a34 tw-e632769ad7 tw-0917b4a458 tw-d523403940 tw-dc45d79cca tw-efaa070148 tw-ac204c1088 tw-2be63f721e tw-4b5e775b14" />
      <div className="tw-a4326536b8 tw-da4dbfbc4f tw-189f036c33 tw-741e864f7f tw-0917b4a458 tw-14ce684b98 tw-6ca625288b tw-ac204c1088 tw-48df15740e tw-4b5e775b14" />

      {onClose && (
        <button
          onClick={onClose}
          className="tw-da4dbfbc4f tw-e9d6ffe0c5 tw-b80d184e01 tw-60fbb77139 tw-3960ffc248 tw-77a2a20e90 tw-fc7473ca09 tw-69450ef148 tw-16720c5987 tw-f09cea7854 tw-ceb69a6b0e"
        >
          <svg className="tw-cd0d9c512c tw-72470489ff" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          На главную
        </button>
      )}

      <div className="tw-6da6a3c3f7 tw-9ef2b581bf tw-48a2a9e0eb tw-ea189a088a tw-ca6bcd4b6f tw-c9ed8c5f79 tw-845f53365c tw-84d75d6c14 tw-a739868a85 tw-0fe7d7d814 tw-d89972fe17 tw-236812d64c">
        
        {mode === 'register' && formData.role === 'student' && (
          <div className="tw-b6777c6db9">
            <div className="tw-60fbb77139 tw-8ef2268efb tw-359090c2d5 tw-69450ef148 tw-16720c5987 tw-a77ed4d908">
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
            <div className="tw-095acb2755 tw-6da6a3c3f7 tw-6a2c73aab2 tw-ac204c1088 tw-2cd02d11d1">
              <div
                className={`tw-668b21aa54 tw-da1032643a tw-0fe7d7d814 tw-7890552ecd progress-width--${Math.round((step / 6) * 100)}`}
              />
            </div>
          </div>
        )}

        {mode === 'register' && formData.role === 'mentor' && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold text-text-secondary mb-2">
              <span>Шаг {step} из 2 (Ментор)</span>
              <span>{step === 1 ? 'Данные и О себе' : 'Направления'}</span>
            </div>
            <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-text-primary font-black text-2xl shadow-xs mb-4">
            U
          </div>
          <h2 className="tw-3febee094e tw-b6496ebe70 tw-7fbb85697d tw-5358eecb47 tw-1d7f28b046">
            {mode === 'login' && 'С возвращением!'}
            {mode === 'register' && step === 1 && 'Создать аккаунт'}
            {mode === 'register' && formData.role === 'student' && step === 2 && 'В каком вы классе?'}
            {mode === 'register' && formData.role === 'student' && step === 3 && 'Что вам интересно?'}
            {mode === 'register' && formData.role === 'student' && step === 4 && 'В чем вы сильны?'}
            {mode === 'register' && formData.role === 'student' && step === 5 && 'Что хотите улучшить?'}
            {mode === 'register' && formData.role === 'student' && step === 6 && 'Этап портфолио'}
            {mode === 'register' && formData.role === 'mentor' && step === 2 && 'Выберите направления'}
          </h2>
          <p className="tw-fc7473ca09 tw-2689f39580 tw-16720c5987 tw-50d0d216a2">
            {mode === 'login' && 'Введите данные для входа в UniBridge'}
            {mode === 'register' && step === 1 && 'Присоединяйтесь к платформе менторства'}
            {mode === 'register' && formData.role === 'student' && step === 2 && 'Выберите класс с 7-го по 11-й'}
            {mode === 'register' && formData.role === 'student' && step === 3 && 'Выберите 3-4 предмета и направления, которые вам импонируют'}
            {mode === 'register' && formData.role === 'student' && step === 4 && 'Отметьте навыки, в которых вы чувствуете уверенность'}
            {mode === 'register' && formData.role === 'student' && step === 5 && 'Укажите навыки, над которыми стоит поработать'}
            {mode === 'register' && formData.role === 'student' && step === 6 && 'На каком этапе построения маршрута вы находитесь'}
            {mode === 'register' && formData.role === 'mentor' && step === 2 && 'Укажите направления, по которым вы готовы менторить'}
          </p>
        </div>

        <form onSubmit={handleNext} className="tw-b43b4c086d">
          {step === 1 && (
            <>
              {mode === 'register' && (
                <>
                  <div>
                    <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b">
                      Имя
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Иван"
                      value={formData.name}
                      onChange={handleChange}
                      className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-e7708255fb tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e"
                    />
                  </div>
                  <div>
                    <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b">
                      Фамилия
                    </label>
                    <input
                      type="text"
                      name="surname"
                      required
                      maxLength={128}
                      autoComplete="family-name"
                      placeholder="Иванов"
                      value={formData.surname}
                      onChange={handleChange}
                      className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-e7708255fb tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="example@mail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-e7708255fb tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e"
                />
              </div>

              <div>
                <div className="tw-60fbb77139 tw-3960ffc248 tw-8ef2268efb tw-d7c1392c7b">
                  <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">
                    Пароль
                  </label>
                  {mode === 'login' && (
                    <a href="#forgot" className="tw-359090c2d5 tw-69450ef148 tw-17d820623e tw-f673f4a7d0">
                      Забыли?
                    </a>
                  )}
                </div>
                <div className="tw-d89972fe17">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-e7708255fb tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e tw-b700316d5e"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="tw-da4dbfbc4f tw-c100b64c5c tw-d694ba66e3 tw-36b381be4d tw-16720c5987 tw-1852007365 tw-ceb69a6b0e"
                  >
                    {showPassword ? (
                      <svg className="tw-cd0d9c512c tw-72470489ff" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.018 10.018 0 013.68-.825c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-2.112 1.341c-1.077.36-2.228.563-3.418.563a9.98 9.98 0 01-4.22-.924" />
                      </svg>
                    ) : (
                      <svg className="tw-cd0d9c512c tw-72470489ff" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <>
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

                  {formData.role === 'mentor' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                        О себе (Bio)
                      </label>
                      <textarea
                        name="bio"
                        rows={3}
                        placeholder="Расскажите о своем опыте и достижениях..."
                        value={formData.bio}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary placeholder:text-text-secondary/50 focus:border-brand focus:outline-none transition-colors resize-none"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {mode === 'register' && formData.role === 'mentor' && (
            <div className="tw-3e7ce58d64">
              <label className="tw-0214b4b355 tw-69450ef148">О себе и опыте
                <textarea name="bio" value={formData.bio} onChange={handleChange} required maxLength={4000} rows={3} placeholder="В чём вы можете помочь ученикам?" className="tw-50d0d216a2 tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-eb6e8b881a" />
              </label>
              <fieldset><legend className="tw-69450ef148 tw-a77ed4d908">Направления менторства</legend>
                <div className="tw-60fbb77139 tw-1eb5c6df38 tw-77a2a20e90">{SUBJECT_DIRECTIONS.map(item => <label key={item} className="tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-7660b45090 tw-fc7473ca09"><input type="checkbox" checked={formData.interests.includes(item)} onChange={() => toggleTag('interests', item)} /> {item}</label>)}</div>
                <p className="tw-50d0d216a2 tw-fc7473ca09 tw-16720c5987">Выберите хотя бы одно направление.</p>
              </fieldset>
            </div>
          )}
          {/* ЭКРАН 2: Класс */}
          {step === 2 && mode === 'register' && formData.role === 'student' && (
            <div>
              <label htmlFor="schoolGrade" className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b">
                Класс
              </label>
              <select
                id="schoolGrade"
                name="schoolGrade"
                required
                value={formData.schoolGrade}
                onChange={handleChange}
                className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e"
              >
                {[7, 8, 9, 10, 11].map((grade) => (
                  <option key={grade} value={grade}>{grade} класс</option>
                ))}
              </select>
            </div>
          )}

          {/* Интересы / Направления (Шаг 3 для ученика, Шаг 2 для ментора) */}
          {((step === 3 && formData.role === 'student') || (step === 2 && formData.role === 'mentor')) && mode === 'register' && (
            <div className="flex flex-wrap gap-2.5 max-h-[320px] overflow-y-auto p-1">
              {SUBJECT_DIRECTIONS.map((item) => {
                const isSelected = formData.interests.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleTag('interests', item)}
                    className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 ${
                      isSelected
                        ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                        : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          )}

          {step === 4 && mode === 'register' && (
            <div className="tw-60fbb77139 tw-1eb5c6df38 tw-7e9a2a250c tw-fd9aebd23c tw-92bf82f493 tw-eb6a3cef96">
              {SKILLS_LIST.map((skill) => {
                const isSelected = formData.strengths.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleTag('strengths', skill)}
                    className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 ${
                      isSelected
                        ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                        : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          )}

          {/* Шаг 5 для ученика: Что улучшить */}
          {step === 5 && mode === 'register' && formData.role === 'student' && (
            <div className="flex flex-wrap gap-2.5 max-h-[320px] overflow-y-auto p-1">
              {SKILLS_LIST.map((skill) => {
                const isSelected = formData.weaknesses.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleTag('weaknesses', skill)}
                    className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 ${
                      isSelected
                        ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                        : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          )}

          {/* Шаг 6 для ученика: Этап портфолио */}
          {step === 6 && mode === 'register' && formData.role === 'student' && (
            <div className="space-y-3">
              {PORTFOLIO_STAGES.map((stage) => {
                const isSelected = formData.portfolioStage === stage;
                return (
                  <div
                    key={stage}
                    onClick={() => setFormData((prev) => ({ ...prev, portfolioStage: stage }))}
                    className={`tw-3451683673 tw-68f2db624d tw-ca6bcd4b6f tw-8e63407b5c tw-fc7473ca09 tw-e83a7042bc tw-0fe7d7d814 ${
                      isSelected
                        ? "tw-9c9f7fcae1 tw-ce45d053a5 tw-5358eecb47 tw-cef5b893cf"
                        : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d"
                    }`}
                  >
                    <div className="tw-60fbb77139 tw-3960ffc248 tw-1004c0c395">
                      <div
                        className={`tw-11e59c6d5f tw-dc7972ebf3 tw-ac204c1088 tw-ca6bcd4b6f tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 ${
                          isSelected ? "tw-9c9f7fcae1 tw-da1032643a" : "tw-18049387f0"
                        }`}
                      >
                        {isSelected && <div className="tw-095acb2755 tw-c696a08909 tw-ac204c1088 tw-a2765f83f5" />}
                      </div>
                      <span>{stage}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {errorMessage && (
            <p role="alert" className="tw-fc7473ca09 tw-e83a7042bc tw-421d458123">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" className="tw-fc7473ca09 tw-e83a7042bc tw-2c03cd7793">
              {successMessage}
            </p>
          )}

          <div className="tw-60fbb77139 tw-1004c0c395 tw-173fa8f067">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="tw-c76f96cfba tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-69e76918fe tw-fc7473ca09 tw-69450ef148 tw-5358eecb47 tw-ceb69a6b0e tw-24dc8f7d93"
              >
                Назад
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="tw-36e579c0b4 tw-a217b4eaa9 tw-da1032643a tw-69e76918fe tw-4ee734926f tw-69450ef148 tw-5358eecb47 tw-cef5b893cf tw-0fe7d7d814 tw-625a4c3fbe tw-6dc89721e0 tw-9e85ac05ca tw-528e9016b2"
            >
              {isSubmitting
                ? 'Отправка...'
                : mode === 'login'
                ? 'Войти в аккаунт'
                : formData.role === 'mentor' && step === 2
                ? 'Завершить регистрацию'
                : formData.role === 'mentor' && step === 1
                ? 'Продолжить'
                : step < 6
                ? 'Продолжить'
                : 'Завершить регистрацию'}
            </button>
          </div>
        </form>

        {step === 1 && (
          <div className="tw-4e5d2af5fc tw-ca6bf63030 tw-359090c2d5 tw-e83a7042bc tw-16720c5987">
            {mode === 'login' ? (
              <>
                Еще нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setStep(1);
                    setErrorMessage('');
                    navigate('/register');
                  }}
                  className="tw-69450ef148 tw-17d820623e tw-f673f4a7d0"
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
                    setErrorMessage('');
                    navigate('/login');
                  }}
                  className="tw-69450ef148 tw-17d820623e tw-f673f4a7d0"
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