// Atomic workspace writes, revision checks and user-scoped local recovery.
const workspaceSessions = new Map();
const recoveryKey = uid => 'gm_recovery_v1_' + uid;
function showSaveIndicator(state, message) {
  let el = document.getElementById('save-indicator');
  if (!el) {
    el = document.createElement('span'); el.id = 'save-indicator';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.getElementById('board-title').after(el);
  }
  el.className = state;
  el.textContent = message || ({ saving: 'Saving…', saved: 'Saved', error: 'Not synced — retry or export' }[state]);
}
function refs(uid) {
  const data = db.collection('users').doc(uid).collection('data');
  return { board: data.doc('board'), archive: data.doc('archive') };
}
async function loadUserData(uid) {
  const r = refs(uid);
  const data = await db.runTransaction(async tx => {
    const b = await tx.get(r.board), a = await tx.get(r.archive);
    return { board: b.exists ? b.data() : null, archive: a.exists ? a.data().cards || [] : [], revision: b.exists ? b.data().revision || 0 : 0 };
  });
  workspaceSessions.set(uid, { revision: data.revision, pending: null, running: null, timer: null });
  if (data.board) return { ...GM.validateWorkspace(data), revision: data.revision };
  return data;
}
function queueWorkspace(uid, boardData, archiveData) {
  const session = workspaceSessions.get(uid);
  if (!session) throw new Error('Workspace is not loaded. Reload before editing.');
  const payload = GM.validateWorkspace({ board: boardData, archive: archiveData });
  session.pending = payload;
  localStorage.setItem(recoveryKey(uid), JSON.stringify({ ...payload, baseRevision: session.revision }));
  clearTimeout(session.timer);
  showSaveIndicator('saving');
  session.timer = setTimeout(() => flushWorkspace(uid).catch(() => {}), 300);
}
async function flushWorkspace(uid) {
  const session = workspaceSessions.get(uid);
  if (!session) return;
  clearTimeout(session.timer);
  if (session.running) { await session.running; return flushWorkspace(uid); }
  if (!session.pending) return;
  const payload = session.pending, expected = session.revision, r = refs(uid);
  session.running = (async () => {
    try {
      await db.runTransaction(async tx => {
        const remote = await tx.get(r.board);
        const revision = remote.exists ? remote.data().revision || 0 : 0;
        if (revision !== expected) throw new Error('Another session changed this board. Export your changes, then reload.');
        tx.set(r.board, { ...payload.board, revision: expected + 1 });
        tx.set(r.archive, { cards: payload.archive });
      });
      session.revision = expected + 1;
      if (session.pending === payload) {
        session.pending = null;
        localStorage.removeItem(recoveryKey(uid));
        showSaveIndicator('saved');
      } else {
        localStorage.setItem(recoveryKey(uid), JSON.stringify({ ...session.pending, baseRevision: session.revision }));
      }
    } catch (err) {
      showSaveIndicator('error', err.message + ' Local recovery retained.');
      throw err;
    } finally { session.running = null; }
  })();
  await session.running;
  if (session.pending) return flushWorkspace(uid);
}
function hasPendingWorkspace(uid) { return Boolean(workspaceSessions.get(uid)?.pending); }
function readRecovery(uid) {
  const raw = localStorage.getItem(recoveryKey(uid));
  return raw ? GM.validateWorkspace(JSON.parse(raw)) : null;
}
function hasLocalStorageData() { return localStorage.getItem('gm_board') !== null; }
async function importLocalStorageData(uid) {
  const data = GM.validateWorkspace({ board: JSON.parse(localStorage.getItem('gm_board')), archive: JSON.parse(localStorage.getItem('gm_archive') || '[]') });
  queueWorkspace(uid, data.board, data.archive);
  await flushWorkspace(uid);
  localStorage.removeItem('gm_board'); localStorage.removeItem('gm_archive');
  return data;
}
function showMigrationBanner(uid, onComplete, onDismiss) {
  if (!hasLocalStorageData() || document.getElementById('migration-banner')) return;
  const banner = document.createElement('div'); banner.id = 'migration-banner';
  banner.innerHTML = '<p>Older local workspace found. Import it into this empty account?</p><button id="btn-migrate-import" class="btn btn-primary">Import local data</button><button id="btn-migrate-skip" class="btn btn-ghost">Start fresh; keep local copy</button><p id="migration-error" role="alert"></p>';
  document.body.prepend(banner);
  document.getElementById('btn-migrate-import').onclick = async () => {
    const button = document.getElementById('btn-migrate-import'); button.disabled = true;
    try { const data = await importLocalStorageData(uid); banner.remove(); onComplete(data.board, data.archive); }
    catch (err) { document.getElementById('migration-error').textContent = err.message; button.disabled = false; }
  };
  document.getElementById('btn-migrate-skip').onclick = () => { banner.remove(); onDismiss(); };
}
