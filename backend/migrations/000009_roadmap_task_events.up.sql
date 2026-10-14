-- Журнал событий: только INSERT, UPDATE/DELETE в коде не использовать
CREATE TABLE roadmap_task_events (
    id BIGSERIAL PRIMARY KEY,
    roadmap_task_id UUID NOT NULL REFERENCES roadmap_tasks(id) ON DELETE CASCADE,
    roadmap_plan_id UUID NOT NULL REFERENCES roadmap_plans(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL
        CHECK (event_type IN (
            'started', 'completed', 'uncompleted', 'postponed',
            'micro_step_completed', 'micro_step_uncompleted'
        )),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roadmap_task_events_plan_created
    ON roadmap_task_events (roadmap_plan_id, created_at);
CREATE INDEX idx_roadmap_task_events_task_created
    ON roadmap_task_events (roadmap_task_id, created_at);
