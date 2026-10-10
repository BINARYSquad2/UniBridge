CREATE TABLE mentorship_requests (
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

CREATE UNIQUE INDEX mentorship_open_pair
ON mentorship_requests(student_id, mentor_id)
WHERE status IN ('pending', 'accepted');

CREATE UNIQUE INDEX mentorship_one_active_mentor
ON mentorship_requests(student_id)
WHERE status = 'accepted';

CREATE INDEX mentorship_mentor_inbox
ON mentorship_requests(mentor_id, created_at DESC);

CREATE TRIGGER update_mentorship_updated_at
BEFORE UPDATE ON mentorship_requests
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();