# General Manager — portfolio case-study notes

## Positioning

General Manager separates capture from commitment and makes re-entry after interruption a few deliberate decisions instead of a complete cleanup session.

## 30-second explanation

Many task managers work well while they are maintained perfectly. The interesting moment is what happens after that breaks: several days pass, tasks and ideas accumulate, external outputs pile up, and reopening the system itself feels expensive. General Manager lets all of that enter without making it a commitment. The Desk has a real attention budget, Inbox is processed one item at a time, and a Regroup session is capped at three decisions before the user can simply continue working. The core flow is deterministic and works without AI.

## Three portfolio screenshots

1. **Finite Desk** — one active commitment, a visible capacity budget and at most one calm Up-next candidate.
2. **Finite Regroup** — three or fewer re-entry decisions with an obvious exit and no backlog refill.
3. **Inbox triage** — one ambiguous input with Now / Queue / Waiting / Keep plus Skip and Discard.

Do not use Sources as a primary screenshot until real source ingestion/compression exists.

## Strong case-study points

- Product rule encoded as behavior: capture is not commitment; Desk capacity is enforced centrally rather than visually faked.
- Re-entry is a first-class workflow with a finite session instead of an overdue-debt dashboard.
- Deterministic core logic remains useful without an LLM.
- Portfolio demo removes login, cloud and key friction without creating a separate fake UI or fake AI output.
- Demo persistence is immediate and single-writer; behavioral tests cover reload and state transitions.
- The experimental v3 cloud document remains isolated from the older board model instead of destructively migrating it.

## Implemented vs experimental vs future

### Implemented
Capture, finite Desk, Queue suggestion, one-at-a-time triage, finite Regroup, Everything search, local demo persistence, export, local handoff, responsive browser UI, automated core and Chromium behavior tests.

### Experimental
Firebase auth/Firestore mode and item-level BYOK AI helpers. They are not the portfolio demo's trust boundary.

### Future direction
OS-level desktop capture, local-first desktop storage, real source adapters and event compression. None are claimed as shipped.

## Do not claim

- autonomous AI General Manager;
- live Gmail/GitHub/calendar/Hermes connectors;
- automatic compression of many agent events into one decision;
- production-ready multi-device synchronization;
- hardened secret storage;
- proven long-term productivity or health outcomes.
