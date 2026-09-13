# General Manager

General Manager is an experiment in building **one calm control surface above work, life, apps, agents and unfinished commitments**.

The product thesis is simple:

> Everything can come in. Very little gets to interrupt you.

It is deliberately not another Kanban board, not an AI chat wrapped around a todo list, and not a system that only works while perfectly maintained.

## Core model

Everything enters as an item, but the user does not live in a backlog.

- **Desk** — a deliberately finite attention surface. Capacity is 1, 3 or 5 items.
- **Inbox** — capture freely, then triage one item at a time.
- **Everything** — the full searchable map, available when needed but never the default daily view.
- **Sources** — the layer for apps, people, agents, feeds and automations. Sources may create input; they do not get to own attention.
- **Regroup** — a re-entry flow after absence or pile-up. It surfaces only a few meaningful decisions instead of forcing the user to process the entire debt pile.

Internally, items still have lightweight states (`INBOX`, `NOW`, `QUEUE`, `WAITING`, `LATER`, `DONE`), but those states are an implementation detail rather than the interface metaphor.

## Why this exists

Most productivity systems fail exactly when life gets messy. Once there are multiple lists, ignored reminders, unread agent runs, old follow-ups and half-finished projects, the system itself becomes another source of pressure.

General Manager is designed around the opposite assumption: **the user will periodically disappear, ignore things, change tools and come back to chaos.** Re-entry is therefore a first-class workflow, not an edge case.

## Current experiment

- Finite Desk capacity with Light (1), Normal (3) and Full (5) modes.
- Universal capture for tasks, projects, follow-ups, ideas, references and routines.
- One-at-a-time Inbox triage.
- Deterministic attention scoring based on explicit state, priority and dates.
- Regroup candidates for stale active work, old waiting items, aging Inbox items and near/overdue dates.
- Searchable Everything view.
- Source grouping so repeated inputs can eventually be summarized below the attention layer.
- Autosaving item inspector with next move, area, effort, date, waiting context, source context and small steps.
- Deterministic local handoff text that works without AI.
- Optional item-level AI actions: make the next move smaller, create a re-entry brief, clean context, or prepare a handoff.
- Keyboard capture (`/`) and universal search / commands (`Ctrl/Cmd + K`).

## AI boundary

Manual mode is the complete product. Capture, triage, search, state changes, regrouping, source grouping, export/import and local handoffs do not require a model.

AI is only invoked by explicit actions on a single item. There is no requirement to send the whole workspace to a model.

The current browser prototype calls an OpenAI-compatible endpoint directly. API credentials remain in browser `localStorage`, which is suitable for a private prototype but not for a hardened desktop product.

## Storage safety

This branch is intentionally isolated from the existing GeneralManager board model.

- Existing production data remains in `users/{uid}/data/board`.
- The life-harness experiment writes to `users/{uid}/data/harness-v3`.
- On first use, the experiment may read the old board as a seed and migrate it in memory.
- It never rewrites the legacy board document.

This allows the old product and the experiment to be used in parallel without destructive migration.

## Architecture

The prototype deliberately remains small:

- `index.html` — static shell.
- `styles.css` — manager interface and responsive layout.
- `core.js` — pure workspace, migration, scoring, regroup and source-group logic.
- `app.js` — browser controller and interaction layer.
- `harness-db.js` — isolated Firestore persistence for the experiment.
- `auth.js` / `db.js` — existing authentication and legacy storage compatibility.

There is still no framework, bundler or application backend.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Tests

```bash
npm test
```

CI also runs syntax checks and a real headless-Chrome runtime smoke test through the Chrome DevTools Protocol.

## Product contract

See [`LIFE_HARNESS.md`](LIFE_HARNESS.md). That document is intentionally more important than any individual UI implementation.
