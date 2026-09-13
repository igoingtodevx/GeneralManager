# General Manager vNext

## Thesis
General Manager is not a Kanban board with an AI sidebar. It is a personal operating surface for capturing, resuming, and steering unfinished work across AI agents, repositories, research, URLs, notes, and ideas.

The product wins when returning to a half-finished thread takes seconds instead of reconstruction.

## Primitive-first rules
1. Fix workflow friction before adding agent complexity.
2. Manual mode must remain complete and trustworthy.
3. AI is an explicit accelerator, never a hidden dependency.
4. Prefer one obvious action over a dashboard of controls.
5. Preserve user control: suggestions preview before state changes.
6. Preserve existing custom workflows unless migration is explicitly accepted.
7. Optimize for resume speed, not feature count.

## Default workflow
Fresh workspaces use:
- `INBOX` — captured but not processed.
- `NOW` — actively being worked on.
- `NEXT` — ready to pick up soon.
- `WAITING` — blocked by a person, system, answer, deployment, or future event.
- `LATER` — intentionally parked.
- `DONE` — completed before archive.

An exact legacy `BACKLOG / ACTIVE / PARKED / DONE` board receives an explicit upgrade action. Custom boards are normalized but not renamed.

## The resume contract
A useful card should make these answerable without reopening the original chat:
1. What is this?
2. Where does it stand?
3. What is the next concrete move?
4. What am I waiting on or worried about?
5. Which link/repo/tool gets me back into the work?
6. What compact context would future-me otherwise have to reconstruct?

This is why `Next action`, blocker/waiting context, links, working notes, and last meaningful update are first-class fields.

## Primary surfaces
### Focus
The daily surface. It reduces the workspace to NOW / NEXT / WAITING when those states exist. The goal is attention, not complete information density.

### Board
The full configurable workflow. It supports drag/drop, inline capture, editable columns, and the complete state space.

### Inspector
The resume/edit surface. It autosaves and keeps `Next action` prominent. A card should be editable without entering a save/cancel ceremony.

### Command palette
`Ctrl/Cmd + K` is the universal jump/action surface. It searches cards and exposes a small set of high-value commands rather than becoming a second settings menu.

## Capture
Quick Capture must never silently decide an important state transition.
- Destination is explicit.
- Last destination is remembered.
- URLs are detected automatically.
- Enter captures immediately.
- Per-column inline capture exists when location is already obvious.

## Handoffs
A deterministic local handoff is always available without AI. It contains the card's state, type, priority, next action, blocker, link, tool/model, notes, and checklist.

This is intentionally useful with Hermes, ChatGPT, Claude, Codex, or any future agent without coupling General Manager to one provider.

## AI boundary
AI is optional and invoked only by explicit actions.

High-value card actions:
- **Refine** — propose cleaner structure for a messy card.
- **Resume brief** — summarize where it stands, next move, and risks.
- **Route** — suggest a destination and reason.
- **AI handoff** — package the card for another capable agent.

Rules:
- Card actions send only the active card context.
- Refine and Route remain previews until accepted.
- AI failure must never block normal work.
- Manual capture, search, movement, archive, backup, and local handoff remain complete.

## Quality bar
General Manager should feel:
- faster than opening a notes app,
- clearer than generic Kanban,
- more controlled than an AI-first task manager,
- dense enough for a power user without becoming visually noisy.

The wow effect should come from **less reconstruction**, not animated AI.

## Desktop direction
Do not wrap the web app merely to call it desktop software. First prove the workflow.

When the browser version is stable enough to use daily, the desktop build should earn its existence through OS-level capabilities such as:
- global capture hotkey,
- native deep links / protocol handling,
- secure credential storage,
- optional local-first persistence / offline mode,
- clipboard/file/repo context capture,
- tray/quick-capture surface.

Tauri or another small native shell can be evaluated then. The browser product model should not depend on that choice.

## Implemented first run
- v2 domain model in `core.js`.
- Focus + Board surfaces.
- explicit destination capture.
- side inspector + autosave.
- next action, blocker, stale cues, checklist, local handoff.
- command palette and keyboard workflow.
- explicit card-level AI actions.
- responsive shell.
- JSON import/export and archive preserved.
- Firebase auth/Firestore persistence preserved through an explicit compatibility boundary.
- Node-native core tests + headless-Chrome runtime smoke in CI.

## Still requires human use before merge
Automated tests can prove boot, domain behavior, persistence boundaries, and key controller wiring. They cannot decide whether the Focus density, capture destination UX, inspector rhythm, or keyboard flow actually feels good during a real workday.

That final product judgment should happen on the preview before production merge.
