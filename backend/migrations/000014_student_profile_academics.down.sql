ALTER TABLE student_profiles
    DROP COLUMN IF EXISTS target_universities,
    DROP COLUMN IF EXISTS weekly_hours,
    DROP COLUMN IF EXISTS exams,
    DROP COLUMN IF EXISTS academic_background,
    DROP COLUMN IF EXISTS gpa;
