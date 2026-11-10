ALTER TABLE roadmap_task_events
    DROP CONSTRAINT IF EXISTS roadmap_task_events_event_type_check,
    ADD CONSTRAINT roadmap_task_events_event_type_check
        CHECK (event_type IN (
            'started', 'completed', 'uncompleted', 'postponed',
            'micro_step_started', 'micro_step_completed', 'micro_step_uncompleted'
        ));

ALTER TABLE roadmap_plans
    ADD COLUMN weekly_hours SMALLINT NOT NULL DEFAULT 1
        CHECK (weekly_hours BETWEEN 1 AND 40);
ALTER TABLE roadmap_plans
    ALTER COLUMN weekly_hours DROP DEFAULT;

ALTER TABLE roadmap_tasks
    ADD COLUMN duration VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN estimated_minutes INTEGER CHECK (estimated_minutes > 0),
    ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN actual_minutes INTEGER CHECK (actual_minutes >= 0);
ALTER TABLE roadmap_tasks
    ALTER COLUMN duration DROP DEFAULT;

ALTER TABLE roadmap_tasks
    ADD CONSTRAINT roadmap_tasks_started_before_completed
        CHECK (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at);

ALTER TABLE roadmap_micro_steps
    ADD COLUMN estimated_minutes INTEGER CHECK (estimated_minutes > 0),
    ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN actual_minutes INTEGER CHECK (actual_minutes >= 0);

ALTER TABLE roadmap_micro_steps
    ADD CONSTRAINT roadmap_micro_steps_started_before_completed
        CHECK (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at);

ALTER TABLE kanban_tasks
    ADD COLUMN duration VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE kanban_tasks
    ALTER COLUMN duration DROP DEFAULT;
