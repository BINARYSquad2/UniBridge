ALTER TABLE roadmap_micro_steps
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS actual_minutes INTEGER CHECK (actual_minutes >= 0);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'roadmap_micro_steps_started_before_completed'
          AND conrelid = 'roadmap_micro_steps'::regclass
    ) THEN
        ALTER TABLE roadmap_micro_steps
            ADD CONSTRAINT roadmap_micro_steps_started_before_completed
                CHECK (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at);
    END IF;
END;
$$;

ALTER TABLE roadmap_task_events
    DROP CONSTRAINT IF EXISTS roadmap_task_events_event_type_check,
    ADD CONSTRAINT roadmap_task_events_event_type_check
        CHECK (event_type IN (
            'started', 'completed', 'uncompleted', 'postponed',
            'micro_step_started', 'micro_step_completed', 'micro_step_uncompleted'
        ));