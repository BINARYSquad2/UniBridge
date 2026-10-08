DROP INDEX IF EXISTS idx_student_profiles_school_grade;

ALTER TABLE student_profiles
    DROP COLUMN IF EXISTS school_grade;