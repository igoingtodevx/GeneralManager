// harness-db.js
// The life-harness experiment intentionally uses a separate Firestore document.
// This keeps the production v2 board readable while the v3 data model evolves.

function harnessDebounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    window.showSaveIndicator?.('saving');
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function loadUserHarness(userId) {
  const ref = db.collection('users').doc(userId).collection('data').doc('harness-v3');
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function saveUserHarnessImmediate(userId, workspace) {
  try {
    const ref = db.collection('users').doc(userId).collection('data').doc('harness-v3');
    await ref.set(workspace);
    window.showSaveIndicator?.('saved');
  } catch (error) {
    console.error('Failed to save harness workspace:', error);
    window.showSaveIndicator?.('error');
    throw error;
  }
}

const saveUserHarness = harnessDebounce(saveUserHarnessImmediate, 700);

Object.assign(window, {
  loadUserHarness,
  saveUserHarnessImmediate,
  saveUserHarness
});
