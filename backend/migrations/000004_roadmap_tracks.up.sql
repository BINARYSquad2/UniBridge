ALTER TABLE roadmap_steps
    ADD COLUMN IF NOT EXISTS track VARCHAR(20) NOT NULL DEFAULT 'academics'
        CHECK (track IN ('academics', 'leadership', 'impact'));

ALTER TABLE roadmap_tasks
    ADD COLUMN IF NOT EXISTS track VARCHAR(20) NOT NULL DEFAULT 'academics'
        CHECK (track IN ('academics', 'leadership', 'impact'));

ALTER TABLE kanban_tasks
    ADD COLUMN IF NOT EXISTS track VARCHAR(20) NOT NULL DEFAULT 'academics'
        CHECK (track IN ('academics', 'leadership', 'impact'));

CREATE INDEX IF NOT EXISTS idx_roadmap_steps_plan_track
    ON roadmap_steps (roadmap_plan_id, track);

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_step_track
    ON roadmap_tasks (roadmap_step_id, track);

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_track
    ON kanban_tasks (user_id, track);
