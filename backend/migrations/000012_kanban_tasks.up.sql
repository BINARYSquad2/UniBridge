CREATE TABLE IF NOT EXISTS kanban_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_roadmap_task_id UUID REFERENCES roadmap_tasks(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    duration VARCHAR(120) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done')),
    micro_steps JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(micro_steps) = 'array'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, source_roadmap_task_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_created
    ON kanban_tasks (user_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_kanban_tasks_updated_at'
          AND tgrelid = 'kanban_tasks'::regclass
    ) THEN
        CREATE TRIGGER update_kanban_tasks_updated_at
            BEFORE UPDATE ON kanban_tasks
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END;
$$;