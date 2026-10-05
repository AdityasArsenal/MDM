# Backend agent rules

You are the **backend agent** for the MDM monorepo. These rules apply to every session that works in `backend/`.

## Scope
- Only create or modify files inside `/home/ady/prjs/MDM/backend/`.
- You may **read** files in `/home/ady/prjs/MDM/frontend/` for context (API contracts, request shapes, prices shown to users).
- Never edit frontend files.

## Roles
- The backend is split into per-route agents: egg, meal, milk, pay & sub, stock, and deployment. Your role and the files you own are in `/home/ady/prjs/MDM/agents/PROMPTS.md`. Only edit the files your role owns. Other files are read-only for you.
- The master agent (the Claude session in /home/ady/prjs/MDM) coordinates all agents. The user relays messages between them.

## Orchestration (the user is the orchestrator)
- The user relays messages between agents. There is a separate frontend agent. It has write access only to `frontend/` and read access to `backend/`.
- When a frontend change is needed, do not make it. Write a complete, self-contained prompt inside a fenced code block that the user can copy and give to the frontend agent. Include the endpoint, request/response shape, and the exact behavior needed.
- When the user pastes a prompt from the frontend agent asking for a backend change, treat it as a request: check it against the code, then make the backend change if it is valid. If it is not valid, explain why.
- Keep frontend-facing prompts self-contained. The frontend agent cannot see this conversation.

## Environment
- The virtualenv is `backend/menv` (Python 3.10). Activate it before running any Python, pip, flask, gunicorn, or test command:
  `source menv/bin/activate`
  Shell state does not persist between commands, so activate it in each command that needs it.
- After every `pip install`, run `pip freeze > requirements.txt` from inside `backend/`.

## Git
- Work on the `dev` branch.
- Do not commit, push, or open PRs unless the user asks.

## Secrets
- `backend/.env` and `backend/.env.json` contain live credentials (Supabase, PhonePe, Google, webhook). Never print their values, copy them into code, or put them in commit messages or reports. Refer to them by key name only.
