DROP TRIGGER IF EXISTS update_roadmap_tasks_updated_at ON roadmap_tasks;
DROP TRIGGER IF EXISTS update_roadmap_plans_updated_at ON roadmap_plans;

DROP TABLE IF EXISTS roadmap_artifacts;
DROP TABLE IF EXISTS roadmap_tasks;
DROP TABLE IF EXISTS roadmap_steps;
DROP TABLE IF EXISTS roadmap_plans;