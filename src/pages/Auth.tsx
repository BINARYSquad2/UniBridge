import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import '../styles/Auth.css';
import { SUBJECT_DIRECTIONS, GROUPED_DIRECTIONS } from '../lib/subjectDirections';
import { useNavigate } from 'react-router-dom';
import { useSession, type User } from '../lib/session';

type AuthMode = 'login' | 'register';
type Role = 'student' | 'mentor';

type StepId =
  | 'account'
  | 'grade'
  | 'interests'
  | 'strengths'
  | 'weaknesses'
  | 'university'
  | 'workload'
  | 'academics'
  | 'portfolio'
  | 'mentor_directions';

interface StepConfig {
  id: StepId;
  label: string;
  title: string;
  subtitle: string;
}

const STUDENT_STEPS: StepConfig[] = [
  { id: 'account', label: 'Аккаунт', title: 'Создать аккаунт', subtitle: 'Присоединяйтесь к платформе менторства' },
  { id: 'grade', label: 'Класс', title: 'В каком вы классе?', subtitle: 'Выберите класс с 7-го по 11-й' },
  { id: 'interests', label: 'Интересы', title: 'Что вам интересно?', subtitle: 'Выберите направления, которые вам импонируют' },
  { id: 'strengths', label: 'Сильные стороны', title: 'В чем вы сильны?', subtitle: 'Отметьте навыки, в которых вы чувствуете уверенность' },
  { id: 'weaknesses', label: 'Точки роста', title: 'Что хотите улучшить?', subtitle: 'Укажите навыки, над которыми стоит поработать' },
  { id: 'university', label: 'Университет', title: 'Целевые университеты', subtitle: 'Выберите вузы мечты или регион поступления' },
  { id: 'workload', label: 'Нагрузка', title: 'Недельная нагрузка', subtitle: 'Сколько часов в неделю вы готовы уделять развитию портфолио?' },
  { id: 'academics', label: 'Бэкграунд', title: 'Экзамены и успеваемость', subtitle: 'Укажите текущие результаты тестов и академический профиль' },
  { id: 'portfolio', label: 'Портфолио', title: 'Этап портфолио', subtitle: 'На каком этапе построения маршрута вы находитесь' },
];

const MENTOR_STEPS: StepConfig[] = [
  { id: 'account', label: 'Данные и О себе', title: 'Создать аккаунт', subtitle: 'Присоединяйтесь к платформе менторства' },
  { id: 'mentor_directions', label: 'Направления', title: 'Выберите направления', subtitle: 'Укажите направления, по которым вы готовы менторить' },
];

const SKILLS_LIST = [
  'Программирование & Алгоритмы',
  'Математика & Аналитика',
  'Академическое письмо & Эссе',
  'Ораторское искусство & Питчинг',
  'Проектный менеджмент',
  'Критическое мышление',
  'Тайм-менеджмент & Самоорганизация',
  'Командная работа & Лидерство',
];

const POPULAR_UNIVERSITIES = [
  'Nazarbayev University (NU)',
  'KAIST / POSTECH (Южная Корея)',
  'MIT / Stanford / Ivy League (США)',
  'США (Top 50 / Liberal Arts)',
  'Европа (ETH Zurich, TU Delft, TUM)',
  'Великобритания (Oxbridge, Imperial, UCL)',
  'Азия (HKUST, NUS, NTU)',
  'Пока не определился',
];

const WORKLOAD_OPTIONS = [
  { value: 3, label: '2–4 часа / нед', desc: 'Лайт-режим: базовые микро-цели без перегруза школы' },
  { value: 6, label: '5–7 часов / нед', desc: 'Оптимально: системный рост и работа над проектами' },
  { value: 12, label: '10–14 часов / нед', desc: 'Интенсив: активная подготовка к экзаменам и олимпиадам' },
  { value: 18, label: '15+ часов / нед', desc: 'Хардкор: фокус на скорое поступление и дедлайны' },
];

const EXAM_TYPES = ['SAT', 'ACT', 'IELTS', 'TOEFL', 'ЕНТ', 'NUET', 'AP / IB', 'Пока не сдавал'];

