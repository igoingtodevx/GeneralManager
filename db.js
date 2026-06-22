// db.js

// CSS styles for Save Indicator and Migration Banner
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
  transition: all var(--transition);
}
.save-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}
#save-indicator.saving .save-dot {
  background: var(--accent-purple);
  box-shadow: 0 0 8px var(--accent-purple);
  animation: save-pulse 1s infinite alternate;
}
#save-indicator.saved .save-dot {
  background: var(--type-repo);
  box-shadow: 0 0 8px var(--type-repo);
}
#save-indicator.error .save-dot {
  background: var(--priority-high);
  box-shadow: 0 0 8px var(--priority-high);
}

@keyframes save-pulse {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

#migration-banner {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(13, 13, 20, 0.95) 100%);
  border-bottom: 1px solid rgba(124, 58, 237, 0.3);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  z-index: 1000;
  position: relative;
}
#migration-banner .banner-text {
  font-size: 13px;
  font-weight: 500;
}
#migration-banner .banner-actions {
  display: flex;
  gap: 8px;
}
`;

// Append CSS
const dbStyleEl = document.createElement('style');
dbStyleEl.textContent = dbStyles;
document.head.appendChild(dbStyleEl);

// Debouncing helpers
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    showSaveIndicator('saving');
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

// Show save state indicator in UI
function showSaveIndicator(state) {
  let indicator = document.getElementById('save-indicator');
  if (!indicator) {
    const titleInput = document.getElementById('board-title');
    if (titleInput) {
      indicator = document.createElement('div');
      indicator.id = 'save-indicator';
      indicator.innerHTML = '<span class="save-dot"></span><span class="save-text">Synced</span>';
      titleInput.parentNode.insertBefore(indicator, titleInput.nextSibling);
    } else {
      return;
    }
  }

  const textEl = indicator.querySelector('.save-text');
  indicator.className = state;

  if (state === 'saving') {
    textEl.textContent = 'Saving...';
  } else if (state === 'saved') {
    textEl.textContent = 'Synced';
  } else if (state === 'error') {
    textEl.textContent = 'Offline / Error';
  }
}

// Firestore operations
async function loadUserData(userId) {
  try {
    const boardRef = db.collection('users').doc(userId).collection('data').doc('board');
    const archiveRef = db.collection('users').doc(userId).collection('data').doc('archive');

    const [boardSnap, archiveSnap] = await Promise.all([
      boardRef.get(),
      archiveRef.get()
    ]);

    let boardData = null;
    let archiveData = [];

    if (boardSnap.exists) {
      boardData = boardSnap.data();
    }
    if (archiveSnap.exists) {
      archiveData = archiveSnap.data().cards || [];
    }

    return { board: boardData, archive: archiveData };
  } catch (err) {
    console.error("Failed to load user data from Firestore:", err);
    showSaveIndicator('error');
    throw err;
  }
}

async function saveUserBoardImmediate(userId, boardData) {
  try {
    await db.collection('users').doc(userId).collection('data').doc('board').set(boardData);
    showSaveIndicator('saved');
  } catch (err) {
    console.error("Failed to save board:", err);
    showSaveIndicator('error');
  }
}

async function saveUserArchiveImmediate(userId, archiveData) {
  try {
    await db.collection('users').doc(userId).collection('data').doc('archive').set({ cards: archiveData });
    showSaveIndicator('saved');
  } catch (err) {
    console.error("Failed to save archive:", err);
    showSaveIndicator('error');
  }
}

// Debounced versions for non-blocking UI interactions
const saveUserBoard = debounce(saveUserBoardImmediate, 800);
const saveUserArchive = debounce(saveUserArchiveImmediate, 800);

// Migration Checker
function hasLocalStorageData() {
  return localStorage.getItem('gm_board') !== null;
}

function clearLocalStorageData() {
  localStorage.removeItem('gm_board');
  localStorage.removeItem('gm_archive');
}

async function importLocalStorageData(userId) {
  try {
    const rawBoard = localStorage.getItem('gm_board');
    const rawArchive = localStorage.getItem('gm_archive');

    let boardData = null;
    let archiveData = [];

    if (rawBoard) boardData = JSON.parse(rawBoard);
    if (rawArchive) archiveData = JSON.parse(rawArchive);

    if (boardData) {
      if (!boardData.meta) boardData.meta = {};
      boardData.meta.importedFromLocalStorage = true;

      // Persist directly to Firebase
      await Promise.all([
        saveUserBoardImmediate(userId, boardData),
        saveUserArchiveImmediate(userId, archiveData)
      ]);

      // Success, clear local storage
      clearLocalStorageData();
      return { board: boardData, archive: archiveData };
    }
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  }
  return null;
}

// Banner rendering
function showMigrationBanner(userId, onImportComplete, onDismiss) {
  if (!hasLocalStorageData() || document.getElementById('migration-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'migration-banner';
  banner.innerHTML = `
    <div class="banner-text">
      📦 <strong>LocalStorage data detected:</strong> Would you like to import your offline boards and archive into your account?
    </div>
    <div class="banner-actions">
      <button class="btn btn-primary btn-sm" id="btn-migrate-import">Import Data</button>
      <button class="btn btn-ghost btn-sm" id="btn-migrate-skip">Keep Offline / Skip</button>
    </div>
  `;

  // Insert banner before #app container or at the top of the body
  document.body.insertBefore(banner, document.body.firstChild);

  document.getElementById('btn-migrate-import').addEventListener('click', async () => {
    const importBtn = document.getElementById('btn-migrate-import');
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    try {
      const data = await importLocalStorageData(userId);
      banner.remove();
      if (data) {
        onImportComplete(data.board, data.archive);
      }
    } catch (err) {
      alert("Error importing data: " + err.message);
      importBtn.disabled = false;
      importBtn.textContent = 'Import Data';
    }
  });

  document.getElementById('btn-migrate-skip').addEventListener('click', () => {
    if (confirm("Skip import? This will NOT delete your local data, but it will not be synced to this account. You can manually import it later via Export/Import files.")) {
      banner.remove();
      onDismiss();
    }
  });
}
