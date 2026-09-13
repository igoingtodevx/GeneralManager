# General Manager 2.1 — review before release

## Verified locally

- `npm test`: 18 dependency-free Node regression tests pass.
- `npm run check`: application, persistence, domain and auth scripts parse.
- Persistence tests use an in-memory Firestore transaction double, NOT the Firebase emulator.
- The associated portfolio change passes TypeScript/Vite build and oxlint.

## Implemented

- Atomic board/archive transaction with an expected board revision. Stale sessions retain their recovery copy instead of overwriting newer data through this client.
- Local, user-scoped recovery journal before network writes; sign-out waits for pending saves; unload warns when writes remain pending.
- Migration no longer deletes original browser data after a failed write.
- Load failures no longer open a default editable board that could replace real cloud data.
- Auth epoch guards discard stale asynchronous loads; sign-out clears visible board, modal and AI state.
- A dependency-free import boundary validates schema version, byte size, field limits, enum values, identifiers, duplicate IDs, HTTP(S) URLs and column references. Merge is validated before application; cancel no longer means merge.
- Last column cannot be deleted; duplicated checklists are deeply copied; unsafe card URLs are not rendered.
- Session-memory-only AI keys. Legacy keys are removed from `gm_settings` on load; users must re-enter them. HTTPS endpoint checks, request timeout, superseded-request cancellation and explicit outbound-context confirmation.
- Temporary `?demo=1` workspace without authentication or Firestore writes. No real user data is used.
- Mobile CSS with stacked columns, visible column options and keyboard-openable cards; card column selector is the touch/keyboard move alternative.

## Not verified / release gates

1. Complete one browser smoke against commit `5202aa6a7054babb05204761f51ac9e642fdcdc4`. Its Vercel deployment succeeded, but the ChatGPT Cloud Browser was redirected from the PR preview to Vercel Authentication, so the application itself was not reached. Use an intentionally public preview or an approved Vercel preview-auth handoff; do not count the deployment status as a product PASS.
2. Complete visual review at desktop, 390px and 320px widths. Responsive CSS and focus handling are implemented but not browser-certified. No product screenshot was generated because the only permitted browser run stopped at Preview Authentication.
3. Test actual Firebase authentication, transaction retries, offline recovery, two concurrently signed-in tabs and rules in the emulator. No real account, production data, API key or Firebase console was accessed.
4. Review deployed Firestore rules. The existing owner-scoped rules are unchanged. Revision coordination is enforced by this application, not by a rule that prevents an old or custom client from writing without a revision.
5. Close/reload older app tabs before rollout. Legacy clients do not participate in the new revision protocol.
6. Test the optional AI panel with the intended endpoint and real CORS support. No paid AI request was made.
7. Deploy GeneralManager before the portfolio change: the new portfolio CTA targets `?demo=1`.

## Deliberate limitations

No realtime listener, collaborative merge algorithm, offline-first database, server AI proxy, automatic AI mutations, account deletion or password-reset flow was added. Cloud state loads on sign-in/reload; concurrent changes are detected at write time. Recovery copies contain plaintext user content in localStorage and are unsuitable for shared browsers. There is no durable-storage guarantee when browser storage is disabled/full or the browser profile is erased. Explicit recovery can replace newer cloud data only after a user confirms restoration.

## Tests

```
npm test
npm run check
# Optional, with Playwright and Chromium installed locally:
node tests/browser-smoke.cjs
```

The smoke script is supplied but was not executed successfully in this environment. The single Cloud Browser attempt on 2026-09-13 was blocked by Vercel Preview Authentication before app load. Neither attempt is a passing browser test. Do not merge/release solely on the Node suite or Vercel's deployment status.