const ACADEMIC_TAGS = [
  'НИШ / БИЛ / РФМШ',
  'Изучаю AP / IB / A-Level программу',
  'Призер областных олимпиад',
  'Призер республиканских / международных олимпиад',
  'Участник / призер хакатонов и кейс-чемпионатов',
  'Есть готовые pet-проекты / GitHub',
  'Есть научная работа / статья',
  'Опыт стажировки или фриланса',
  'Основатель / лидер школьного клуба',
  'Системное волонтерство / соц. проекты',
];

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
  'weekly_hours must be between 1 and 40': 'Укажите нагрузку от 1 до 40 часов в неделю.',
  'gpa must be between 1 and 5': 'Укажите GPA от 1 до 5.',
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

const stepVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 32 : -32,
    opacity: 0,
    filter: 'blur(4px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: 'blur(0px)',
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 32 : -32,
    opacity: 0,
    filter: 'blur(4px)',
  }),
};

const springTransition = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85,
};

export const Auth: React.FC<AuthProps> = ({ initialMode = 'login', onClose }) => {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [customUniInput, setCustomUniInput] = useState('');

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
    targetUniversities: [] as string[],
    weeklyHours: 6,
    exams: [] as string[],
    academicBackground: [] as string[],
    gpa: '',
    portfolioStage: PORTFOLIO_STAGES[0],
  });

  const activeSteps = formData.role === 'mentor' ? MENTOR_STEPS : STUDENT_STEPS;
  const currentStep = activeSteps[stepIndex] ?? activeSteps[0];
  const isLastStep = stepIndex === activeSteps.length - 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleTag = (
    category: 'interests' | 'strengths' | 'weaknesses' | 'targetUniversities' | 'academicBackground',
    tag: string
  ) => {
    setFormData((prev) => {
      const list = prev[category];
      const updated = list.includes(tag)
        ? list.filter((item) => item !== tag)
        : [...list, tag];
      return { ...prev, [category]: updated };
    });
  };

  const addCustomUniversity = () => {
    const trimmed = customUniInput.trim();
    if (!trimmed) return;
    if (!formData.targetUniversities.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        targetUniversities: [...prev.targetUniversities, trimmed],
      }));
    }
    setCustomUniInput('');
  };

  const toggleExam = (examName: string) => {
    setFormData((prev) => {
      const exists = prev.exams.includes(examName);
      if (exists) {
        return { ...prev, exams: prev.exams.filter((e) => e !== examName) };
      }
      return { ...prev, exams: [...prev.exams, examName] };
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
            target_universities: formData.targetUniversities,
            weekly_hours: formData.weeklyHours,
            exams: formData.exams,
            academic_background: formData.academicBackground,
            gpa: formData.gpa ? Number(formData.gpa) : null,
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
    setErrorMessage('');

    if (mode === 'login') {
      await submitAuth('login');
      return;
    }

    if (currentStep.id === 'mentor_directions' && !formData.interests.length) {
      setErrorMessage('Выберите хотя бы одно направление');
      return;
    }

    if (!isLastStep) {
      setDirection(1);
      setStepIndex((prev) => prev + 1);
    } else {
      await submitAuth('register');
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setErrorMessage('');
      setDirection(-1);
      setStepIndex((prev) => prev - 1);
    }
  };

  const studentProgressPercent = Math.round(((stepIndex + 1) / STUDENT_STEPS.length) * 100);
  const mentorProgressPercent = Math.round(((stepIndex + 1) / 2) * 100);

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
              <span>Шаг {stepIndex + 1} из {activeSteps.length}</span>
              <span>{currentStep.label}</span>
            </div>
            <div className="tw-095acb2755 tw-6da6a3c3f7 tw-6a2c73aab2 tw-ac204c1088 tw-2cd02d11d1">
              <motion.div
                className="tw-668b21aa54 tw-da1032643a tw-0fe7d7d814 tw-7890552ecd"
                initial={{ width: 0 }}
                animate={{ width: `${studentProgressPercent}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              />
            </div>
          </div>
        )}

        {mode === 'register' && formData.role === 'mentor' && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold text-text-secondary mb-2">
              <span>Шаг {stepIndex + 1} из 2 (Ментор)</span>
              <span>{stepIndex === 0 ? 'Данные и О себе' : 'Направления'}</span>
            </div>
            <div className="h-1.5 w-full bg-bg-primary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${mentorProgressPercent}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              />
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <motion.div
            whileHover={{ scale: 1.06, rotate: -2 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-text-primary font-black text-2xl shadow-xs mb-4 cursor-default"
          >
            U
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode === 'login' ? 'header-login' : `header-${currentStep.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <h2 className="tw-3febee094e tw-b6496ebe70 tw-7fbb85697d tw-5358eecb47 tw-1d7f28b046">
                {mode === 'login' ? 'С возвращением!' : currentStep.title}
              </h2>
              <p className="tw-fc7473ca09 tw-2689f39580 tw-16720c5987 tw-50d0d216a2">
                {mode === 'login' ? 'Введите данные для входа в UniBridge' : currentStep.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <form onSubmit={handleNext} className="tw-b43b4c086d overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={mode === 'login' ? 'login' : currentStep.id}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="tw-b43b4c086d"
            >
              {/* ШАГ 1: Аккаунт */}
              {(mode === 'login' || currentStep.id === 'account') && (
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
                        <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b">
                          Я хочу зарегистрироваться как
                        </label>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, role: e.target.value as Role }));
                            setStepIndex(0);
                          }}
                          className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e"
                        >
                          <option value="student">Ученик</option>
                          <option value="mentor">Ментор</option>
                        </select>
                      </div>

                      {formData.role === 'mentor' && (
                        <div>
                          <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b">
                            О себе (Bio)
                          </label>
                          <textarea
                            name="bio"
                            rows={3}
                            required
                            placeholder="Расскажите о своем опыте и достижениях..."
                            value={formData.bio}
                            onChange={handleChange}
                            className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e resize-none"
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Ментор: Направления */}
              {mode === 'register' && formData.role === 'mentor' && currentStep.id === 'mentor_directions' && (
                <div className="tw-3e7ce58d64">
                  <fieldset>
                    <legend className="tw-69450ef148 tw-a77ed4d908 mb-3">Направления менторства</legend>
                    <div className="tw-60fbb77139 tw-1eb5c6df38 tw-77a2a20e90 max-h-[300px] overflow-y-auto p-1">
                      {SUBJECT_DIRECTIONS.map((item) => (
                        <label key={item} className="tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-7660b45090 tw-fc7473ca09 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.interests.includes(item)}
                            onChange={() => toggleTag('interests', item)}
                          />{' '}
                          {item}
                        </label>
                      ))}
                    </div>
                    <p className="tw-50d0d216a2 tw-fc7473ca09 tw-16720c5987 mt-2">Выберите хотя бы одно направление.</p>
                  </fieldset>
                </div>
              )}

              {/* Ученик: Шаг 2 (Класс) */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'grade' && (
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

              {/* Ученик: Шаг 3 (Интересы, сгруппированные по кластерам) */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'interests' && (
                <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                  {GROUPED_DIRECTIONS.map((group) => (
                    <div key={group.category}>
                      <p className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 mb-2">
                        {group.category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const isSelected = formData.interests.includes(item);
                          return (
                            <motion.button
                              key={item}
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => toggleTag('interests', item)}
                              className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 transition-colors ${
                                isSelected
                                  ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                                  : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                              }`}
                            >
                              {item}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ученик: Шаг 4 (Сильные стороны) */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'strengths' && (
                <div className="tw-60fbb77139 tw-1eb5c6df38 tw-7e9a2a250c tw-fd9aebd23c tw-92bf82f493 tw-eb6a3cef96 max-h-[320px] overflow-y-auto p-1">
                  {SKILLS_LIST.map((skill) => {
                    const isSelected = formData.strengths.includes(skill);
                    return (
                      <motion.button
                        key={skill}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleTag('strengths', skill)}
                        className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 transition-colors ${
                          isSelected
                            ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                            : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                        }`}
                      >
                        {skill}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Ученик: Шаг 5 (Точки роста) */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'weaknesses' && (
                <div className="flex flex-wrap gap-2.5 max-h-[320px] overflow-y-auto p-1">
                  {SKILLS_LIST.map((skill) => {
                    const isSelected = formData.weaknesses.includes(skill);
                    return (
                      <motion.button
                        key={skill}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleTag('weaknesses', skill)}
                        className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 transition-colors ${
                          isSelected
                            ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                            : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                        }`}
                      >
                        {skill}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* ШАГ: Университеты */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'university' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto p-1">
                    {[...new Set([...POPULAR_UNIVERSITIES, ...formData.targetUniversities])].map((uni) => {
                      const isSelected = formData.targetUniversities.includes(uni);
                      return (
                        <motion.button
                          key={uni}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => toggleTag('targetUniversities', uni)}
                          className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 transition-colors ${
                            isSelected
                              ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                              : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                          }`}
                        >
                          {uni}
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customUniInput}
                      onChange={(e) => setCustomUniInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomUniversity();
                        }
                      }}
                      placeholder="Другой университет..."
                      className="tw-6da6a3c3f7 tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-f0faeb26d6 tw-1b2d54a3fd tw-fc7473ca09 tw-e83a7042bc tw-5358eecb47 tw-e7708255fb tw-68308c6db2 tw-55d048ebfb tw-ceb69a6b0e flex-1 text-xs"
                    />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={addCustomUniversity}
                      className="tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-fc7473ca09 tw-69450ef148 tw-5358eecb47 tw-ceb69a6b0e px-4 text-xs font-bold transition-all hover:opacity-90"
                    >
                      + Добавить
                    </motion.button>
                  </div>
                </div>
              )}

              {/* ШАГ: Недельная нагрузка */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'workload' && (
                <div className="space-y-3">
                  {WORKLOAD_OPTIONS.map((opt) => {
                    const isSelected = formData.weeklyHours === opt.value;
                    return (
                      <motion.div
                        key={opt.value}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setFormData((prev) => ({ ...prev, weeklyHours: opt.value }))}
                        className={`tw-3451683673 tw-68f2db624d tw-ca6bcd4b6f tw-8e63407b5c tw-fc7473ca09 tw-e83a7042bc tw-0fe7d7d814 cursor-pointer transition-colors ${
                          isSelected
                            ? "tw-9c9f7fcae1 tw-ce45d053a5 tw-5358eecb47 tw-cef5b893cf"
                            : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d"
                        }`}
                      >
                        <div className="tw-60fbb77139 tw-3960ffc248 tw-1004c0c395 mb-1">
                          <div
                            className={`tw-11e59c6d5f tw-dc7972ebf3 tw-ac204c1088 tw-ca6bcd4b6f tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 transition-all ${
                              isSelected ? "tw-9c9f7fcae1 tw-da1032643a" : "tw-18049387f0"
                            }`}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="tw-095acb2755 tw-c696a08909 tw-ac204c1088 tw-a2765f83f5"
                              />
                            )}
                          </div>
                          <span className="font-bold text-sm">{opt.label}</span>
                        </div>
                        <p className="text-xs text-text-secondary pl-6">{opt.desc}</p>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ШАГ: Экзамены (Только выбор сдачи экзаменов без баллов) и Академический бэкграунд */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'academics' && (
                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                  <div>
                    <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987 tw-d7c1392c7b mb-2">
                      1. Планируемые экзамены
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {EXAM_TYPES.map((exam) => {
                        const isSelected = formData.exams.includes(exam);
                        return (
                          <motion.button
                            key={exam}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => toggleExam(exam)}
                            className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 text-xs px-3.5 py-2 transition-colors ${
                              isSelected
                                ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                                : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                            }`}
                          >
                            {exam}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="tw-0214b4b355 tw-359090c2d5 tw-69450ef148 tw-117ec720ea tw-09ace3a4d9 tw-16720c5987">
                        2. Академический профиль и GPA
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="5"
                        name="gpa"
                        placeholder="GPA (например, 4.8)"
                        value={formData.gpa}
                        onChange={handleChange}
                        className="w-32 rounded-lg border border-border bg-bg-primary px-2.5 py-1 text-xs text-text-primary focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ACADEMIC_TAGS.map((tag) => {
                        const isSelected = formData.academicBackground.includes(tag);
                        return (
                          <motion.button
                            key={tag}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => toggleTag('academicBackground', tag)}
                            className={`tw-a217b4eaa9 tw-ca6bcd4b6f tw-f0faeb26d6 tw-e7ee55ac7f tw-359090c2d5 tw-69450ef148 tw-0fe7d7d814 text-xs px-3 py-1.5 text-left transition-colors ${
                              isSelected
                                ? "tw-9c9f7fcae1 tw-da1032643a tw-5358eecb47 tw-cef5b893cf"
                                : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d tw-1852007365"
                            }`}
                          >
                            {tag}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Ученик: Шаг 9 (Этап портфолио) */}
              {mode === 'register' && formData.role === 'student' && currentStep.id === 'portfolio' && (
                <div className="space-y-3">
                  {PORTFOLIO_STAGES.map((stage) => {
                    const isSelected = formData.portfolioStage === stage;
                    return (
                      <motion.div
                        key={stage}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setFormData((prev) => ({ ...prev, portfolioStage: stage }))}
                        className={`tw-3451683673 tw-68f2db624d tw-ca6bcd4b6f tw-8e63407b5c tw-fc7473ca09 tw-e83a7042bc tw-0fe7d7d814 cursor-pointer transition-colors ${
                          isSelected
                            ? "tw-9c9f7fcae1 tw-ce45d053a5 tw-5358eecb47 tw-cef5b893cf"
                            : "tw-18049387f0 tw-6a2c73aab2 tw-16720c5987 tw-7ce289893d"
                        }`}
                      >
                        <div className="tw-60fbb77139 tw-3960ffc248 tw-1004c0c395">
                          <div
                            className={`tw-11e59c6d5f tw-dc7972ebf3 tw-ac204c1088 tw-ca6bcd4b6f tw-60fbb77139 tw-3960ffc248 tw-86843cf1e2 transition-all ${
                              isSelected ? "tw-9c9f7fcae1 tw-da1032643a" : "tw-18049387f0"
                            }`}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="tw-095acb2755 tw-c696a08909 tw-ac204c1088 tw-a2765f83f5"
                              />
                            )}
                          </div>
                          <span>{stage}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {errorMessage && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="tw-fc7473ca09 tw-e83a7042bc tw-421d458123"
            >
              {errorMessage}
            </motion.p>
          )}
          {successMessage && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
              className="tw-fc7473ca09 tw-e83a7042bc tw-2c03cd7793"
            >
              {successMessage}
            </motion.p>
          )}

          <div className="tw-60fbb77139 tw-1004c0c395 tw-173fa8f067 mt-6">
            {stepIndex > 0 && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleBack}
                className="tw-c76f96cfba tw-a217b4eaa9 tw-ca6bcd4b6f tw-18049387f0 tw-6a2c73aab2 tw-69e76918fe tw-fc7473ca09 tw-69450ef148 tw-5358eecb47 tw-ceb69a6b0e tw-24dc8f7d93 transition-colors"
              >
                Назад
              </motion.button>
            )}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="tw-36e579c0b4 tw-a217b4eaa9 tw-da1032643a tw-69e76918fe tw-4ee734926f tw-69450ef148 tw-5358eecb47 tw-cef5b893cf tw-0fe7d7d814 tw-625a4c3fbe tw-6dc89721e0 tw-9e85ac05ca tw-528e9016b2 transition-colors"
            >
              {isSubmitting
                ? 'Отправка...'
                : mode === 'login'
                ? 'Войти в аккаунт'
                : !isLastStep
                ? 'Продолжить'
                : 'Завершить регистрацию'}
            </motion.button>
          </div>
        </form>

        {stepIndex === 0 && (
          <div className="tw-4e5d2af5fc tw-ca6bf63030 tw-359090c2d5 tw-e83a7042bc tw-16720c5987">
            {mode === 'login' ? (
              <>
                Еще нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setStepIndex(0);
                    setDirection(1);
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
                    setStepIndex(0);
                    setDirection(-1);
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