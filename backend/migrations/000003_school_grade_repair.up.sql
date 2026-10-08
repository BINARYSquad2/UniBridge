ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS school_grade SMALLINT CHECK (school_grade BETWEEN 7 AND 11);

CREATE INDEX IF NOT EXISTS idx_student_profiles_school_grade
    ON student_profiles (school_grade);