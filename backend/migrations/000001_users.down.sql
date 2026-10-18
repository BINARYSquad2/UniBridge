DROP TRIGGER IF EXISTS update_student_profiles_updated_at ON student_profiles;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

DROP TABLE IF EXISTS mentor_profiles;
DROP TABLE IF EXISTS student_profiles;
DROP TABLE IF EXISTS users;

DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TYPE IF EXISTS portfolio_stage;
DROP TYPE IF EXISTS user_role;