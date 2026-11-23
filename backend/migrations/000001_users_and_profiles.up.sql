CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'mentor');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portfolio_stage') THEN
        CREATE TYPE portfolio_stage AS ENUM (
            'starting',
            'in_progress',
            'achieving',
            'completed'
        );
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_grade SMALLINT CHECK (school_grade BETWEEN 7 AND 11),
    interests TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    strengths TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    weaknesses TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    target_universities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    weekly_hours SMALLINT NOT NULL DEFAULT 6 CHECK (weekly_hours BETWEEN 1 AND 40),
    exams TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    academic_background TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    gpa NUMERIC(3, 2) CHECK (gpa IS NULL OR gpa BETWEEN 1.00 AND 5.00),
    portfolio_stage portfolio_stage NOT NULL DEFAULT 'starting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mentor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT NOT NULL DEFAULT '',
    subjects TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_school_grade ON student_profiles (school_grade);
CREATE INDEX IF NOT EXISTS idx_student_profiles_interests ON student_profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_student_profiles_strengths ON student_profiles USING GIN (strengths);
CREATE INDEX IF NOT EXISTS idx_student_profiles_weaknesses ON student_profiles USING GIN (weaknesses);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_profiles_updated_at ON student_profiles;
CREATE TRIGGER update_student_profiles_updated_at
    BEFORE UPDATE ON student_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mentor_profiles_updated_at ON mentor_profiles;
CREATE TRIGGER update_mentor_profiles_updated_at
    BEFORE UPDATE ON mentor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();