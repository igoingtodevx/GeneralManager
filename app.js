// app.js

const TYPES = ['AGENT', 'RESEARCH', 'REPO', 'URL', 'NOTE', 'IDEA'];
const TYPE_ICONS = { AGENT: '🤖', RESEARCH: '🔬', REPO: '📦', URL: '🔗', NOTE: '📝', IDEA: '💡' };
const PRIORITIES = ['HIGH', 'MED', 'LOW'];
const MAX_COLUMNS = 8;
const LS_SETTINGS = 'gm_settings';

// Column Color Presets
const COLUMN_COLORS = {
  PURPLE: { hex: '#7c3aed', bg: 'rgba(124, 58, 237, 0.15)', name: 'Purple' },
  BLUE: { hex: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', name: 'Blue' },
  GREEN: { hex: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', name: 'Green' },
  YELLOW: { hex: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', name: 'Yellow' },
  PINK: { hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', name: 'Pink' },
  GRAY: { hex: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', name: 'Gray' }
};
const DEFAULT_INDEX_COLORS = ['PURPLE', 'GREEN', 'YELLOW', 'GRAY'];

// STATE
let board = null;
let settings = null;
let archive = [];
let filterType = 'ALL';
let filterPriority = 'ALL';
let searchQuery = '';
let draggedCardId = null;
let activeModalCardId = null;
let modalOpen = false;
let activeModalSubtasks = [];
let archiveSearchQuery = '';
let archiveModalOpen = false;

let currentUser = null;
let listenersInitialized = false;

// ═══════════════════════════════════════════════════════════
// PERSISTENCE (Firestore adaptors)
// ═══════════════════════════════════════════════════════════
function saveBoard() {
  if (!board) return;
  board.meta.boardTitle = document.getElementById('board-title').value.trim() || 'GeneralManager';
  if (demoMode) { showSaveIndicator('saved', 'Demo · changes reset on reload'); return; }
  if (currentUser) {
    try { queueWorkspace(currentUser.uid, board, archive); }
    catch (err) { showSaveIndicator('error', err.message + ' Export a backup now.'); }
  }
}
function saveBoardImmediate() {
  saveBoard();
  if (currentUser) return flushWorkspace(currentUser.uid).catch(() => {});
}
function saveArchive() { saveBoard(); }
function saveArchiveImmediate() { return saveBoardImmediate(); }
function loadSettings() {
  settings = { baseUrl: '', apiKey: '', model: '' };
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
    settings = { baseUrl: raw.baseUrl || '', model: raw.model || '', apiKey: '' };
    // Legacy stored secrets are not retained. Keys now live in memory for this session.
    localStorage.setItem(LS_SETTINGS, JSON.stringify({ baseUrl: settings.baseUrl, model: settings.model }));
  } catch { /* defaults remain usable */ }
}
function saveSettings() {
  settings.baseUrl = document.getElementById('ai-base-url').value.trim().replace(/\/+$/, '');
  settings.apiKey = document.getElementById('ai-api-key').value.trim();
  settings.model = document.getElementById('ai-model').value.trim();
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify({ baseUrl: settings.baseUrl, model: settings.model })); }
  catch { /* Session-only operation remains available. */ }
}

// ═══════════════════════════════════════════════════════════
// DEFAULT BOARD
// ═══════════════════════════════════════════════════════════
function createDefaultBoard() {
  const cols = [
    { id: crypto.randomUUID(), name: 'BACKLOG', order: 0 },
    { id: crypto.randomUUID(), name: 'ACTIVE', order: 1 },
    { id: crypto.randomUUID(), name: 'PARKED', order: 2 },
    { id: crypto.randomUUID(), name: 'DONE', order: 3 }
  ];
  const now = Date.now();
  const cards = [
    {
      id: crypto.randomUUID(), columnId: cols[0].id, type: 'AGENT', title: 'Set up Codex agent for repo analysis',
      url: '', notes: 'Need to configure the agent with proper context window settings and tool access.', priority: 'MED',
      aiModel: 'gpt-4o', order: 0, createdAt: now - 7200000, updatedAt: now - 3600000
    },
    {
      id: crypto.randomUUID(), columnId: cols[1].id, type: 'RESEARCH', title: 'Deep dive: transformer attention patterns',
      url: 'https://arxiv.org/abs/2401.00001', notes: '', priority: 'HIGH',
      aiModel: 'gemini-2.5-pro', order: 0, createdAt: now - 86400000, updatedAt: now - 43200000
    },
    {
      id: crypto.randomUUID(), columnId: cols[2].id, type: 'IDEA', title: 'Build a context-switching dashboard',
      url: '', notes: 'Prototype idea: visualize all active AI sessions with their token usage and last activity.', priority: 'LOW',
      aiModel: '', order: 0, createdAt: now - 172800000, updatedAt: now - 86400000
    }
  ];
  return { columns: cols, cards: cards, meta: { boardTitle: 'GeneralManager', lastType: 'NOTE' } };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const days = Math.floor(hr / 24);
  if (days < 30) return days + 'd ago';
  const months = Math.floor(days / 30);
  return months + 'mo ago';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isUrl(str) {
  return /^https?:\/\//i.test(str.trim());
}

function getCardsForColumn(colId) {
  if (!board || !board.cards) return [];
  return board.cards
    .filter(c => c.columnId === colId)
    .sort((a, b) => a.order - b.order);
}

function cardMatchesFilters(card) {
  if (filterType !== 'ALL' && card.type !== filterType) return false;
  if (filterPriority !== 'ALL' && card.priority !== filterPriority) return false;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const inTitle = card.title.toLowerCase().includes(q);
    const inNotes = (card.notes || '').toLowerCase().includes(q);
    if (!inTitle && !inNotes) return false;
  }
  return true;
}

function nextPriority(current) {
  const idx = PRIORITIES.indexOf(current);
  return PRIORITIES[(idx + 1) % PRIORITIES.length];
}

// ═══════════════════════════════════════════════════════════
// RENDER BOARD
// ═══════════════════════════════════════════════════════════
function renderBoard() {
  const container = document.getElementById('board-container');
  if (!container) return;
  container.innerHTML = '';

  if (!board || !board.columns) return;

  const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);

  for (const col of sortedCols) {
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.columnId = col.id;

    // Apply color theme dynamically
    const themeName = col.color || DEFAULT_INDEX_COLORS[col.order % DEFAULT_INDEX_COLORS.length];
    const colorTheme = COLUMN_COLORS[themeName] || COLUMN_COLORS.GRAY;
    colEl.style.setProperty('--col-accent', colorTheme.hex);
    colEl.style.setProperty('--col-accent-bg', colorTheme.bg);

    const colCards = getCardsForColumn(col.id);
    const visibleCards = colCards.filter(cardMatchesFilters);

    // Header
    const header = document.createElement('div');
    header.className = 'column-header';
    header.style.cursor = 'context-menu';
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showColumnContextMenu(e, col.id);
    });

    const nameEl = document.createElement('div');
    nameEl.className = 'column-name';
    nameEl.textContent = col.name;
    nameEl.addEventListener('dblclick', () => {
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const finishRename = () => {
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('editing');
      col.name = nameEl.textContent.trim() || col.name;
      nameEl.textContent = col.name;
      saveBoard();
      renderBoard();
    };
    nameEl.addEventListener('blur', finishRename);
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    });

    const countEl = document.createElement('div');
    countEl.className = 'column-count';
    countEl.textContent = colCards.length;

    header.appendChild(nameEl);
    header.appendChild(countEl);
    const options = document.createElement('button');
    options.className = 'btn-icon column-options'; options.textContent = '⋯';
    options.setAttribute('aria-label', 'Options for ' + col.name);
    options.onclick = e => { const rect = options.getBoundingClientRect(); showColumnContextMenu({ clientX: rect.left, clientY: rect.bottom }, col.id); };
    header.appendChild(options);
    colEl.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'column-body';
    body.dataset.columnId = col.id;

    // Drag events on column body
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      body.classList.add('drag-over');

      // Intra-column reorder: find closest card to insert before
      const afterEl = getDragAfterElement(body, e.clientY);
      const existing = body.querySelector('.drop-placeholder');
      if (!existing) {
        const placeholder = document.createElement('div');
        placeholder.className = 'drop-placeholder';
        if (afterEl) body.insertBefore(placeholder, afterEl);
        else body.appendChild(placeholder);
      } else {
        if (afterEl) body.insertBefore(existing, afterEl);
        else body.appendChild(existing);
      }
    });

    body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      body.classList.add('drag-over');
    });

    body.addEventListener('dragleave', (e) => {
      if (!body.contains(e.relatedTarget)) {
        body.classList.remove('drag-over');
        const ph = body.querySelector('.drop-placeholder');
        if (ph) ph.remove();
      }
    });

    body.addEventListener('drop', (e) => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const ph = body.querySelector('.drop-placeholder');
      if (ph) ph.remove();

      if (!draggedCardId) return;
      const card = board.cards.find(c => c.id === draggedCardId);
      if (!card) return;

      card.columnId = col.id;
      card.updatedAt = Date.now();

      // Compute new order
      const afterEl = getDragAfterElement(body, e.clientY);
      const colCardsNow = getCardsForColumn(col.id).filter(c => c.id !== card.id);

      if (afterEl) {
        const afterId = afterEl.dataset.cardId;
        const afterIdx = colCardsNow.findIndex(c => c.id === afterId);
        colCardsNow.splice(afterIdx, 0, card);
      } else {
        colCardsNow.push(card);
      }
      colCardsNow.forEach((c, i) => c.order = i);

      saveBoard();
      renderBoard();
    });

    if (visibleCards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'column-empty';
      empty.textContent = 'Drop here or quick-add below';
      body.appendChild(empty);
    } else {
      for (const card of visibleCards) {
        body.appendChild(renderCard(card));
      }
    }

    colEl.appendChild(body);

    // Footer with quick-add
    const footer = document.createElement('div');
    footer.className = 'column-footer';
    const quickAdd = document.createElement('button');
    quickAdd.className = 'column-quick-add';
    quickAdd.textContent = '+ Add card';
    quickAdd.addEventListener('click', () => {
      const title = prompt('Card title:');
      if (!title || !title.trim()) return;
      createCard(title.trim(), board.meta.lastType || 'NOTE', col.id);
    });
    footer.appendChild(quickAdd);
    colEl.appendChild(footer);

    container.appendChild(colEl);
  }

  // Add Column button
  if (board.columns.length < MAX_COLUMNS) {
    const addColBtn = document.createElement('button');
    addColBtn.id = 'add-column-btn';
    addColBtn.textContent = '+';
    addColBtn.title = 'Add column (max ' + MAX_COLUMNS + ')';
    addColBtn.addEventListener('click', () => {
      const name = prompt('Column name:');
      if (!name || !name.trim()) return;
      board.columns.push({
        id: crypto.randomUUID(),
        name: name.trim().toUpperCase(),
        order: board.columns.length
      });
      saveBoard();
      renderBoard();
    });
    container.appendChild(addColBtn);
  }
}

