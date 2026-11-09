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
GEMINI_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-2.5-flash,gemini-2.5-pro
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
- `GET /api/v1/profile/me` returns the authenticated user; `student_profile` is
	included only for users with the `student` role.
- Successful registration and login return the user and a 24-hour JWT in
	`access_token`. The user object includes `school_grade` for students. Use a
	random `AUTH_SECRET` of at least 32 characters.

## Roadmap generation

- `POST /api/v1/roadmap/generate` requires `Authorization: Bearer <access_token>`.
- `GET /api/v1/roadmap/current` returns the authenticated student's active saved plan.
- `PATCH /api/v1/roadmap/tasks/{taskID}` accepts `{"completed": true|false}` and saves task progress.
- The endpoint reads the authenticated student's interests, strengths,
	weaknesses, portfolio stage, and school grade, then returns a JSON plan from
	the current grade through grade 11. Generated versions, steps, tasks, and
	artifacts are saved transactionally in `roadmap_plans` and its child tables.
- Configure `GEMINI_API_KEY` and optionally `LLM_MODEL` for Gemini. The official
	Go SDK selects the API endpoint; no base URL setting is required. `LLM_MODEL` is a comma-separated
	ordered list; the handler tries the next model when a request or generated
	plan fails validation (up to four distinct models).
- `POST /api/v1/roadmap/tasks/{taskID}/micro-steps` accepts `title` and adds a micro-step.
- `PATCH /api/v1/roadmap/micro-steps/{microStepID}` accepts `completed`.
- `GET /api/v1/roadmap/metrics` returns task and micro-step progress,
	type breakdowns, overdue counts, and daily completion activity.
- Migrations `000006`–`000009` historically added task timing, event history,
	micro-steps, and micro-step timing fields.
- Migration `000013` removes task duration estimates, timers, elapsed-time fields,
	weekly workload estimates, and time-based analytics. Removed timing data
	cannot be restored by rolling this migration back.
