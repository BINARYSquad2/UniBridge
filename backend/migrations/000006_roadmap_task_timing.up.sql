ALTER TABLE roadmap_tasks
    ADD COLUMN IF NOT EXISTS task_type VARCHAR(20)
        CHECK (task_type IN ('ec', 'test', 'essay', 'recommendation', 'academic', 'other')),
    ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER
        CHECK (estimated_minutes > 0),
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS due_date_source VARCHAR(12)
        CHECK (due_date_source IN ('generated', 'backfilled', 'user')),
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS actual_minutes INTEGER
        CHECK (actual_minutes >= 0);

ALTER TABLE roadmap_tasks
    DROP CONSTRAINT IF EXISTS roadmap_tasks_started_before_completed,
    DROP CONSTRAINT IF EXISTS roadmap_tasks_due_date_has_source;

ALTER TABLE roadmap_tasks
    ADD CONSTRAINT roadmap_tasks_started_before_completed
        CHECK (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at),
    ADD CONSTRAINT roadmap_tasks_due_date_has_source
        CHECK ((due_date IS NULL) = (due_date_source IS NULL));

-- Частичные индексы: просроченные невыполненные и выполненные по дате
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_open_due
    ON roadmap_tasks (due_date) WHERE NOT completed;
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_completed_at
    ON roadmap_tasks (completed_at) WHERE completed;
