ALTER TABLE kanban_tasks
    DROP CONSTRAINT IF EXISTS kanban_tasks_artifact_pair_check,
    DROP CONSTRAINT IF EXISTS kanban_tasks_artifact_type_check,
    DROP COLUMN IF EXISTS artifact_type,
    DROP COLUMN IF EXISTS artifact_value;
