CREATE TABLE IF NOT EXISTS mentorship_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (student_id <> mentor_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS mentorship_open_pair
ON mentorship_requests(student_id, mentor_id)
WHERE status IN ('pending', 'accepted');

CREATE UNIQUE INDEX IF NOT EXISTS mentorship_one_active_mentor
ON mentorship_requests(student_id)
WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS mentorship_mentor_inbox
ON mentorship_requests(mentor_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_mentorship_updated_at'
          AND tgrelid = 'mentorship_requests'::regclass
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER update_mentorship_updated_at
            BEFORE UPDATE ON mentorship_requests
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END
$$;