function renderCard(card) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.cardId = card.id;
  el.dataset.type = card.type;
  el.draggable = true;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Edit ' + card.title);
  el.addEventListener('keydown', e => { if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModal(card.id); } });

  // Drag
  el.addEventListener('dragstart', (e) => {
    draggedCardId = card.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
  });
  el.addEventListener('dragend', () => {
    draggedCardId = null;
    el.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(d => d.classList.remove('drag-over'));
    document.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
  });

  // Click -> open modal
  el.addEventListener('click', (e) => {
    if (e.target.classList.contains('card-priority') || e.target.classList.contains('card-url')) return;
    openModal(card.id);
  });

  // Right-click -> context menu
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, card.id);
  });

  // Header
  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = card.title;

  const priority = document.createElement('div');
  priority.className = 'card-priority';
  priority.dataset.priority = card.priority;
  priority.title = 'Priority: ' + card.priority + ' (click to cycle)';
  priority.addEventListener('click', (e) => {
    e.stopPropagation();
    card.priority = nextPriority(card.priority);
    card.updatedAt = Date.now();
    saveBoard();
    renderBoard();
  });

  header.appendChild(title);
  header.appendChild(priority);
  el.appendChild(header);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const typeTag = document.createElement('span');
  typeTag.className = 'card-tag type-tag';
  typeTag.dataset.type = card.type;
  typeTag.textContent = TYPE_ICONS[card.type] + ' ' + card.type;
  meta.appendChild(typeTag);

  if (card.aiModel) {
    const aiTag = document.createElement('span');
    aiTag.className = 'card-tag ai-tag';
    aiTag.textContent = card.aiModel;
    meta.appendChild(aiTag);
  }

  if (card.subtasks && card.subtasks.length > 0) {
    const doneCount = card.subtasks.filter(s => s.done).length;
    const subtaskTag = document.createElement('span');
    subtaskTag.className = 'card-tag';
    subtaskTag.style.background = 'rgba(255, 255, 255, 0.04)';
    subtaskTag.style.border = '1px solid var(--border-color)';
    subtaskTag.style.color = 'var(--text-muted)';
    subtaskTag.textContent = `📋 ${doneCount}/${card.subtasks.length}`;
    meta.appendChild(subtaskTag);
  }

  const time = document.createElement('span');
  time.className = 'card-time';
  time.textContent = relativeTime(card.updatedAt);
  time.title = 'Updated: ' + new Date(card.updatedAt).toLocaleString();
  meta.appendChild(time);

  el.appendChild(meta);

  // URL
  if (GM.safeUrl(card.url)) {
    const urlLink = document.createElement('a');
    urlLink.className = 'card-url';
    urlLink.href = GM.safeUrl(card.url);
    urlLink.target = '_blank';
    urlLink.rel = 'noopener';
    urlLink.textContent = card.url;
    urlLink.addEventListener('click', (e) => e.stopPropagation());
    el.appendChild(urlLink);
  }

  return el;
}

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.card:not(.dragging)')];
  let closest = null;
  let closestOffset = Number.NEGATIVE_INFINITY;

  for (const card of cards) {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = card;
    }
  }
  return closest;
}

