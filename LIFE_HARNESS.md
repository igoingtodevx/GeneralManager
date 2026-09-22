# General Manager — Life Harness Product Contract

## One sentence
General Manager is the layer above tasks, projects, apps, agents and feeds that decides what deserves attention now and keeps everything else safely retrievable.

## The failure mode we are designing for
The user will eventually:

- create multiple lists;
- ignore notifications;
- miss a daily review;
- change tools;
- accumulate unread automated output;
- avoid opening something because it feels important;
- return after days or weeks and not remember where anything stands.

A system that works only while perfectly maintained is not a General Manager.

## The central promise
**The system may contain a lot. The user should rarely have to look at a lot.**

Storage is not attention.
Capture is not commitment.
A notification is not a priority.
A source is not allowed to interrupt the user merely because it produced output.

## Primary surfaces

### Desk
The default view. It has a finite capacity selected by the user:

- Light — 1 item
- Normal — 3 items
- Full — 5 items

The Desk is not a filtered backlog. It is an attention budget.

### Inbox
Anything can be captured without deciding what it means.

Triage is one item at a time. The system never presents a wall of unsorted input as a punishment for capturing freely.

### Everything
The complete searchable map.

It exists for retrieval, auditing and deliberate planning. It is intentionally not the home screen.

### Sources
Apps, agents, people, automations and feeds live below the manager layer.

A future source adapter may ingest 60 events. The default outcome should be one useful summary or decision candidate, not 60 new obligations.

### Regroup
Re-entry after absence is a first-class workflow.

Regroup surfaces at most a handful of items based on explicit signals such as:

- a date passed or is near;
- active work has gone stale;
- something has been waiting for a long time;
- an Inbox capture has been untriaged for days;
- a high-priority queued item is being ignored.

Everything else remains safely stored and out of sight.

## Item model
An item is deliberately generic. It can represent a task, project, follow-up, idea, reference or routine.

Useful optional fields:

- title
- next move
- current state
- area
- effort
- date
- waiting on
- context
- source / system
- source link
- small steps

Metadata should be requested only when it changes a decision.

## AI boundary
AI is optional acceleration, never structural dependency.

Good AI actions:

- make the next move smaller;
- create a compact re-entry brief;
- clean noisy context without losing facts;
- prepare a handoff;
- later: summarize many source events into one decision candidate.

Bad AI defaults:

- mandatory chat before every action;
- automatic reprioritization with invisible reasoning;
- sending the entire workspace to a model by default;
- replacing obvious deterministic UI with an LLM;
- adding AI decoration where a button is clearer.

## No-shame design rules

- Do not gamify inbox zero.
- Do not use large red debt counters as the default visual language.
- Do not punish the user for missing a review.
- Do not require catch-up before resuming useful work.
- Do not conflate overdue dates with moral failure.
- Do not force everything into Today.

The manager should make returning easier than avoiding it.

## Harness rules

1. Every source has a manual equivalent.
2. Repeated source output should batch before it reaches attention.
3. Automations may suggest; they should not silently create high-priority commitments.
4. The user owns the final attention budget.
5. Losing a connector must not make the core manager unusable.
6. A future desktop build should earn its existence through OS integration, not wrapper chrome.

## Desktop direction
A desktop version becomes justified when it can add primitives that the browser cannot provide cleanly:

- global capture hotkey;
- tray / quick-entry surface;
- OS-backed secret storage;
- clipboard, file and selected-text capture;
- deep links into apps, files and repositories;
- local-first data with optional sync;
- controlled adapters for local agents and tools.

Until then, browser workflow quality matters more than packaging.

## Success test
The product is successful when a person who has ignored it for a week can open it and think:

> I know what matters. I am not being punished for everything else.

And a power user with agents, cron jobs, repositories and multiple services can think:

> This is the layer that stops all my other systems from becoming another inbox.

## Product smell tests
Stop and reconsider a feature if it:

- increases the number of things visible by default;
- requires maintaining taxonomy for its own sake;
- creates another notification stream;
- makes the manager feel developer-only;
- makes the manager feel therapy- or diagnosis-specific;
- makes AI necessary for ordinary use;
- adds a second way to do something without eliminating an older one;
- optimizes a complex subsystem that could be removed instead.

## Desk semantic boundary

`NOW` is a commitment and is the only state rendered on the active desk. `QUEUE` is not spare desk content; it is a pool from which the manager may surface one quiet **Up next** candidate. Capacity therefore limits active commitments rather than filling visual slots.
