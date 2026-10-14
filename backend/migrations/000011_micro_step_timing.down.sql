ALTER TABLE roadmap_task_events
    DROP CONSTRAINT IF EXISTS roadmap_task_events_event_type_check,
    ADD CONSTRAINT roadmap_task_events_event_type_check
        CHECK (event_type IN (
            'started', 'completed', 'uncompleted', 'postponed',
            'micro_step_completed', 'micro_step_uncompleted'
        ));

ALTER TABLE roadmap_micro_steps
    DROP CONSTRAINT IF EXISTS roadmap_micro_steps_started_before_completed,
    DROP COLUMN IF EXISTS actual_minutes,
    DROP COLUMN IF EXISTS started_at;