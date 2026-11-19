# CLAUDE.md — Claude Code Instructions for Lixyte (Broken Design)

Before writing code, editing files, or running commands in this repository, you **MUST** read and strictly follow **[AGENT.md](./AGENT.md)**.

Project: **Lixyte**, a 3D asset repository and WebGL CDN (`frontend/` Next.js 15, `services/core-api/` Express 5, `services/cdn-service/` Express 5, `supabase/schema.sql`).

## Read first (Single Source of Truth)
| File | Role |
| :--- | :--- |
| [AGENT.md](./AGENT.md) | **Always first:** Security Invariants (§3), API/DB Contract (§4–§5), Roadmap & Test Checklist (§6–§7) |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | **Before any UI work:** colors, fonts, spacing, buttons, cards, icons, patterns |
| [docs/TASKS.md](./docs/TASKS.md) | Current status per page and endpoint, who owns what |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Component inventory, end-to-end flows, deployment, **Known Issues (§5)** |
| [docs/PRD.md](./docs/PRD.md) | Product requirements, goals, scope, and content rules |
| [README.md](./README.md) | Team split (§7), folder structure (§5), setup & Docker guide (§8) |

If code and documentation disagree, point it out and update the authoritative document in the same change.

## Working with the user & Code rules
- The user writes Thai. **Reply in Thai**, keep code, identifiers, file names and commit messages in English.
- Be concise; lead with the result. State only observed command outputs and file contents.
- New features: brainstorm first (short design, get confirmation) before writing code. Commit or push **only when asked** and never commit secrets (`.env` / `.env.local`).
- **Verification & Security:** Follow the mandatory commands (`npx.cmd` / `npm.cmd` on Windows PowerShell) and backend security invariants in [AGENT.md](./AGENT.md) (§3 & §7.2), and check [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (§5) before modifying auth, CDN, payments, or Docker env.
- **UI & Three.js rules:** Dark-first HUD styling (`lucide-react` icons only, `three` for 3D scenes). Mark WebGL/Three.js code `'use client'` with `dynamic(..., { ssr: false })`, clean up renderers/geometries/materials/listeners/RAFs on unmount, and respect `prefers-reduced-motion`. Never run `npm run build` while `npm run dev` is active (shared `.next`); use `npx tsc --noEmit` instead.
- Preview server config for Claude Code lives in `.claude/launch.json`; if port `3000` is already running, reuse it instead of killing user processes.
- `/forgot-password` is UI-only and `/docs` is a planned placeholder link in the Navbar — do not alter Navbar links unless requested.
