DROP INDEX IF EXISTS idx_kanban_tasks_user_track;
DROP INDEX IF EXISTS idx_roadmap_tasks_step_track;
DROP INDEX IF EXISTS idx_roadmap_steps_plan_track;

ALTER TABLE kanban_tasks DROP COLUMN IF EXISTS track;
ALTER TABLE roadmap_tasks DROP COLUMN IF EXISTS track;
ALTER TABLE roadmap_steps DROP COLUMN IF EXISTS track;
