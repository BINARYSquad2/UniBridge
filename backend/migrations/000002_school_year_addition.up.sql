ALTER TABLE student_profiles
	ADD COLUMN school_grade SMALLINT CHECK (school_grade BETWEEN 7 AND 11);

CREATE INDEX idx_student_profiles_school_grade ON student_profiles (school_grade);
