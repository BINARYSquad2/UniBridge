DROP TRIGGER update_student_profiles_updated_at ON student_profiles;
DROP TRIGGER update_users_updated_at ON users;

DROP TABLE mentor_profiles;
DROP TABLE student_profiles;
DROP TABLE users;

DROP FUNCTION update_updated_at_column();
DROP TYPE portfolio_stage;
DROP TYPE user_role;