DROP INDEX IF EXISTS idx_roadmap_tasks_completed_at;
DROP INDEX IF EXISTS idx_roadmap_tasks_open_due;

ALTER TABLE roadmap_tasks
    DROP CONSTRAINT IF EXISTS roadmap_tasks_due_date_has_source,
    DROP CONSTRAINT IF EXISTS roadmap_tasks_started_before_completed;

ALTER TABLE roadmap_tasks
    DROP COLUMN IF EXISTS actual_minutes,
    DROP COLUMN IF EXISTS started_at,
    DROP COLUMN IF EXISTS due_date_source,
    DROP COLUMN IF EXISTS due_date,
    DROP COLUMN IF EXISTS estimated_minutes,
    DROP COLUMN IF EXISTS task_type;
