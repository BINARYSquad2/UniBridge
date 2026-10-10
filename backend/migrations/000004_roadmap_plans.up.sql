CREATE TABLE roadmap_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    start_grade SMALLINT NOT NULL CHECK (start_grade BETWEEN 7 AND 11),
    end_grade SMALLINT NOT NULL CHECK (end_grade = 11),
    start_academic_year VARCHAR(9) NOT NULL
        CHECK (start_academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
    end_academic_year VARCHAR(9) NOT NULL
        CHECK (end_academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
    weekly_hours SMALLINT NOT NULL CHECK (weekly_hours BETWEEN 1 AND 40),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (start_grade <= end_grade)
);

CREATE INDEX idx_roadmap_plans_student_created
    ON roadmap_plans (student_profile_id, created_at DESC);

CREATE UNIQUE INDEX idx_roadmap_plans_one_active_per_student
    ON roadmap_plans (student_profile_id)
    WHERE is_active;

CREATE TABLE roadmap_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_plan_id UUID NOT NULL REFERENCES roadmap_plans(id) ON DELETE CASCADE,
    source_id VARCHAR(100) NOT NULL,
    position SMALLINT NOT NULL CHECK (position > 0),
    phase VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('completed', 'in_progress', 'upcoming')),
    estimated_time VARCHAR(120) NOT NULL,
    impact_score SMALLINT NOT NULL CHECK (impact_score BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_plan_id, source_id),
    UNIQUE (roadmap_plan_id, position)
);

CREATE TABLE roadmap_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_step_id UUID NOT NULL REFERENCES roadmap_steps(id) ON DELETE CASCADE,
    source_id VARCHAR(100) NOT NULL,
    position SMALLINT NOT NULL CHECK (position > 0),
    title VARCHAR(500) NOT NULL,
    duration VARCHAR(120) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_step_id, source_id),
    UNIQUE (roadmap_step_id, position),
    CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);

CREATE TABLE roadmap_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_step_id UUID NOT NULL REFERENCES roadmap_steps(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position > 0),
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_step_id, position)
);

CREATE TRIGGER update_roadmap_plans_updated_at
    BEFORE UPDATE ON roadmap_plans
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_roadmap_tasks_updated_at
    BEFORE UPDATE ON roadmap_tasks
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();