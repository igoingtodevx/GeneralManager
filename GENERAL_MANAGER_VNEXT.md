# General Manager vNext

## Product thesis
General Manager is not a Kanban board with an AI sidebar. It is a personal operating surface for capturing, resuming and steering work across AI agents, repositories, research, URLs, notes and unfinished threads.

The product must remain fully useful without AI. AI is an optional acceleration layer, never a dependency for basic task and context management.

## Core job
The product should answer three questions with almost no friction:
1. What am I doing right now?
2. What should I resume next, and why?
3. What context do I need so I do not have to reconstruct the task from memory?

## Primitive-first interaction model
### Capture
The global capture field should accept a thought, URL, repo, task or context fragment without forcing the user to decide the final workflow state first.

Quick Capture must not silently mean "put this in the first column". The current implementation does exactly that. vNext should instead use an explicit capture destination with a remembered default and keyboard-first override.

Recommended default states:
- INBOX — unprocessed capture
- NOW — the small set of things actively being worked on
- NEXT — ready to resume soon
- WAITING — blocked by another person, system or future event
- LATER — deliberately parked
- DONE — completed, with archive as long-term history

These names are defaults, not hard requirements. Columns remain editable.

### Resume
A card is valuable when it lets the user resume work quickly. The detail surface should therefore prioritize:
- the next concrete action;
- current state / blocker;
- links and repo references;
- compact working notes;
- checklist only when useful;
- last meaningful update;
- optional AI-generated resume brief.

### Focus
The primary screen should make NOW and NEXT visually dominant. Everything else is supporting context. The product should resist becoming a database-shaped dumping ground.

## AI model
AI is opt-in at both product and action level.

Manual mode:
- all capture, organization, editing, search, filtering, movement and export work without any model or API key;
- no board content is sent to a model.

AI mode:
- individual actions clearly state what context will be sent;
- the user can choose provider/model;
- board-wide AI is never required to use the product.

High-value AI actions are workflow actions, not chat-for-chat's-sake:
- Turn a messy capture into title + next action + useful notes.
- Create a short resume brief for a stale card.
- Detect likely duplicates / related cards.
- Suggest a destination (NOW/NEXT/WAITING/LATER) without moving anything silently.
- Summarize what changed since the card was last active.
- Convert a long note into a compact handoff for another agent.

The existing board-summary / standup actions can remain, but they are secondary.

## Interaction principles
- One obvious primary action per surface.
- Keyboard first, mouse friendly.
- No mandatory modal for quick work.
- Do not ask for metadata before it becomes useful.
- Preserve user control: suggestions are previews until accepted.
- Prefer a few strong states over many clever statuses.
- Avoid AI-specific decoration when a normal UI control is clearer.
- Every automation must have a visible manual equivalent.

## First implementation run
1. Fix Quick Capture so destination is explicit and remembered instead of always using `board.columns[0]`.
2. Add INBOX-aware defaults for new boards while preserving existing user boards and custom columns.
3. Replace prompt-based per-column add with inline entry.
4. Make card editing faster: autosave or save-on-close, fewer modal fields competing for attention.
5. Add a compact `Next action` field and show it directly on cards when present.
6. Make AI controls explicitly optional and explain privacy at the point of use.
7. Add keyboard shortcuts for capture destination and opening the command surface.

## Second implementation run
1. Add a command palette / universal action surface instead of accumulating toolbar buttons.
2. Add Focus view: NOW + NEXT + WAITING, without destroying the board view.
3. Add stale/resume signals based on local data, no AI required.
4. Add optional AI `Refine capture`, `Resume`, `Route` and `Handoff` actions.
5. Improve responsive behavior so the manager works on narrower screens.

## Quality bar
The finished product should feel faster than opening a notes app, clearer than a generic Kanban board, and more trustworthy than an AI-first task manager. The "wow" should come from how little context the user has to reconstruct, not from animated AI output.