// ═══════════════════════════════════════════════════════════
// CARD CRUD
// ═══════════════════════════════════════════════════════════
function createCard(title, type, columnId) {
  const col = columnId || board.columns[0].id;
  const now = Date.now();
  const colCards = getCardsForColumn(col);
  let url = '';
  if (isUrl(title)) {
    url = title.trim();
    type = 'URL';
  }
  const card = {
    id: crypto.randomUUID(),
    columnId: col,
    type: type,
    title: title,
    url: url,
    notes: '',
    priority: 'MED',
    aiModel: '',
    order: colCards.length,
    createdAt: now,
    updatedAt: now
  };
  board.cards.push(card);
  board.meta.lastType = type;
  saveBoard();
  renderBoard();
}

function deleteCard(cardId) {
  board.cards = board.cards.filter(c => c.id !== cardId);
  saveBoard();
  renderBoard();
}

function archiveCard(cardId) {
  const idx = board.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const card = board.cards.splice(idx, 1)[0];
  archive.push(card);
  saveArchive();
  saveBoard();
  renderBoard();
}

function duplicateCard(cardId) {
  const orig = board.cards.find(c => c.id === cardId);
  if (!orig) return;
  const now = Date.now();
  const colCards = getCardsForColumn(orig.columnId);
  const copy = {
    ...structuredClone(orig),
    id: crypto.randomUUID(),
    title: orig.title + ' (copy)',
    order: colCards.length,
    createdAt: now,
    updatedAt: now
  };
  board.cards.push(copy);
  saveBoard();
  renderBoard();
}

function moveCardToColumn(cardId, colId) {
  const card = board.cards.find(c => c.id === cardId);
  if (!card) return;
  card.columnId = colId;
  card.updatedAt = Date.now();
  const colCards = getCardsForColumn(colId).filter(c => c.id !== cardId);
  card.order = colCards.length;
  saveBoard();
  renderBoard();
}

