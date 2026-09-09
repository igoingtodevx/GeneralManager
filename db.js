// db.js

const dbStyles = `
#save-indicator {
  font-size: 11px;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  user-select: none;
  pointer-events: none;
}
.save-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
#save-indicator.saving .save-dot { background: var(--accent-purple); animation: save-pulse 1s infinite alternate; }
#save-indicator.saved .save-dot { background: var(--type-repo); }
#save-indicator.error .save-dot { background: var(--priority-high); }
@keyframes save-pulse { from { opacity: 0.4; } to { opacity: 1; } }
`;

const dbStyleEl = document.createElement('style');
dbStyleEl.textContent = dbStyles;
document.head.appendChild(dbStyleEl);

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    showSaveIndicator('saving');
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showSaveIndicator(state) {
  let indicator = document.getElementById('save-indicator');
  if (!indicator) {
    const titleInput = document.getElementById('board-title');
    if (!titleInput) return;
    indicator = document.createElement('div');
    indicator.id = 'save-indicator';
    indicator.innerHTML = '<span class="save-dot"></span><span class="save-text">Synced</span>';
    titleInput.parentNode.insertBefore(indicator, titleInput.nextSibling);
  }

  const textEl = indicator.querySelector('.save-text');
  indicator.className = state;
  if (state === 'saving') textEl.textContent = 'Saving...';
  if (state === 'saved') textEl.textContent = 'Synced';
  if (state === 'error') textEl.textContent = 'Sync error';
}

function requireFirestore() {
  if (!db) throw new Error('Cloud sync is not configured for this deployment.');
  return db;
}

async function loadUserData(userId) {
  const firestore = requireFirestore();
  try {
    const boardRef = firestore.collection('users').doc(userId).collection('data').doc('board');
    const archiveRef = firestore.collection('users').doc(userId).collection('data').doc('archive');
    const [boardSnap, archiveSnap] = await Promise.all([boardRef.get(), archiveRef.get()]);

    return {
      board: boardSnap.exists ? boardSnap.data() : null,
      archive: archiveSnap.exists && Array.isArray(archiveSnap.data().cards) ? archiveSnap.data().cards : []
    };
  } catch (error) {
    console.error('Failed to load user data from Firestore:', error);
    showSaveIndicator('error');
    throw error;
  }
}

async function saveUserBoardImmediate(userId, boardData) {
  const firestore = requireFirestore();
  try {
    await firestore.collection('users').doc(userId).collection('data').doc('board').set(boardData);
    showSaveIndicator('saved');
  } catch (error) {
    console.error('Failed to save board:', error);
    showSaveIndicator('error');
    throw error;
  }
}

async function saveUserArchiveImmediate(userId, archiveData) {
  const firestore = requireFirestore();
  try {
    await firestore.collection('users').doc(userId).collection('data').doc('archive').set({ cards: archiveData });
    showSaveIndicator('saved');
  } catch (error) {
    console.error('Failed to save archive:', error);
    showSaveIndicator('error');
    throw error;
  }
}

// Firestore writes are deliberately debounced. There is no realtime listener:
// the signed-in browser is the write owner and reload performs a fresh read.
const saveUserBoard = debounce(saveUserBoardImmediate, 800);
const saveUserArchive = debounce(saveUserArchiveImmediate, 800);
