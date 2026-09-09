# MIGRATION_PLAN.md — Local workspace to optional Firebase sync

## Current local behavior

| Key | Content | Mode |
|---|---|---|
| `gm_board` | `{ columns[], cards[], meta }` | Local workspace |
| `gm_archive` | Archived cards | Local workspace |
| `gm_settings` | `{ baseUrl, apiKey, model }` | Device-local AI settings |
| `gm_local_revision` | Local revision counter | Tracks whether local data changed |
| `gm_cloud_choice_{uid}` | Last explicit cloud choice and local revision | Prevents repeated prompts only for a previously chosen cloud workspace |

Local writes are synchronous browser `localStorage` writes. A default board is created on first load and remains usable without Firebase or an account.

## Optional cloud architecture

- Firebase Authentication uses email/password.
- Firebase Authentication is not required for app startup.
- Cloud data keeps the existing per-user documents:

```text
users/{uid}/data/board   → { columns[], cards[], meta{} }
users/{uid}/data/archive → { cards[] }
```

- `db.js` loads both documents once after authentication and writes them through debounced Firestore `set()` calls.
- The actual debounce is **800 ms**.
- There is no `onSnapshot` listener and no automatic real-time multi-device reconciliation. A reload reads the current cloud documents again.
- AI settings stay in device-local `localStorage` and are not sent to Firestore.

## Sign-in decision flow

1. The visitor works locally immediately.
2. The visitor clicks **Sign in to sync**.
3. Firebase authentication completes.
4. GeneralManager reads the signed-in user's existing cloud documents.
5. If meaningful local data exists, the app presents an explicit choice:
   - **Import local workspace** — writes the local board and archive to the user's cloud documents. If a cloud board already exists, a second confirmation explains that it will be replaced.
   - **Use synced workspace** — loads the cloud board and archive. The local workspace is not silently merged or deleted.
   - **Keep using local mode** — signs out and returns to the local workspace.
6. If there is no local data, an existing cloud workspace loads automatically. If neither side exists, a default cloud workspace is created.
7. If cloud loading or saving fails, the local workspace remains available and the failure is reported.

The local workspace is intentionally retained after import. A previous `import` choice is not replayed automatically on a later sign-in, because doing that could overwrite newer cloud edits. A prior `use cloud` choice is reused only while the local revision is unchanged.

## Data-safety rules

- No local data is cleared automatically during sign-in.
- No cloud document is replaced without an explicit import action and, where relevant, a replacement confirmation.
- JSON import validates that a board has at least one column before showing the replace/merge choice.
- Importing malformed data leaves the active board unchanged.
- The last board column is protected by the same invariant.

## Rollback

The original Firebase migration remains available in Git history at commit `0bb9448`. The public-tool changes are isolated on `feat/public-tool-polish`; do not merge or deploy this branch as part of this document.
