ALTER TABLE roadmap_micro_steps
    ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN actual_minutes INTEGER CHECK (actual_minutes >= 0),
    ADD CONSTRAINT roadmap_micro_steps_started_before_completed
        CHECK (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at);

ALTER TABLE roadmap_task_events
    DROP CONSTRAINT roadmap_task_events_event_type_check,
    ADD CONSTRAINT roadmap_task_events_event_type_check
        CHECK (event_type IN (
            'started', 'completed', 'uncompleted', 'postponed',
            'micro_step_started', 'micro_step_completed', 'micro_step_uncompleted'
        ));