// ═══════════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════════════
function showContextMenu(e, cardId) {
  const menu = document.getElementById('context-menu');
  const card = board.cards.find(c => c.id === cardId);
  if (!card) return;

  let html = '';

  // Move to submenu
  html += '<button class="ctx-item" style="font-weight:600;color:var(--text-muted);cursor:default;pointer-events:none;">Move to…</button>';
  for (const col of board.columns.sort((a, b) => a.order - b.order)) {
    if (col.id === card.columnId) continue;
    html += '<button class="ctx-item ctx-submenu" data-action="move" data-col-id="' + col.id + '">' + escapeHtml(col.name) + '</button>';
  }
  html += '<div class="ctx-separator"></div>';
  html += '<button class="ctx-item" data-action="duplicate">📋 Duplicate</button>';
  html += '<button class="ctx-item" data-action="archive">📦 Archive</button>';
  if (card.url) {
    html += '<button class="ctx-item" data-action="copyurl">🔗 Copy URL</button>';
  }
  html += '<div class="ctx-separator"></div>';
  html += '<button class="ctx-item danger" data-action="delete">🗑 Delete</button>';

  menu.innerHTML = html;
  menu.classList.add('visible');

  // Position
  const mx = e.clientX;
  const my = e.clientY;
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = (mx + mw > window.innerWidth ? mx - mw : mx) + 'px';
  menu.style.top = (my + mh > window.innerHeight ? my - mh : my) + 'px';

  // Bind actions
  menu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'move') moveCardToColumn(cardId, btn.dataset.colId);
      else if (action === 'duplicate') duplicateCard(cardId);
      else if (action === 'archive') archiveCard(cardId);
      else if (action === 'copyurl') { try { navigator.clipboard.writeText(card.url); } catch(e) {} }
      else if (action === 'delete') { if (confirm('Delete "' + card.title + '"?')) deleteCard(cardId); }
      hideContextMenu();
    });
  });
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════
function openModal(cardId) {
  const card = board.cards.find(c => c.id === cardId);
  if (!card) return;
  activeModalCardId = cardId;
  modalOpen = true;

  document.getElementById('modal-title').value = card.title;
  document.getElementById('modal-type').value = card.type;
  document.getElementById('modal-priority').value = card.priority;
  document.getElementById('modal-url').value = card.url || '';
  document.getElementById('modal-notes').value = card.notes || '';
  document.getElementById('modal-ai-model').value = card.aiModel || '';

  // Initialize activeModalSubtasks
  activeModalSubtasks = card.subtasks ? JSON.parse(JSON.stringify(card.subtasks)) : [];
  renderChecklist(activeModalSubtasks);
  document.getElementById('new-subtask-input').value = '';

  // Populate column select
  const colSelect = document.getElementById('modal-column');
  colSelect.innerHTML = '';
  for (const col of board.columns.sort((a, b) => a.order - b.order)) {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    if (col.id === card.columnId) opt.selected = true;
    colSelect.appendChild(opt);
  }

  document.getElementById('modal-created').textContent = 'Created: ' + relativeTime(card.createdAt);
  document.getElementById('modal-updated').textContent = 'Modified: ' + relativeTime(card.updatedAt);

  document.getElementById('modal-overlay').classList.add('visible');
  document.getElementById('modal-title').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
  activeModalCardId = null;
  modalOpen = false;
}

function saveModal() {
  const card = board.cards.find(c => c.id === activeModalCardId);
  if (!card) return;

  const inputUrl = document.getElementById('modal-url').value.trim();
  if (inputUrl && !GM.safeUrl(inputUrl)) { alert('Use a complete HTTP or HTTPS URL.'); return; }
  card.title = document.getElementById('modal-title').value.trim() || card.title;
  card.type = document.getElementById('modal-type').value;
  card.priority = document.getElementById('modal-priority').value;
  card.url = document.getElementById('modal-url').value.trim();
  card.notes = document.getElementById('modal-notes').value;
  card.aiModel = document.getElementById('modal-ai-model').value.trim();
  card.subtasks = activeModalSubtasks; // Save subtasks

  const newColId = document.getElementById('modal-column').value;
  if (newColId !== card.columnId) {
    card.columnId = newColId;
    const colCards = getCardsForColumn(newColId).filter(c => c.id !== card.id);
    card.order = colCards.length;
  }

  card.updatedAt = Date.now();
  saveBoard();
  renderBoard();
  closeModal();
}

// ═══════════════════════════════════════════════════════════
// COLUMN & ARCHIVE OPTIONS / HELPERS
// ═══════════════════════════════════════════════════════════
function renderChecklist(subtasks) {
  const container = document.getElementById('modal-checklist');
  container.innerHTML = '';
  if (!subtasks || subtasks.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; font-style:italic; padding:4px 0;">No subtasks yet.</div>';
    return;
  }
  subtasks.forEach((sub, idx) => {
    const item = document.createElement('div');
    item.className = 'subtask-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'subtask-checkbox';
    checkbox.checked = sub.done;
    checkbox.addEventListener('change', () => {
      sub.done = checkbox.checked;
      textSpan.className = checkbox.checked ? 'subtask-text completed' : 'subtask-text';
    });

    const textSpan = document.createElement('span');
    textSpan.className = sub.done ? 'subtask-text completed' : 'subtask-text';
    textSpan.textContent = sub.text;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Remove subtask';
    delBtn.style.padding = '2px 6px';
    delBtn.addEventListener('click', () => {
      subtasks.splice(idx, 1);
      renderChecklist(subtasks);
    });

    item.appendChild(checkbox);
    item.appendChild(textSpan);
    item.appendChild(delBtn);
    container.appendChild(item);
  });
}

