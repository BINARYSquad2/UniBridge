# UniBridge Backend

This is a minimal Go backend for the UniBridge project.

## Structure

- `cmd/server` — application entry point
- `internal/config` — environment-based configuration
- `internal/handlers` — HTTP handlers
- `internal/server` — server setup and routing

## Run locally

Create `backend/.env` and set the PostgreSQL connection string:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE?sslmode=disable
AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters-long
LLM_API_KEY=your-openai-compatible-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini,gpt-4o
```

On startup, the server connects to PostgreSQL and applies unapplied SQL files
from `backend/migrations`. Migration files are embedded in the Go binary.

```bash
cd backend
go run ./cmd/server
```

The server will listen on `http://0.0.0.0:8080` by default.

## Health checks

- `GET /healthz`
- `GET /api/v1/status`

## Authentication

- `POST /api/v1/auth/register` accepts `full_name`, `email`, `password`, and
	optional `role` (`student` or `mentor`). Students must also send
	`school_grade` from 7 to 11, `interests`, `strengths`, `weaknesses`, and
	`portfolio_stage` (`starting`, `in_progress`, `achieving`, or `completed`);
	mentors do not need these profile fields.
- `POST /api/v1/auth/login` accepts `email` and `password`.
- Successful registration and login return the user and a 24-hour JWT in
	`access_token`. The user object includes `school_grade` for students. Use a
	random `AUTH_SECRET` of at least 32 characters.

## Roadmap generation

- `POST /api/v1/roadmap/generate` requires `Authorization: Bearer <access_token>`.
- The endpoint reads the authenticated student's interests, strengths,
	weaknesses, portfolio stage, and school grade, then returns a JSON plan from
	the current grade through grade 11.
- Configure `LLM_API_KEY`, and optionally `LLM_BASE_URL` and `LLM_MODEL`, for an
	OpenAI-compatible Chat Completions API. `LLM_MODEL` is a comma-separated
	ordered list; the handler tries the next model when a request or generated
	plan fails validation (up to four distinct models).
