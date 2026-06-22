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
  if (board) {
    board.meta.boardTitle = document.getElementById('board-title').value || 'GeneralManager';
    if (currentUser) {
      saveUserBoard(currentUser.uid, board);
    }
  }
}

function saveBoardImmediate() {
  if (board) {
    board.meta.boardTitle = document.getElementById('board-title').value || 'GeneralManager';
    if (currentUser) {
      saveUserBoardImmediate(currentUser.uid, board);
    }
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) { settings = JSON.parse(raw); return; }
  } catch (e) { /* reset */ }
  settings = { baseUrl: '', apiKey: '', model: '' };
}

function saveSettings() {
  settings.baseUrl = document.getElementById('ai-base-url').value;
  settings.apiKey = document.getElementById('ai-api-key').value;
  settings.model = document.getElementById('ai-model').value;
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

function saveArchive() {
  if (currentUser) {
    saveUserArchive(currentUser.uid, archive);
  }
}

function saveArchiveImmediate() {
  if (currentUser) {
    saveUserArchiveImmediate(currentUser.uid, archive);
  }
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
  if (card.url) {
    const urlLink = document.createElement('a');
    urlLink.className = 'card-url';
    urlLink.href = card.url;
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
    ...orig,
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
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
  activeModalCardId = null;
  modalOpen = false;
}

function saveModal() {
  const card = board.cards.find(c => c.id === activeModalCardId);
  if (!card) return;

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

function importBoard(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.board || !data.board.columns || !data.board.cards) {
        alert('Invalid GeneralManager backup file.');
        return;
      }
      const mode = confirm('Click OK to REPLACE your board, or Cancel to MERGE with existing data.');
      if (mode) {
        // Replace
        board = data.board;
        if (data.archive) archive = data.archive;
      } else {
        // Merge
        const existingColNames = new Set(board.columns.map(c => c.name));
        for (const col of data.board.columns) {
          if (!existingColNames.has(col.name)) {
            col.order = board.columns.length;
            board.columns.push(col);
            existingColNames.add(col.name);
          }
        }
        const existingCardIds = new Set(board.cards.map(c => c.id));
        for (const card of data.board.cards) {
          if (!existingCardIds.has(card.id)) {
            // Map to existing column by name
            const srcCol = data.board.columns.find(c => c.id === card.columnId);
            if (srcCol) {
              const destCol = board.columns.find(c => c.name === srcCol.name);
              if (destCol) card.columnId = destCol.id;
              else card.columnId = board.columns[0].id;
            }
            board.cards.push(card);
          }
        }
        if (data.archive) {
          const existingArchiveIds = new Set(archive.map(c => c.id));
          for (const ac of data.archive) {
            if (!existingArchiveIds.has(ac.id)) archive.push(ac);
          }
        }
      }
      saveBoardImmediate();
      saveArchiveImmediate();
      renderBoard();
      document.getElementById('board-title').value = board.meta.boardTitle;
    } catch (err) {
      alert('Failed to parse JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
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
  const cols = board.columns.sort((a, b) => a.order - b.order);
  const context = cols.map(col => ({
    column: col.name,
    cards: getCardsForColumn(col.id).map(c => ({
      title: c.title,
      type: c.type,
      priority: c.priority,
      url: c.url || undefined,
      notes: c.notes ? c.notes.substring(0, 100) : undefined,
      aiModel: c.aiModel || undefined
    }))
  }));
  return JSON.stringify(context, null, 2);
}

const AI_PROMPTS = {
  summarize: 'Summarize what this person is working on across all columns in 3-5 sentences.',
  priority: 'Based on ACTIVE and BACKLOG cards, return the top 3 to focus on next. For each: card title + one sentence reason. Be direct.',
  stalled: 'Identify ACTIVE cards with no notes and no URL. These are likely stalled. List them and suggest one unblocking action each.',
  standup: 'Generate a standup: Yesterday (DONE cards), Today (ACTIVE), Blockers (PARKED). One tight paragraph.'
};

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
    const res = await fetch(settings.baseUrl + '/chat/completions', {
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
  const boardContext = getBoardContext();

  const messages = [
    { role: 'system', content: 'You are an AI assistant helping a power user manage their tasks and context. Respond concisely and actionably.' },
    { role: 'user', content: prompt + '\n\nBoard state:\n' + boardContext }
  ];

  responsePane.innerHTML = '<span class="thinking">Thinking…</span>';

  try {
    const res = await fetch(settings.baseUrl + '/chat/completions', {
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
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Sign out of your account?')) {
      signOutUser();
    }
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

// Wire up auth state change to app state mapping
onUserChanged(async (user) => {
  currentUser = user;
  if (user) {
    // Show email and logout button
    const emailEl = document.getElementById('user-email');
    if (emailEl) {
      emailEl.textContent = user.email;
      emailEl.title = user.email;
    }
    const profileEl = document.getElementById('user-profile');
    if (profileEl) {
      profileEl.style.display = 'flex';
    }

    // Load settings from localStorage (remains local)
    loadSettings();

    try {
      const data = await loadUserData(user.uid);
      if (data.board) {
        board = data.board;
        archive = data.archive || [];
      } else {
        // No board in Firestore. Check for migration
        if (hasLocalStorageData()) {
          showMigrationBanner(user.uid, (migratedBoard, migratedArchive) => {
            board = migratedBoard;
            archive = migratedArchive;
            initAppUI();
          }, () => {
            // Dismissed / skip migration
            board = createDefaultBoard();
            archive = [];
            saveBoardImmediate();
            saveArchiveImmediate();
            initAppUI();
          });
          return; // Wait for banner interaction
        } else {
          // Fresh board
          board = createDefaultBoard();
          archive = [];
          await Promise.all([
            saveUserBoardImmediate(user.uid, board),
            saveUserArchiveImmediate(user.uid, archive)
          ]);
        }
      }
      initAppUI();
    } catch (err) {
      console.error("Error loading user workspace:", err);
      // Fallback
      board = createDefaultBoard();
      archive = [];
      initAppUI();
    }
  } else {
    // Logged out
    board = null;
    archive = [];
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = '';
    const profileEl = document.getElementById('user-profile');
    if (profileEl) profileEl.style.display = 'none';
    const container = document.getElementById('board-container');
    if (container) container.innerHTML = '';
  }
});