function showColumnContextMenu(e, colId) {
  const menu = document.getElementById('context-menu');
  const col = board.columns.find(c => c.id === colId);
  if (!col) return;

  let html = '';
  
  html += '<button class="ctx-item" data-action="rename">📝 Rename Column</button>';
  html += '<div class="ctx-separator"></div>';
  
  const idx = board.columns.findIndex(c => c.id === colId);
  const isFirst = idx === 0;
  const isLast = idx === board.columns.length - 1;
  
  if (!isFirst) {
    html += '<button class="ctx-item" data-action="move-left">◀ Move Left</button>';
  }
  if (!isLast) {
    html += '<button class="ctx-item" data-action="move-right">▶ Move Right</button>';
  }
  
  html += '<div class="ctx-separator"></div>';
  html += '<button class="ctx-item" style="font-weight:600;color:var(--text-muted);cursor:default;pointer-events:none;">Set Color Accent</button>';
  
  Object.keys(COLUMN_COLORS).forEach(cName => {
    const colorInfo = COLUMN_COLORS[cName];
    const dot = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colorInfo.hex}; margin-right:8px; vertical-align:middle;"></span>`;
    const activeGlow = col.color === cName ? ' ✓' : '';
    html += `<button class="ctx-item ctx-submenu" data-action="set-color" data-color="${cName}">${dot}${colorInfo.name}${activeGlow}</button>`;
  });
  
  html += '<div class="ctx-separator"></div>';
  html += '<button class="ctx-item danger" data-action="delete-col">🗑 Delete Column</button>';

  menu.innerHTML = html;
  menu.classList.add('visible');

  // Position
  const mx = e.clientX;
  const my = e.clientY;
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  menu.style.left = (mx + mw > window.innerWidth ? mx - mw : mx) + 'px';
  menu.style.top = (my + mh > window.innerHeight ? my - mh : my) + 'px';

  // Bind actions
  menu.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'rename') {
        const colEl = document.querySelector(`.column[data-column-id="${colId}"]`);
        const nameEl = colEl ? colEl.querySelector('.column-name') : null;
        if (nameEl) {
          nameEl.contentEditable = 'true';
          nameEl.classList.add('editing');
          nameEl.focus();
          const range = document.createRange();
          range.selectNodeContents(nameEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      else if (action === 'move-left') moveColumn(colId, -1);
      else if (action === 'move-right') moveColumn(colId, 1);
      else if (action === 'set-color') setColumnColor(colId, btn.dataset.color);
      else if (action === 'delete-col') deleteColumn(colId);
      hideContextMenu();
    });
  });
}

function moveColumn(colId, direction) {
  const idx = board.columns.findIndex(c => c.id === colId);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= board.columns.length) return;
  
  const temp = board.columns[idx];
  board.columns[idx] = board.columns[targetIdx];
  board.columns[targetIdx] = temp;
  
  board.columns.forEach((c, i) => c.order = i);
  
  saveBoard();
  renderBoard();
}

function setColumnColor(colId, colorName) {
  const col = board.columns.find(c => c.id === colId);
  if (!col) return;
  col.color = colorName;
  saveBoard();
  renderBoard();
}

function deleteColumn(colId) {
  const col = board.columns.find(c => c.id === colId);
  if (!col) return;
  
  if (board.columns.length <= 1) { alert('Keep at least one column.'); return; }
  const colCards = getCardsForColumn(colId);
  if (colCards.length > 0) {
    const confirmMsg = `The column "${col.name}" contains ${colCards.length} card(s).\n\nAre you sure you want to delete this column and all its cards?`;
    if (!confirm(confirmMsg)) return;
    board.cards = board.cards.filter(c => c.columnId !== colId);
  } else {
    if (!confirm(`Delete empty column "${col.name}"?`)) return;
  }
  
  board.columns = board.columns.filter(c => c.id !== colId);
  board.columns.forEach((c, idx) => c.order = idx);
  
  saveBoard();
  renderBoard();
}

function openArchiveModal() {
  archiveModalOpen = true;
  archiveSearchQuery = '';
  document.getElementById('archive-search-input').value = '';
  renderArchiveList();
  document.getElementById('archive-overlay').style.display = 'flex';
}

function closeArchiveModal() {
  document.getElementById('archive-overlay').style.display = 'none';
  archiveModalOpen = false;
}

