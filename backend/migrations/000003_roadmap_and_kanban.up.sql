-- ROADMAP
CREATE TABLE IF NOT EXISTS roadmap_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    start_grade SMALLINT NOT NULL CHECK (start_grade BETWEEN 7 AND 11),
    end_grade SMALLINT NOT NULL CHECK (end_grade = 11),
    start_academic_year VARCHAR(9) NOT NULL CHECK (start_academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
    end_academic_year VARCHAR(9) NOT NULL CHECK (end_academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (start_grade <= end_grade)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_plans_student_created
    ON roadmap_plans (student_profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmap_plans_one_active_per_student
    ON roadmap_plans (student_profile_id)
    WHERE is_active;

CREATE TABLE IF NOT EXISTS roadmap_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_plan_id UUID NOT NULL REFERENCES roadmap_plans(id) ON DELETE CASCADE,
    source_id VARCHAR(100) NOT NULL,
    position SMALLINT NOT NULL CHECK (position > 0),
    track VARCHAR(20) NOT NULL DEFAULT 'academics' CHECK (track IN ('academics', 'leadership', 'impact')),
    phase VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'in_progress', 'upcoming')),
    estimated_time VARCHAR(120) NOT NULL,
    impact_score SMALLINT NOT NULL CHECK (impact_score BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_plan_id, source_id),
    UNIQUE (roadmap_plan_id, position)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_steps_plan_track
    ON roadmap_steps (roadmap_plan_id, track);

CREATE TABLE IF NOT EXISTS roadmap_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_step_id UUID NOT NULL REFERENCES roadmap_steps(id) ON DELETE CASCADE,
    source_id VARCHAR(100) NOT NULL,
    position SMALLINT NOT NULL CHECK (position > 0),
    track VARCHAR(20) NOT NULL DEFAULT 'academics' CHECK (track IN ('academics', 'leadership', 'impact')),
    title VARCHAR(500) NOT NULL,
    task_type VARCHAR(20) CHECK (task_type IN ('ec', 'test', 'essay', 'recommendation', 'academic', 'other')),
    due_date DATE,
    due_date_source VARCHAR(12) CHECK (due_date_source IN ('generated', 'backfilled', 'user')),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_step_id, source_id),
    UNIQUE (roadmap_step_id, position),
    CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL)),
    CHECK ((due_date IS NULL) = (due_date_source IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_step_track
    ON roadmap_tasks (roadmap_step_id, track);
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_open_due
    ON roadmap_tasks (due_date) WHERE NOT completed;
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_completed_at
    ON roadmap_tasks (completed_at) WHERE completed;

CREATE TABLE IF NOT EXISTS roadmap_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_step_id UUID NOT NULL REFERENCES roadmap_steps(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position > 0),
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_step_id, position)
);

CREATE TABLE IF NOT EXISTS roadmap_micro_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_task_id UUID NOT NULL REFERENCES roadmap_tasks(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position > 0),
    title VARCHAR(500) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (roadmap_task_id, position) DEFERRABLE INITIALLY DEFERRED,
    CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);

-- Журнал событий: только INSERT, UPDATE/DELETE в коде не использовать
CREATE TABLE IF NOT EXISTS roadmap_task_events (
    id BIGSERIAL PRIMARY KEY,
    roadmap_task_id UUID NOT NULL REFERENCES roadmap_tasks(id) ON DELETE CASCADE,
    roadmap_plan_id UUID NOT NULL REFERENCES roadmap_plans(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'completed', 'uncompleted', 'postponed',
        'micro_step_completed', 'micro_step_uncompleted'
    )),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roadmap_task_events_plan_created
    ON roadmap_task_events (roadmap_plan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_roadmap_task_events_task_created
    ON roadmap_task_events (roadmap_task_id, created_at);

-- KANBAN
CREATE TABLE IF NOT EXISTS kanban_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_roadmap_task_id UUID REFERENCES roadmap_tasks(id) ON DELETE SET NULL,
    track VARCHAR(20) NOT NULL DEFAULT 'academics' CHECK (track IN ('academics', 'leadership', 'impact')),
    title VARCHAR(500) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    artifact_type VARCHAR(20) CHECK (artifact_type IS NULL OR artifact_type IN ('link', 'explanation')),
    artifact_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, source_roadmap_task_id),
    CHECK (
        (artifact_type IS NULL AND artifact_value IS NULL)
        OR (artifact_type IS NOT NULL AND artifact_value IS NOT NULL AND btrim(artifact_value) <> '')
    )
);

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_created
    ON kanban_tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_track
    ON kanban_tasks (user_id, track);

CREATE TABLE IF NOT EXISTS kanban_micro_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kanban_task_id UUID NOT NULL REFERENCES kanban_tasks(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position > 0),
    title VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kanban_task_id, position) DEFERRABLE INITIALLY DEFERRED,
    CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_kanban_micro_steps_task_position
    ON kanban_micro_steps (kanban_task_id, position);

-- TRIGGERS
DROP TRIGGER IF EXISTS update_roadmap_plans_updated_at ON roadmap_plans;
CREATE TRIGGER update_roadmap_plans_updated_at
    BEFORE UPDATE ON roadmap_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roadmap_tasks_updated_at ON roadmap_tasks;
CREATE TRIGGER update_roadmap_tasks_updated_at
    BEFORE UPDATE ON roadmap_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roadmap_micro_steps_updated_at ON roadmap_micro_steps;
CREATE TRIGGER update_roadmap_micro_steps_updated_at
    BEFORE UPDATE ON roadmap_micro_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kanban_tasks_updated_at ON kanban_tasks;
CREATE TRIGGER update_kanban_tasks_updated_at
    BEFORE UPDATE ON kanban_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kanban_micro_steps_updated_at ON kanban_micro_steps;
CREATE TRIGGER update_kanban_micro_steps_updated_at
    BEFORE UPDATE ON kanban_micro_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();