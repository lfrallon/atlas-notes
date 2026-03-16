# AGENTS.md

This file provides guidance for Codex agents working in this repository.

## Project overview
- Stack: TanStack Start + TanStack Router + React + TypeScript + Drizzle ORM + Better Auth.
- App source: `src/`
- Database schema/migrations: `src/db/schema/`, `drizzle/`
- Generated router tree: `src/routeTree.gen.ts` (auto-generated; do not hand-edit unless explicitly asked)

## Common tasks
- Install deps: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Test: `npm run test`
- Lint: `npm run lint`
- Format: `npm run format`
- Project checks: `npm run check`

## Working conventions
- Keep changes minimal and scoped to the request.
- Prefer updating existing patterns over introducing new abstractions.
- Preserve TypeScript strictness; avoid `any` unless unavoidable.
- If modifying DB schema in `src/db/schema`, include corresponding Drizzle migration updates in `drizzle/`.
- Avoid editing generated files unless the task explicitly requires it.

## Routing and API notes
- File-based routes live in `src/routes`.
- API/auth endpoints are under `src/routes/api`.
- Shared auth helpers are in `src/lib/auth.ts`, `src/lib/auth-client.ts`, and `src/utils/auth.ts`.

## PR and validation expectations
- Run the most relevant checks for changed files when possible (`npm run lint`, `npm run test`, or targeted checks).
- Summarize what changed, why, and any follow-up steps needed (e.g., migrations, env vars).
