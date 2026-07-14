@AGENTS.md

# CourtSide — Claude Code Project Guide

## What this is
A web app for tennis coaches to schedule classes and manage sessions.
Pages: Home (dashboard), Calendar, Locations, Students.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (dark mode enabled)
- Supabase (Postgres, Auth, RLS)
- Calendar: react-big-calendar
- Deployed on Vercel

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test (e2e): `npx playwright test`

## Folder layout
- `src/app/` — routes (home, calendar, locations, students)
- `src/components/` — shared UI
- `src/lib/` — supabase client, queries, types, helpers
- `.claude/skills/` — project skills

## Conventions
- TypeScript strict; explicit return types on exported functions.
- Styling ONLY via Tailwind + shadcn; no inline hex colors — use theme tokens.
- Every page must handle loading, empty, and error states.
- Every screen must work in light AND dark, and on mobile.
- Server-side data access goes through `lib/queries/*`.

## Design
- The `design-system` skill is the SINGLE SOURCE OF TRUTH for all visual tokens
  (colors, typography, spacing, radius, dark mode). Follow it for ALL UI.
- If the `ui-ux-pro-max` skill is installed, it is ADVISORY ONLY — use it for
  motion, micro-interactions, UX best-practices, accessibility, and component
  patterns. It must NEVER override our locked palette, fonts, spacing, or the
  dark-mode requirement. On any conflict, the `design-system` skill wins.

## Guardrails (never do)
- Never commit secrets or `.env` files.
- Never change styling when the task is a data/logic task, and vice versa.
- Never bypass Row Level Security.
- Ask before destructive DB migrations.

## Workflow
- Build ONE page/feature at a time; commit after each.
- For UI work, follow the Two-pass screenshot workflow below (it is automatic —
  don't wait to be asked).

## Two-pass screenshot workflow
Whenever you make a visual change, add or modify a component, or are asked to
evaluate how something looks, screenshot the rendered output **twice** using the
Playwright MCP.

**Pass 1 — Baseline.** Render the current state. Capture at desktop (1440×900)
and mobile (390×844). Write 3–5 specific observations: what works, what breaks,
what feels off. This pass is diagnostic — do not skip to fixing.

**Pass 2 — Verification.** Apply the change. Re-screenshot at the same viewports
as Pass 1. Compare directly. Did the fix land? Any regressions? If a reference
design exists (e.g. `/design/reference-dashboard.png`), also compare Pass 2
against it and list remaining differences. If Pass 2 doesn't resolve what Pass 1
revealed, iterate — don't ship.

**When this is required:** after creating or modifying any component, after the
user says "this doesn't look right," before declaring any UI task complete, and
any time you're evaluating your own visual work. (Skip it for pure data/logic
changes with no visual surface — screenshots cost tokens.)

### Screenshot storage (mandatory)
All screenshots go in `.screenshots/` at the project root. This folder is
**disposable and user-owned**.
- Add `.screenshots/` to `.gitignore` on first use.
- One subfolder per task: `.screenshots/<task-slug>/`
- Filename format: `pass-<1|2>-<viewport>-<timestamp>.png`
- Example: `.screenshots/hero-redesign/pass-2-mobile-2026-04-24T14-31.png`
- Never overwrite — timestamps preserve iteration history.
- **Never auto-delete this folder.** The user clears it with `rm -rf .screenshots/`.
- Create the folder if it doesn't exist before the first shot of a session.
- If the Playwright MCP writes a screenshot elsewhere, move it into the correct
  `.screenshots/<task-slug>/` path. Never leave screenshots in `src/`, `public/`,
  or the project root.
