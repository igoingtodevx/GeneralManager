// harness-db.js
// Cloud mode writes the experimental v3 document. Portfolio demo mode stays local.

const DEMO_KEY = 'gm_demo_harness_v3';

function database() {
  return window.firebase.firestore();
}

function harnessDebounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    window.showSaveIndicator?.('saving');
    timer = setTimeout(() => fn(...args), delay);
  };
}

export async function loadUserHarness(userId) {
  if (window.GM_DEMO_MODE) {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }
  const ref = database().collection('users').doc(userId).collection('data').doc('harness-v3');
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

export function saveUserHarnessImmediate(userId, workspace) {
  if (window.GM_DEMO_MODE) {
    if (window.GM_DEMO_READ_ONLY) throw new Error('This demo is already open for editing in another tab.');
    localStorage.setItem(DEMO_KEY, JSON.stringify(workspace));
    window.showSaveIndicator?.('saved');
    return Promise.resolve();
  }

  const ref = database().collection('users').doc(userId).collection('data').doc('harness-v3');
  return ref.set(workspace).then(() => {
    window.showSaveIndicator?.('saved');
  }).catch(error => {
    console.error('Failed to save harness workspace:', error);
    window.showSaveIndicator?.('error');
    throw error;
  });
}

const cloudDebouncedSave = harnessDebounce(saveUserHarnessImmediate, 700);

export function saveUserHarness(userId, workspace) {
  if (window.GM_DEMO_MODE) return saveUserHarnessImmediate(userId, workspace);
  return cloudDebouncedSave(userId, workspace);
}

export function resetDemoHarness() {
  localStorage.removeItem(DEMO_KEY);
}
