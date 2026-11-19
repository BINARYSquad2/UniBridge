ALTER TABLE student_profiles
    ADD COLUMN target_universities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    ADD COLUMN weekly_hours SMALLINT NOT NULL DEFAULT 6
        CHECK (weekly_hours BETWEEN 1 AND 40),
    ADD COLUMN exams TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    ADD COLUMN academic_background TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    ADD COLUMN gpa NUMERIC(3, 2)
        CHECK (gpa IS NULL OR gpa BETWEEN 1.00 AND 5.00);