function renderArchiveList() {
  const list = document.getElementById('archive-items-list');
  if (!list) return;
  list.innerHTML = '';
  
  const filtered = archive.filter(card => {
    if (!archiveSearchQuery) return true;
    const q = archiveSearchQuery.toLowerCase();
    return card.title.toLowerCase().includes(q) || (card.notes || '').toLowerCase().includes(q);
  });
  
  if (filtered.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px; font-style:italic;">No archived cards found.</div>';
    return;
  }
  
  filtered.forEach(card => {
    const item = document.createElement('div');
    item.className = 'archive-item';
    
    const icon = document.createElement('span');
    icon.style.fontSize = '16px';
    icon.textContent = TYPE_ICONS[card.type] || '📝';
    
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '2px';
    content.style.overflow = 'hidden';
    
    const title = document.createElement('div');
    title.className = 'archive-item-title';
    title.textContent = card.title;
    
    const meta = document.createElement('div');
    meta.className = 'archive-item-meta';
    meta.textContent = `Archived ${relativeTime(card.updatedAt || card.createdAt)}`;
    
    content.appendChild(title);
    content.appendChild(meta);
    
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn btn-ghost btn-sm';
    restoreBtn.style.padding = '4px 8px';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
      restoreCard(card.id);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-ghost btn-sm';
    deleteBtn.style.padding = '4px 8px';
    deleteBtn.style.color = 'var(--priority-high)';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Permanently delete "${card.title}"? This cannot be undone.`)) {
        archive = archive.filter(c => c.id !== card.id);
        saveArchive();
        renderArchiveList();
      }
    });
    
    item.appendChild(icon);
    item.appendChild(content);
    item.appendChild(restoreBtn);
    item.appendChild(deleteBtn);
    
    list.appendChild(item);
  });
}

function restoreCard(cardId) {
  const idx = archive.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const card = archive.splice(idx, 1)[0];
  
  let colExists = board.columns.some(c => c.id === card.columnId);
  if (!colExists) {
    card.columnId = board.columns[0]?.id || '';
  }
  
  const colCards = getCardsForColumn(card.columnId);
  card.order = colCards.length;
  card.updatedAt = Date.now();
  
  board.cards.push(card);
  saveBoard();
  saveArchive();
  renderBoard();
  renderArchiveList();
}

// ═══════════════════════════════════════════════════════════
// QUICK CAPTURE
// ═══════════════════════════════════════════════════════════
function handleQuickCapture() {
  const input = document.getElementById('quick-input');
  const typeSelect = document.getElementById('quick-type-select');
  const title = input.value.trim();
  if (!title) return;

  let type = typeSelect.value;
  if (isUrl(title)) type = 'URL';

  createCard(title, type, board.columns[0].id);
  input.value = '';
  board.meta.lastType = type;
  saveBoard();
}

// ═══════════════════════════════════════════════════════════
// TOOLBAR
// ═══════════════════════════════════════════════════════════
function initToolbar() {
  // Search
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderBoard();
  });

  // Type filters
  document.querySelectorAll('.type-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterType = btn.dataset.type;
      renderBoard();
    });
  });

  // Priority filters
  document.querySelectorAll('.priority-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterPriority = btn.dataset.priority;
      renderBoard();
    });
  });

  // Export
  document.getElementById('export-btn').addEventListener('click', exportBoard);

  // Import
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importBoard);

  // Clear Done
  document.getElementById('clear-done-btn').addEventListener('click', clearDone);
}

function exportBoard() {
  const data = {
    schemaVersion: 1,
    board: board,
    settings: { baseUrl: settings.baseUrl, model: settings.model },
    archive: archive,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'GeneralManager-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBoard(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    if (file.size > GM.MAX_BYTES) throw new Error('Backup exceeds the 700 KB safety limit.');
    const incoming = GM.validateWorkspace(JSON.parse(await file.text()));
    const mode = prompt('Import mode: type MERGE or REPLACE. Cancel to leave your workspace unchanged.', 'MERGE');
    if (mode === null) return;
    if (!['MERGE', 'REPLACE'].includes(mode.trim().toUpperCase())) throw new Error('Choose MERGE or REPLACE.');
    const next = mode.trim().toUpperCase() === 'REPLACE' ? incoming : GM.mergeWorkspaces({ board, archive }, incoming);
    // Show the selected workspace while it is being saved, so retry/export refer
    // to the same data as the pending journal if the cloud write fails.
    board = next.board; archive = next.archive;
    document.getElementById('board-title').value = board.meta.boardTitle;
    renderBoard();
    if (!demoMode) {
      queueWorkspace(currentUser.uid, next.board, next.archive);
      await flushWorkspace(currentUser.uid);
    }
  } catch (err) { alert('Import could not be fully completed or synced. Check the save status and export a backup before leaving: ' + err.message); }
}

function clearDone() {
  const doneCols = board.columns.filter(c => c.name.toUpperCase() === 'DONE');
  let moved = 0;
  for (const col of doneCols) {
    const doneCards = board.cards.filter(c => c.columnId === col.id);
    for (const card of doneCards) {
      archive.push(card);
      moved++;
    }
    board.cards = board.cards.filter(c => c.columnId !== col.id);
  }
  if (moved > 0) {
    saveArchiveImmediate();
    saveBoardImmediate();
    renderBoard();
  }
}

// ═══════════════════════════════════════════════════════════
// AI PANEL
// ═══════════════════════════════════════════════════════════
function initAIPanel() {
  // Toggle
  document.getElementById('ai-toggle-btn').addEventListener('click', toggleAIPanel);
  document.getElementById('ai-close-btn').addEventListener('click', toggleAIPanel);

  // Presets
  document.querySelectorAll('.ai-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('ai-base-url').value = btn.dataset.url;
      saveSettings();
    });
  });

  // API key toggle
  document.getElementById('api-key-toggle').addEventListener('click', () => {
    const input = document.getElementById('ai-api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Save settings on change
  ['ai-base-url', 'ai-api-key', 'ai-model'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
    document.getElementById(id).addEventListener('blur', saveSettings);
  });

  // Test connection
  document.getElementById('ai-test-btn').addEventListener('click', testConnection);

  // AI Actions
  document.querySelectorAll('.ai-action-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAIAction(btn.dataset.action));
  });

  // Custom prompt
  document.getElementById('ai-ask-btn').addEventListener('click', () => {
    const text = document.getElementById('ai-custom-input').value.trim();
    if (!text) return;
    handleAIAction('custom', text);
  });

  // Load settings into fields
  document.getElementById('ai-base-url').value = settings.baseUrl || '';
  document.getElementById('ai-api-key').value = settings.apiKey || '';
  document.getElementById('ai-model').value = settings.model || '';
}

function toggleAIPanel() {
  document.getElementById('ai-panel').classList.toggle('visible');
}

function getBoardContext() {
  const cols = [...board.columns].sort((a, b) => a.order - b.order);
  const context = cols.map(col => ({
    column: col.name,
    cards: getCardsForColumn(col.id).map(c => ({
      title: c.title,
      type: c.type,
      priority: c.priority,
      url: c.url || undefined,
      notes: c.notes ? c.notes.substring(0, 100) : undefined,
      aiModel: c.aiModel || undefined,
      updatedAt: new Date(c.updatedAt).toISOString(),
      checklist: c.subtasks || []
    }))
  }));
  return JSON.stringify(context, null, 2);
}

const AI_PROMPTS = {
  summarize: 'Summarize what this person is working on across all columns in 3-5 sentences.',
  priority: 'Based on ACTIVE and BACKLOG cards, return the top 3 to focus on next. For each: card title + one sentence reason. Be direct.',
  stalled: 'Identify ACTIVE cards with no notes and no URL. These are likely stalled. List them and suggest one unblocking action each.',
  standup: 'Generate a standup: Completed (DONE cards; do not infer a completion date), Today (ACTIVE), Blockers (PARKED). One tight paragraph.'
};

let aiRequestController = null;
function validatedAIEndpoint() {
  let url;
  try { url = new URL(settings.baseUrl); } catch { throw new Error('Enter a complete HTTPS API base URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS endpoint without credentials, query or fragment.');
  return url.href.replace(/\/+$/, '') + '/chat/completions';
}
async function testConnection() {
  saveSettings();
  const status = document.getElementById('ai-status');
  if (!settings.apiKey) {
    status.className = 'ai-status visible error';
    status.textContent = '❌ Configure API key first';
    return;
  }
  status.className = 'ai-status visible';
  status.style.background = 'var(--bg-input)';
  status.style.color = 'var(--text-muted)';
  status.textContent = '🔌 Testing…';

  try {
    const res = await fetch(validatedAIEndpoint(), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5
      })
    });

    if (res.ok) {
      const data = await res.json();
      const model = data.model || settings.model || 'unknown';
      status.className = 'ai-status visible success';
      status.textContent = '✓ Connected — ' + model;
    } else {
      let errMsg = res.status + ': ';
      try {
        const errData = await res.json();
        errMsg += errData.error?.message || res.statusText;
      } catch (e) {
        errMsg += res.statusText;
      }
      status.className = 'ai-status visible error';
      status.textContent = '❌ ' + errMsg;
    }
  } catch (err) {
    status.className = 'ai-status visible error';
    status.textContent = '❌ Network error: ' + err.message;
  }
}

async function handleAIAction(action, customText) {
  saveSettings();
  const responsePane = document.getElementById('ai-response');
  responsePane.classList.add('visible');

  if (!settings.apiKey) {
    responsePane.innerHTML = '<span class="thinking">Configure API key in Settings first</span>';
    return;
  }

  const prompt = action === 'custom' ? customText : AI_PROMPTS[action];
  let endpoint;
  try { endpoint = validatedAIEndpoint(); } catch (err) { responsePane.textContent = err.message; return; }
  if (!confirm('Send titles, URLs, checklist and shortened notes from the entire board to ' + new URL(endpoint).origin + '? This may incur provider charges.')) return;
  if (aiRequestController) aiRequestController.abort();
  aiRequestController = new AbortController();
  const request = aiRequestController;
  const boardContext = getBoardContext();

  const messages = [
    { role: 'system', content: 'You are an AI assistant helping a power user manage their tasks and context. Respond concisely and actionably.' },
    { role: 'user', content: prompt + '\n\nBoard state:\n' + boardContext }
  ];

  responsePane.innerHTML = '<span class="thinking">Thinking…</span>';

  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: messages,
        stream: true
      })
    });

    if (!res.ok) {
      let errMsg = '';
      try {
        const errData = await res.json();
        errMsg = errData.error?.message || res.statusText;
      } catch (e) {
        errMsg = res.statusText;
      }
      responsePane.innerHTML = '<span style="color:var(--priority-high)">❌ ' + res.status + ': ' + escapeHtml(errMsg) + '</span>';
      return;
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson') || contentType.includes('text/plain') || contentType.includes('application/octet-stream')) {
      // Streaming SSE
      responsePane.textContent = '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (request !== aiRequestController || request.signal.aborted) return;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) responsePane.textContent += delta;
            } catch (e) { /* skip malformed chunk */ }
          }
        }
        responsePane.scrollTop = responsePane.scrollHeight;
      }
      if (!responsePane.textContent) responsePane.textContent = '(No response content)';
    } else {
      // Non-streaming JSON fallback
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '(No response content)';
      responsePane.textContent = content;
    }
  } catch (err) {
    if (request !== aiRequestController || request.signal.aborted) return;
    responsePane.innerHTML = '<span style="color:var(--priority-high)">❌ Error: ' + escapeHtml(err.message) + '</span>';
  }
}

// ═══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Close modal on Escape
    if (e.key === 'Escape') {
      if (modalOpen) { closeModal(); return; }
      if (archiveModalOpen) { closeArchiveModal(); return; }
      hideContextMenu();
      return;
    }

    // Don't trigger shortcuts when typing in inputs
    const tag = document.activeElement.tagName;
    const isEditable = document.activeElement.contentEditable === 'true';
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable;

    if (e.key === '/' && !isInput && !modalOpen && !archiveModalOpen) {
      e.preventDefault();
      document.getElementById('quick-input').focus();
      return;
    }

    if ((e.key === 'a' || e.key === 'A') && !isInput && !modalOpen && !archiveModalOpen && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleAIPanel();
      return;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// GLOBAL CLICK HANDLERS
// ═══════════════════════════════════════════════════════════
function initGlobalEvents() {
  // Close context menu on click outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('context-menu');
    if (menu && menu.classList.contains('visible') && !menu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Close modal on overlay click
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Modal buttons
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', saveModal);
  document.getElementById('modal-delete-btn').addEventListener('click', () => {
    if (activeModalCardId && confirm('Delete this card?')) {
      deleteCard(activeModalCardId);
      closeModal();
    }
  });
  document.getElementById('modal-archive-btn').addEventListener('click', () => {
    if (activeModalCardId) {
      archiveCard(activeModalCardId);
      closeModal();
    }
  });

  // Checklist: add subtask button
  document.getElementById('add-subtask-btn').addEventListener('click', () => {
    const input = document.getElementById('new-subtask-input');
    const text = input.value.trim();
    if (!text) return;
    activeModalSubtasks.push({
      id: crypto.randomUUID(),
      text: text,
      done: false
    });
    input.value = '';
    renderChecklist(activeModalSubtasks);
  });
  document.getElementById('new-subtask-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('add-subtask-btn').click();
    }
  });

  // Archive view modal toggles & controls
  document.getElementById('archive-view-btn').addEventListener('click', openArchiveModal);
  document.getElementById('archive-close').addEventListener('click', closeArchiveModal);
  document.getElementById('archive-modal-close-btn').addEventListener('click', closeArchiveModal);
  document.getElementById('archive-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('archive-overlay')) closeArchiveModal();
  });
  document.getElementById('archive-search-input').addEventListener('input', (e) => {
    archiveSearchQuery = e.target.value;
    renderArchiveList();
  });
  document.getElementById('archive-empty-btn').addEventListener('click', () => {
    if (archive.length > 0 && confirm('Permanently delete all archived cards? This cannot be undone.')) {
      archive = [];
      saveArchiveImmediate();
      renderArchiveList();
    }
  });

  // Quick Capture
  document.getElementById('quick-add-btn').addEventListener('click', handleQuickCapture);
  document.getElementById('quick-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickCapture();
    }
  });

  // URL auto-detect in quick input
  document.getElementById('quick-input').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (isUrl(val)) {
      document.getElementById('quick-type-select').value = 'URL';
    }
  });

  // Board title save on blur
  document.getElementById('board-title').addEventListener('blur', saveBoard);
  document.getElementById('board-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (!confirm('Save and sign out of your account?')) return;
    try { await flushWorkspace(currentUser.uid); await signOutUser(); }
    catch (err) { alert('Sign-out paused to protect unsaved changes. Export a backup, then retry. ' + err.message); }
  });
  document.getElementById('retry-save-btn').onclick = () => { if (currentUser) { saveBoard(); flushWorkspace(currentUser.uid).catch(() => {}); } };
  window.addEventListener('beforeunload', e => { if (currentUser && hasPendingWorkspace(currentUser.uid)) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && currentUser) flushWorkspace(currentUser.uid).catch(() => {}); });
  document.addEventListener('keydown', e => {
    const overlay = modalOpen ? document.getElementById('modal-overlay') : archiveModalOpen ? document.getElementById('archive-overlay') : null;
    if (!overlay || e.key !== 'Tab') return;
    const items = [...overlay.querySelectorAll('button,input,select,textarea,a[href]')].filter(el => !el.disabled);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION AND LIFECYCLE
// ═══════════════════════════════════════════════════════════
function initAppUI() {
  document.getElementById('board-title').value = board.meta.boardTitle || 'GeneralManager';

  // Set last-used type
  if (board.meta.lastType) {
    document.getElementById('quick-type-select').value = board.meta.lastType;
  }

  renderBoard();

  if (!listenersInitialized) {
    initToolbar();
    initAIPanel();
    initKeyboard();
    initGlobalEvents();
    listenersInitialized = true;
  }
}

// Session tokens prevent a stale async load from exposing another user's board.
let authEpoch = 0;
onUserChanged(async user => {
  const epoch = ++authEpoch;
  currentUser = user; board = null; archive = [];
  if (aiRequestController) aiRequestController.abort();
  document.getElementById('migration-banner')?.remove();
  document.getElementById('workspace-load-error')?.remove();
  document.getElementById('board-container').replaceChildren();
  closeModal(); closeArchiveModal(); hideContextMenu();
  document.getElementById('ai-response').textContent = '';
  document.getElementById('ai-api-key').value = '';
  if (settings) settings.apiKey = '';
  document.getElementById('user-profile').style.display = user ? 'flex' : 'none';
  document.getElementById('user-email').textContent = user?.email || '';
  document.getElementById('app').inert = true;
  if (!user) return;
  loadSettings();
  try {
    const data = await loadUserData(user.uid);
    if (epoch !== authEpoch) return;
    const recovery = readRecovery(user.uid);
    if (recovery) {
      // Explicit recovery, never silent overwrite of a newer remote workspace.
      if (confirm('Unsynced changes were recovered from this browser. Restore them? Cancel loads the cloud version and keeps the recovery copy.')) {
        board = recovery.board; archive = recovery.archive;
        queueWorkspace(user.uid, board, archive);
      }
    }
    if (!board && data.board) { board = data.board; archive = data.archive; }
    if (!board && hasLocalStorageData()) {
      showMigrationBanner(user.uid, (b, a) => {
        if (epoch !== authEpoch) return;
        board = b; archive = a; document.getElementById('app').inert = false; initAppUI();
      }, () => {
        if (epoch !== authEpoch) return;
        board = createDefaultBoard(); archive = [];
        document.getElementById('app').inert = false; initAppUI(); saveBoard();
      });
      return;
    }
    if (!board) { board = createDefaultBoard(); archive = []; queueWorkspace(user.uid, board, archive); }
    document.getElementById('app').inert = false; initAppUI();
  } catch (err) {
    if (epoch !== authEpoch) return;
    // Never substitute an editable default board after a cloud read failure.
    const error = document.createElement('div'); error.id = 'workspace-load-error'; error.setAttribute('role', 'alert');
    const message = document.createElement('p'); message.textContent = 'Workspace could not be loaded. Your cloud data has not been replaced. ' + err.message;
    const retry = document.createElement('button'); retry.className = 'btn btn-primary'; retry.textContent = 'Reload safely'; retry.onclick = () => location.reload();
    error.append(message, retry); document.body.append(error);
  }
});
if (demoMode) {
  loadSettings(); board = createDefaultBoard(); archive = [];
  board.meta.boardTitle = 'AI work, in one place';
  board.cards[0].title = 'Review the agent’s pull request'; board.cards[0].notes = 'Check the diff, run the tests, then write the handoff.';
  board.cards[1].title = 'Compare evidence for the next experiment'; board.cards[1].url = 'https://example.com/research'; board.cards[1].aiModel = '';
  board.cards[2].title = 'Build a reusable context handoff'; board.cards[2].notes = 'Turn the current decision, sources and next step into one compact brief.';
  board.cards[0].subtasks = [{ id: 'demo-check-1', text: 'Read the diff', done: true }, { id: 'demo-check-2', text: 'Run the regression tests', done: false }];
  document.getElementById('demo-banner').hidden = false;
  initAppUI(); showSaveIndicator('saved', 'Demo · changes reset on reload');
}
