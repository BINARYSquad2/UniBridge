CREATE TABLE IF NOT EXISTS roadmap_micro_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_task_id UUID NOT NULL REFERENCES roadmap_tasks(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL CHECK (position > 0),
    title VARCHAR(500) NOT NULL,
    estimated_minutes INTEGER CHECK (estimated_minutes > 0),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- DEFERRABLE: позволяет менять порядок/сдвигать позиции внутри одной транзакции
    UNIQUE (roadmap_task_id, position) DEFERRABLE INITIALLY DEFERRED,
    CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_roadmap_micro_steps_updated_at'
          AND tgrelid = 'roadmap_micro_steps'::regclass
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER update_roadmap_micro_steps_updated_at
            BEFORE UPDATE ON roadmap_micro_steps
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END
$$;
