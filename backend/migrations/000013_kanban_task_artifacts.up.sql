ALTER TABLE kanban_tasks
    ADD COLUMN artifact_type VARCHAR(20),
    ADD COLUMN artifact_value TEXT,
    ADD CONSTRAINT kanban_tasks_artifact_type_check
        CHECK (artifact_type IS NULL OR artifact_type IN ('link', 'explanation')),
    ADD CONSTRAINT kanban_tasks_artifact_pair_check
        CHECK (
            (artifact_type IS NULL AND artifact_value IS NULL)
            OR (
                artifact_type IS NOT NULL
                AND artifact_value IS NOT NULL
                AND btrim(artifact_value) <> ''
            )
        );
