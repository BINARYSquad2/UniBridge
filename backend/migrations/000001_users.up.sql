-- 1. Расширения (для UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM типы данных из Auth.tsx

-- Роль пользователя (student / mentor)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'mentor');
    END IF;
END
$$;

-- Этапы готовности портфолио
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portfolio_stage') THEN
        CREATE TYPE portfolio_stage AS ENUM (
            'starting',      -- Только начинаю (формирую круг интересов)
            'in_progress',   -- Есть первые наработки (участвую в мероприятиях/курсах)
            'achieving',     -- Есть четкое видение и первые достижения (проекты/награды)
            'completed'      -- Сформированное портфолио (готов к подаче документов)
        );
    END IF;
END
$$;

-- 3. Основная таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Профиль ученика (заполняется по шагам 2-5)
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Шаг 2: Интересы (Предметы и направления)
    interests TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    
    -- Шаг 3: Сильные стороны (Навыки)
    strengths TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    
    -- Шаг 4: Точки роста (Навыки для улучшения)
    weaknesses TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    
    -- Шаг 5: Этап портфолио
    portfolio_stage portfolio_stage NOT NULL DEFAULT 'starting',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Профиль ментора (заготовка на будущее, если роль = mentor)
CREATE TABLE IF NOT EXISTS mentor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Индексы для быстрой выборки и поиска по тегам (GIN индексы)
CREATE INDEX IF NOT EXISTS idx_student_profiles_interests ON student_profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_student_profiles_strengths ON student_profiles USING GIN (strengths);
CREATE INDEX IF NOT EXISTS idx_student_profiles_weaknesses ON student_profiles USING GIN (weaknesses);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 7. Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_users_updated_at'
          AND tgrelid = 'users'::regclass
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_student_profiles_updated_at'
          AND tgrelid = 'student_profiles'::regclass
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER update_student_profiles_updated_at
            BEFORE UPDATE ON student_profiles
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END
$$;