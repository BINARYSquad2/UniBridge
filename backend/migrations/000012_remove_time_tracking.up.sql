-- Remove historical timer events and elapsed-time payloads.
DELETE FROM roadmap_task_events
WHERE event_type IN ('started', 'micro_step_started');

UPDATE roadmap_task_events
SET payload = payload - 'actual_minutes'
WHERE payload ? 'actual_minutes';

ALTER TABLE roadmap_task_events
    DROP CONSTRAINT IF EXISTS roadmap_task_events_event_type_check,
    ADD CONSTRAINT roadmap_task_events_event_type_check
        CHECK (event_type IN (
            'completed', 'uncompleted', 'postponed',
            'micro_step_completed', 'micro_step_uncompleted'
        ));

UPDATE kanban_tasks
SET micro_steps = COALESCE((
    SELECT jsonb_agg(element - 'estimated_minutes' - 'actual_minutes' - 'started_at')
    FROM jsonb_array_elements(micro_steps) AS items(element)
), '[]'::jsonb);

ALTER TABLE roadmap_tasks
    DROP CONSTRAINT IF EXISTS roadmap_tasks_started_before_completed;

ALTER TABLE roadmap_micro_steps
    DROP CONSTRAINT IF EXISTS roadmap_micro_steps_started_before_completed;

ALTER TABLE roadmap_plans
    DROP COLUMN IF EXISTS weekly_hours;

ALTER TABLE roadmap_tasks
    DROP COLUMN IF EXISTS duration,
    DROP COLUMN IF EXISTS estimated_minutes,
    DROP COLUMN IF EXISTS started_at,
    DROP COLUMN IF EXISTS actual_minutes;

ALTER TABLE roadmap_micro_steps
    DROP COLUMN IF EXISTS estimated_minutes,
    DROP COLUMN IF EXISTS started_at,
    DROP COLUMN IF EXISTS actual_minutes;

ALTER TABLE kanban_tasks
    DROP COLUMN IF EXISTS duration;
