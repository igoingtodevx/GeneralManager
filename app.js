import {
  TYPES,
  PRIORITIES,
  TYPE_ICONS,
  createDefaultBoard,
  normalizeBoard,
  normalizeCard,
  preferredCaptureColumn,
  sortedColumns,
  cardsForColumn,
  findColumnByName,
  createCard,
  moveCard,
  duplicateCard,
  archiveCard as archiveCardCore,
  cardMatches,
  staleInfo,
  focusColumns,
  isLegacyDefaultBoard,
  upgradeLegacyDefaultBoard,
  relativeTime,
  cardToHandoff,
  makeId
} from './core.js';

const LS_SETTINGS = 'gm_settings';
const COLUMN_ACCENTS = ['#38bdf8', '#34d399', '#8b5cf6', '#fbbf24', '#94a3b8', '#f472b6', '#fb923c'];

let board = null;
let archive = [];
let currentUser = null;
let activeCardId = null;
let draggedCardId = null;
let searchQuery = '';
let filterType = 'ALL';
let filterPriority = 'ALL';
let commandIndex = 0;
let commandItems = [];
let settings = loadSettings();
let listenersReady = false;

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function toast(message) {
  const region = $('toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function loadSettings() {
  try {
    return { baseUrl: '', apiKey: '', model: '', ...JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}') };
  } catch {
    return { baseUrl: '', apiKey: '', model: '' };
  }
}

function persistSettings() {
  settings = {
    baseUrl: $('ai-base-url')?.value.trim() || '',
    apiKey: $('ai-api-key')?.value.trim() || '',
    model: $('ai-model')?.value.trim() || ''
  };
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

function saveBoard(immediate = false) {
  if (!board || !currentUser) return;
  board.meta.boardTitle = $('board-title')?.value.trim() || board.meta.boardTitle || 'GeneralManager';
  const fn = immediate ? window.saveUserBoardImmediate : window.saveUserBoard;
  if (typeof fn === 'function') fn(currentUser.uid, board);
}

function saveArchive(immediate = false) {
  if (!currentUser) return;
  const fn = immediate ? window.saveUserArchiveImmediate : window.saveUserArchive;
  if (typeof fn === 'function') fn(currentUser.uid, archive);
}

function setView(view, persist = true) {
  if (!board) return;
  const next = view === 'board' ? 'board' : 'focus';
  board.meta.preferredView = next;
  $('focus-view').classList.toggle('hidden', next !== 'focus');
  $('board-view').classList.toggle('hidden', next !== 'board');
  $$('.view-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === next));
  if (persist) saveBoard();
}

function populateDestinationSelects() {
  if (!board) return;
  const columns = sortedColumns(board);
  const capture = $('quick-destination');
  const inspector = $('card-column');
  const remembered = preferredCaptureColumn(board);
  const active = activeCardId ? board.cards.find(card => card.id === activeCardId) : null;

  [capture, inspector].forEach(select => {
    if (!select) return;
    const wanted = select === capture ? remembered?.id : active?.columnId;
    select.replaceChildren(...columns.map(col => {
      const option = document.createElement('option');
      option.value = col.id;
      option.textContent = col.name;
      if (col.id === wanted) option.selected = true;
      return option;
    }));
  });
}

function makeBadge(text, type = '') {
  const span = document.createElement('span');
  span.className = 'badge';
  if (type) span.dataset.type = type;
  span.textContent = text;
  return span;
}

function renderCard(card, { draggable = false } = {}) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.cardId = card.id;
  el.draggable = draggable;
  el.tabIndex = 0;

  const top = document.createElement('div');
  top.className = 'card-top';
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = card.title;
  const priority = document.createElement('span');
  priority.className = 'priority-dot';
  priority.dataset.priority = card.priority;
  priority.title = `Priority: ${card.priority}`;
  top.append(title, priority);
  el.appendChild(top);

  if (card.nextAction) {
    const next = document.createElement('div');
    next.className = 'next-action';
    next.textContent = card.nextAction;
    el.appendChild(next);
  }

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.appendChild(makeBadge(`${TYPE_ICONS[card.type] || '•'} ${card.type}`, card.type));
  if (card.aiModel) meta.appendChild(makeBadge(card.aiModel));
  if (card.subtasks?.length) {
    const done = card.subtasks.filter(item => item.done).length;
    meta.appendChild(makeBadge(`${done}/${card.subtasks.length}`));
  }
  const age = document.createElement('span');
  const stale = staleInfo(card);
  age.className = `card-age${stale.veryStale ? ' very-stale' : stale.stale ? ' stale' : ''}`;
  age.textContent = relativeTime(card.updatedAt);
  age.title = `Updated ${new Date(card.updatedAt).toLocaleString()}`;
  meta.appendChild(age);
  el.appendChild(meta);

  if (card.url) {
    const link = document.createElement('a');
    link.className = 'card-url';
    link.href = card.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = card.url;
    link.addEventListener('click', event => event.stopPropagation());
    el.appendChild(link);
  }

  const open = () => openInspector(card.id);
  el.addEventListener('click', open);
  el.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
  el.addEventListener('contextmenu', event => {
    event.preventDefault();
    showCardContextMenu(event, card.id);
  });

  if (draggable) {
    el.addEventListener('dragstart', event => {
      draggedCardId = card.id;
      el.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
    });
    el.addEventListener('dragend', () => {
      draggedCardId = null;
      el.classList.remove('dragging');
      $$('.drag-over').forEach(node => node.classList.remove('drag-over'));
      $$('.drop-placeholder').forEach(node => node.remove());
    });
  }

  return el;
}

function matchesCurrentFilters(card) {
  return cardMatches(card, { query: searchQuery, type: filterType, priority: filterPriority });
}

function renderFocus() {
  const root = $('focus-view');
  if (!root || !board) return;
  root.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'focus-shell';
  const header = document.createElement('div');
  header.className = 'focus-header';
  const headingWrap = document.createElement('div');
  const heading = document.createElement('h1');
  heading.textContent = 'What matters now';
  const sub = document.createElement('p');
  sub.textContent = 'Resume fast. Keep the active surface small.';
  headingWrap.append(heading, sub);
  header.appendChild(headingWrap);
  shell.appendChild(header);

  if (isLegacyDefaultBoard(board)) {
    const banner = document.createElement('div');
    banner.className = 'legacy-banner';
    const text = document.createElement('span');
    text.textContent = 'Your board still uses the old BACKLOG / ACTIVE / PARKED / DONE defaults.';
    const upgrade = document.createElement('button');
    upgrade.className = 'btn btn-primary btn-sm';
    upgrade.textContent = 'Upgrade workflow';
    upgrade.addEventListener('click', () => {
      upgradeLegacyDefaultBoard(board);
      saveBoard(true);
      renderAll();
      toast('Workflow upgraded. Existing cards were kept.');
    });
    banner.append(text, upgrade);
    shell.appendChild(banner);
  }

  const grid = document.createElement('div');
  grid.className = 'focus-grid';
  const lanes = focusColumns(board);
  lanes.forEach(col => {
    const lane = document.createElement('section');
    lane.className = 'focus-lane';
    lane.dataset.name = col.name.toUpperCase();
    const laneHead = document.createElement('div');
    laneHead.className = 'focus-lane-head';
    const title = document.createElement('h2');
    title.textContent = col.name;
    const allCards = cardsForColumn(board, col.id);
    const visible = allCards.filter(matchesCurrentFilters);
    const count = document.createElement('span');
    count.textContent = String(allCards.length);
    laneHead.append(title, count);
    lane.appendChild(laneHead);
    const list = document.createElement('div');
    list.className = 'focus-list';
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'focus-empty';
      empty.textContent = searchQuery ? 'No matching cards.' : 'Nothing here.';
      list.appendChild(empty);
    } else {
      visible.forEach(card => list.appendChild(renderCard(card)));
    }
    lane.appendChild(list);
    grid.appendChild(lane);
  });
  shell.appendChild(grid);

  const footer = document.createElement('div');
  footer.className = 'focus-footer';
  const openCards = board.cards.filter(card => findColumnByName(board, 'DONE')?.id !== card.columnId).length;
  const stale = board.cards.filter(card => staleInfo(card).stale).length;
  footer.textContent = `${openCards} open · ${stale} stale (3d+) · / capture · ⌘K command palette`;
  shell.appendChild(footer);
  root.appendChild(shell);
}

function renderBoard() {
  const container = $('board-container');
  if (!container || !board) return;
  container.innerHTML = '';

  sortedColumns(board).forEach((col, columnIndex) => {
    const column = document.createElement('section');
    column.className = 'column';
    column.dataset.columnId = col.id;
    column.dataset.columnName = col.name.toUpperCase();
    if (col.color) column.style.setProperty('--column-accent', col.color);
    else if (!['NOW', 'NEXT', 'WAITING', 'INBOX'].includes(col.name.toUpperCase())) {
      column.style.setProperty('--column-accent', COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]);
    }

    const header = document.createElement('div');
    header.className = 'column-header';
    const name = document.createElement('div');
    name.className = 'column-name';
    name.textContent = col.name;
    name.title = 'Double-click to rename';
    name.addEventListener('dblclick', () => beginColumnRename(name, col));
    const count = document.createElement('span');
    count.className = 'column-count';
    count.textContent = String(cardsForColumn(board, col.id).length);
    const menu = document.createElement('button');
    menu.className = 'column-menu';
    menu.textContent = '•••';
    menu.title = 'Column options';
    menu.addEventListener('click', event => {
      event.stopPropagation();
      showColumnContextMenu(event, col.id);
    });
    header.append(name, count, menu);
    column.appendChild(header);

    const body = document.createElement('div');
    body.className = 'column-body';
    body.dataset.columnId = col.id;
    body.addEventListener('dragover', event => handleDragOver(event, body));
    body.addEventListener('dragleave', event => {
      if (!body.contains(event.relatedTarget)) {
        body.classList.remove('drag-over');
        body.querySelector('.drop-placeholder')?.remove();
      }
    });
    body.addEventListener('drop', event => handleDrop(event, body, col.id));

    const visible = cardsForColumn(board, col.id).filter(matchesCurrentFilters);
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'column-empty';
      empty.textContent = searchQuery ? 'No matches' : 'Drop here';
      body.appendChild(empty);
    } else {
      visible.forEach(card => body.appendChild(renderCard(card, { draggable: true })));
    }
    column.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'column-footer';
    const input = document.createElement('input');
    input.className = 'inline-add';
    input.placeholder = '+ Add here';
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      const title = input.value.trim();
      if (!title) return;
      const type = isUrl(title) ? 'URL' : board.meta.lastType || 'NOTE';
      const card = createCard(board, { title, type, columnId: col.id, url: isUrl(title) ? title : '' });
      input.value = '';
      saveBoard();
      renderAll();
      openInspector(card.id);
    });
    footer.appendChild(input);
    column.appendChild(footer);
    container.appendChild(column);
  });

  if (board.columns.length < 10) {
    const add = document.createElement('button');
    add.className = 'add-column';
    add.textContent = '+';
    add.title = 'Add column';
    add.addEventListener('click', addColumn);
    container.appendChild(add);
  }
}

function beginColumnRename(nameEl, col) {
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const finish = () => {
    nameEl.contentEditable = 'false';
    const next = nameEl.textContent.trim().toUpperCase();
    if (next && !board.columns.some(other => other.id !== col.id && other.name.toUpperCase() === next)) col.name = next;
    nameEl.textContent = col.name;
    saveBoard();
    populateDestinationSelects();
    renderAll();
  };
  nameEl.addEventListener('blur', finish, { once: true });
  nameEl.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); nameEl.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); nameEl.textContent = col.name; nameEl.blur(); }
  }, { once: true });
}

function getDropIndex(body, y) {
  const cards = $$('.card:not(.dragging)', body);
  let best = cards.length;
  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) { best = index; break; }
  }
  return best;
}

function handleDragOver(event, body) {
  event.preventDefault();
  body.classList.add('drag-over');
  const index = getDropIndex(body, event.clientY);
  let placeholder = body.querySelector('.drop-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.className = 'drop-placeholder';
  }
  const cards = $$('.card:not(.dragging)', body);
  if (index >= cards.length) body.appendChild(placeholder);
  else body.insertBefore(placeholder, cards[index]);
}

function handleDrop(event, body, columnId) {
  event.preventDefault();
  body.classList.remove('drag-over');
  const targetIndex = getDropIndex(body, event.clientY);
  body.querySelector('.drop-placeholder')?.remove();
  if (!draggedCardId) return;
  moveCard(board, draggedCardId, columnId, targetIndex);
  saveBoard();
  renderAll();
}

function addColumn() {
  const raw = prompt('Column name');
  const name = raw?.trim().toUpperCase();
  if (!name || board.columns.some(col => col.name.toUpperCase() === name)) return;
  board.columns.push({ id: makeId(), name, order: board.columns.length });
  saveBoard();
  renderAll();
}

function showContextMenu(event, items) {
  const menu = $('context-menu');
  menu.innerHTML = '';
  items.forEach(item => {
    if (item === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-sep';
      menu.appendChild(sep);
      return;
    }
    const button = document.createElement('button');
    button.className = `context-item${item.danger ? ' danger' : ''}`;
    button.textContent = item.label;
    button.addEventListener('click', () => {
      hideContextMenu();
      item.run();
    });
    menu.appendChild(button);
  });
  menu.classList.remove('hidden');
  const x = Math.min(event.clientX, window.innerWidth - 210);
  const y = Math.min(event.clientY, window.innerHeight - Math.min(300, menu.scrollHeight + 10));
  menu.style.left = `${Math.max(6, x)}px`;
  menu.style.top = `${Math.max(6, y)}px`;
}

function hideContextMenu() {
  $('context-menu')?.classList.add('hidden');
}

function showCardContextMenu(event, cardId) {
  const card = board.cards.find(item => item.id === cardId);
  if (!card) return;
  showContextMenu(event, [
    { label: 'Open / resume', run: () => openInspector(cardId) },
    { label: 'Copy local handoff', run: () => copyCardHandoff(cardId) },
    { label: 'Duplicate', run: () => { duplicateCard(board, cardId); saveBoard(); renderAll(); } },
    { label: 'Archive', run: () => archiveCard(cardId) },
    'separator',
    { label: 'Delete permanently', danger: true, run: () => deleteCard(cardId) }
  ]);
}

function showColumnContextMenu(event, columnId) {
  const col = board.columns.find(item => item.id === columnId);
  const index = sortedColumns(board).findIndex(item => item.id === columnId);
  if (!col) return;
  const items = [
    { label: 'Rename', run: () => {
      const el = document.querySelector(`.column[data-column-id="${CSS.escape(columnId)}"] .column-name`);
      if (el) beginColumnRename(el, col);
    } }
  ];
  if (index > 0) items.push({ label: 'Move left', run: () => moveColumn(columnId, -1) });
  if (index < board.columns.length - 1) items.push({ label: 'Move right', run: () => moveColumn(columnId, 1) });
  items.push('separator', { label: 'Delete column', danger: true, run: () => deleteColumn(columnId) });
  showContextMenu(event, items);
}

function moveColumn(columnId, direction) {
  const columns = sortedColumns(board);
  const index = columns.findIndex(col => col.id === columnId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= columns.length) return;
  [columns[index], columns[target]] = [columns[target], columns[index]];
  columns.forEach((col, order) => { col.order = order; });
  board.columns = columns;
  saveBoard();
  renderAll();
}

function deleteColumn(columnId) {
  if (board.columns.length <= 1) return toast('Keep at least one column.');
  const col = board.columns.find(item => item.id === columnId);
  if (!col) return;
  const fallback = sortedColumns(board).find(item => item.id !== columnId);
  const affected = board.cards.filter(card => card.columnId === columnId).length;
  if (!confirm(`Delete ${col.name}? ${affected ? `${affected} card(s) will move to ${fallback.name}.` : ''}`)) return;
  board.cards.filter(card => card.columnId === columnId).forEach(card => { card.columnId = fallback.id; card.updatedAt = Date.now(); });
  board.columns = sortedColumns(board).filter(item => item.id !== columnId);
  board.columns.forEach((item, order) => { item.order = order; });
  saveBoard();
  renderAll();
}

function handleQuickCapture() {
  if (!board) return;
  const input = $('quick-input');
  const title = input.value.trim();
  if (!title) return;
  const destinationId = $('quick-destination').value || preferredCaptureColumn(board).id;
  let type = $('quick-type-select').value;
  if (isUrl(title)) type = 'URL';
  const card = createCard(board, { title, type, columnId: destinationId, url: isUrl(title) ? title : '' });
  input.value = '';
  saveBoard();
  renderAll();
  toast(`Captured to ${board.columns.find(col => col.id === card.columnId)?.name || 'workspace'}`);
}

function openInspector(cardId) {
  const card = board?.cards.find(item => item.id === cardId);
  if (!card) return;
  activeCardId = cardId;
  populateDestinationSelects();
  $('card-title').value = card.title;
  $('card-next-action').value = card.nextAction || '';
  $('card-column').value = card.columnId;
  $('card-priority').value = card.priority;
  $('card-type').value = card.type;
  $('card-ai-model').value = card.aiModel || '';
  $('card-url').value = card.url || '';
  $('card-blocker').value = card.blocker || '';
  $('card-notes').value = card.notes || '';
  $('card-timestamps').textContent = `Created ${new Date(card.createdAt).toLocaleString()} · Updated ${relativeTime(card.updatedAt)}`;
  $('ai-card-output').classList.add('hidden');
  $('ai-card-output').replaceChildren();
  renderChecklist(card);
  $('inspector-backdrop').classList.remove('hidden');
  $('inspector').classList.remove('hidden');
  setTimeout(() => $('card-next-action').focus(), 0);
}

function closeInspector() {
  activeCardId = null;
  $('inspector-backdrop').classList.add('hidden');
  $('inspector').classList.add('hidden');
}

function activeCard() {
  return board?.cards.find(card => card.id === activeCardId) || null;
}

function syncInspectorField(field, value) {
  const card = activeCard();
  if (!card) return;
  if (field === 'columnId') {
    if (value !== card.columnId) moveCard(board, card.id, value);
  } else {
    card[field] = value;
    card.updatedAt = Date.now();
  }
  saveBoard();
  renderFocus();
  renderBoard();
  $('inspector-status').textContent = 'Saving…';
  setTimeout(() => { if (activeCardId) $('inspector-status').textContent = 'Autosaved'; }, 700);
}

function renderChecklist(card) {
  const root = $('card-checklist');
  root.innerHTML = '';
  if (!card.subtasks?.length) {
    const empty = document.createElement('div');
    empty.className = 'field-note';
    empty.textContent = 'No checklist. Good — only add one when it helps.';
    root.appendChild(empty);
    return;
  }
  card.subtasks.forEach(subtask => {
    const row = document.createElement('div');
    row.className = `check-item${subtask.done ? ' done' : ''}`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = !!subtask.done;
    check.addEventListener('change', () => {
      subtask.done = check.checked;
      card.updatedAt = Date.now();
      saveBoard();
      renderChecklist(card);
      renderAll();
    });
    const text = document.createElement('span');
    text.textContent = subtask.text;
    const del = document.createElement('button');
    del.className = 'btn btn-quiet btn-sm';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      card.subtasks = card.subtasks.filter(item => item.id !== subtask.id);
      card.updatedAt = Date.now();
      saveBoard();
      renderChecklist(card);
      renderAll();
    });
    row.append(check, text, del);
    root.appendChild(row);
  });
}

function addChecklistItem() {
  const card = activeCard();
  const input = $('check-input');
  const text = input.value.trim();
  if (!card || !text) return;
  card.subtasks ||= [];
  card.subtasks.push({ id: makeId(), text, done: false });
  card.updatedAt = Date.now();
  input.value = '';
  saveBoard();
  renderChecklist(card);
  renderAll();
}

async function copyText(text, success = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(success);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast(success);
  }
}

function copyCardHandoff(cardId = activeCardId) {
  const card = board?.cards.find(item => item.id === cardId);
  if (!card) return;
  const column = board.columns.find(col => col.id === card.columnId);
  copyText(cardToHandoff(card, column?.name || ''), 'Local handoff copied');
}

function archiveCard(cardId = activeCardId) {
  if (!board || !cardId) return;
  archiveCardCore(board, archive, cardId);
  saveBoard();
  saveArchive();
  if (activeCardId === cardId) closeInspector();
  renderAll();
  toast('Archived');
}

function deleteCard(cardId = activeCardId) {
  const card = board?.cards.find(item => item.id === cardId);
  if (!card) return;
  if (!confirm(`Delete “${card.title}” permanently?`)) return;
  board.cards = board.cards.filter(item => item.id !== cardId);
  saveBoard();
  if (activeCardId === cardId) closeInspector();
  renderAll();
}

function openOverlay(id) {
  $(id)?.classList.remove('hidden');
  if (id === 'archive-overlay') renderArchive();
  if (id === 'settings-overlay') renderSettings();
}

function closeOverlay(id) {
  $(id)?.classList.add('hidden');
}

function renderArchive() {
  const root = $('archive-list');
  root.innerHTML = '';
  const q = $('archive-search').value.trim().toLowerCase();
  const cards = archive.filter(card => !q || [card.title, card.notes, card.nextAction].some(value => String(value || '').toLowerCase().includes(q)));
  if (!cards.length) {
    const empty = document.createElement('div');
    empty.className = 'field-note';
    empty.textContent = 'Archive is empty.';
    root.appendChild(empty);
    return;
  }
  cards.sort((a, b) => (b.archivedAt || b.updatedAt) - (a.archivedAt || a.updatedAt)).forEach(card => {
    const row = document.createElement('div');
    row.className = 'archive-item';
    const icon = document.createElement('span');
    icon.textContent = TYPE_ICONS[card.type] || '•';
    const copy = document.createElement('div');
    copy.className = 'archive-copy';
    const title = document.createElement('div');
    title.className = 'archive-title';
    title.textContent = card.title;
    const meta = document.createElement('div');
    meta.className = 'archive-meta';
    meta.textContent = `Archived ${relativeTime(card.archivedAt || card.updatedAt)}`;
    copy.append(title, meta);
    const restore = document.createElement('button');
    restore.className = 'btn btn-sm';
    restore.textContent = 'Restore';
    restore.addEventListener('click', () => restoreCard(card.id));
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (!confirm(`Permanently delete “${card.title}”?`)) return;
      archive = archive.filter(item => item.id !== card.id);
      saveArchive();
      renderArchive();
    });
    row.append(icon, copy, restore, del);
    root.appendChild(row);
  });
}

function restoreCard(cardId) {
  const index = archive.findIndex(card => card.id === cardId);
  if (index < 0) return;
  const [card] = archive.splice(index, 1);
  delete card.archivedAt;
  if (!board.columns.some(col => col.id === card.columnId)) card.columnId = preferredCaptureColumn(board).id;
  card.order = cardsForColumn(board, card.columnId).length;
  card.updatedAt = Date.now();
  board.cards.push(normalizeCard(card));
  saveBoard();
  saveArchive();
  renderArchive();
  renderAll();
  toast('Restored');
}

function renderSettings() {
  settings = loadSettings();
  $('ai-base-url').value = settings.baseUrl || '';
  $('ai-api-key').value = settings.apiKey || '';
  $('ai-model').value = settings.model || '';
  $('ai-status').textContent = '';
}

function stripCodeFence(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

async function callAI(messages, { maxTokens = 900, json = false } = {}) {
  persistSettings();
  if (!settings.apiKey || !settings.baseUrl || !settings.model) throw new Error('Configure base URL, API key and model in Settings first.');
  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = { model: settings.model, messages, temperature: 0.2, max_tokens: maxTokens };
  if (json) body.response_format = { type: 'json_object' };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    let detail = response.statusText;
    try { detail = (await response.json()).error?.message || detail; } catch { /* noop */ }
    throw new Error(`${response.status}: ${detail}`);
  }
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content || '';
}

function cardAIContext(card) {
  const column = board.columns.find(col => col.id === card.columnId);
  return {
    state: column?.name || '',
    title: card.title,
    nextAction: card.nextAction || '',
    blocker: card.blocker || '',
    type: card.type,
    priority: card.priority,
    url: card.url || '',
    modelOrTool: card.aiModel || '',
    notes: card.notes || '',
    checklist: card.subtasks || []
  };
}

function renderAIText(text, copyLabel = 'Copy') {
  const root = $('ai-card-output');
  root.classList.remove('hidden');
  root.replaceChildren();
  const content = document.createElement('div');
  content.textContent = text;
  const copy = document.createElement('button');
  copy.className = 'btn btn-sm';
  copy.style.marginTop = '9px';
  copy.textContent = copyLabel;
  copy.addEventListener('click', () => copyText(text));
  root.append(content, copy);
}

async function runCardAI(action) {
  const card = activeCard();
  if (!card) return;
  const output = $('ai-card-output');
  output.classList.remove('hidden');
  output.textContent = 'Thinking…';
  const context = cardAIContext(card);
  try {
    if (action === 'refine') {
      const text = await callAI([
        { role: 'system', content: 'You refine a single work item. Return ONLY JSON with keys title, nextAction, notes, blocker, type, destination. Preserve facts; do not invent status. Keep notes compact. destination must be one of the provided states.' },
        { role: 'user', content: `Available states: ${sortedColumns(board).map(col => col.name).join(', ')}\n\nCard:\n${JSON.stringify(context, null, 2)}` }
      ], { json: true, maxTokens: 800 });
      const suggestion = JSON.parse(stripCodeFence(text));
      renderRefinePreview(suggestion);
      return;
    }
    if (action === 'route') {
      const text = await callAI([
        { role: 'system', content: 'Choose the best workflow state for this work item. Return ONLY JSON with keys destination and reason. Do not move anything.' },
        { role: 'user', content: `Allowed states: ${sortedColumns(board).map(col => col.name).join(', ')}\n\nCard:\n${JSON.stringify(context, null, 2)}` }
      ], { json: true, maxTokens: 250 });
      const suggestion = JSON.parse(stripCodeFence(text));
      renderRoutePreview(suggestion);
      return;
    }
    const prompt = action === 'resume'
      ? 'Create a compact resume brief for this work item. Use exactly: WHERE IT STANDS, NEXT MOVE, WATCH OUT. Do not invent missing facts.'
      : 'Create a compact handoff for another capable AI agent. Include goal, known context, current state, next action, constraints and open questions. Do not invent facts.';
    const text = await callAI([
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(context, null, 2) }
    ], { maxTokens: action === 'resume' ? 500 : 900 });
    renderAIText(text, action === 'handoff' ? 'Copy AI handoff' : 'Copy brief');
  } catch (error) {
    output.textContent = `AI unavailable: ${error.message}`;
  }
}

function renderRefinePreview(suggestion) {
  const root = $('ai-card-output');
  root.replaceChildren();
  const preview = document.createElement('div');
  preview.className = 'ai-preview';
  const keys = [['title', 'Title'], ['nextAction', 'Next'], ['destination', 'State'], ['blocker', 'Blocker'], ['type', 'Type'], ['notes', 'Notes']];
  keys.forEach(([key, label]) => {
    if (!suggestion[key]) return;
    const row = document.createElement('div');
    row.className = 'ai-preview-row';
    const name = document.createElement('b');
    name.textContent = label;
    const value = document.createElement('span');
    value.textContent = String(suggestion[key]);
    row.append(name, value);
    preview.appendChild(row);
  });
  const apply = document.createElement('button');
  apply.className = 'btn btn-primary btn-sm';
  apply.style.marginTop = '9px';
  apply.textContent = 'Apply suggestion';
  apply.addEventListener('click', () => {
    const card = activeCard();
    if (!card) return;
    if (suggestion.title) card.title = String(suggestion.title).trim();
    if (suggestion.nextAction) card.nextAction = String(suggestion.nextAction).trim();
    if (typeof suggestion.notes === 'string') card.notes = suggestion.notes.trim();
    if (typeof suggestion.blocker === 'string') card.blocker = suggestion.blocker.trim();
    if (TYPES.includes(String(suggestion.type || '').toUpperCase())) card.type = String(suggestion.type).toUpperCase();
    const destination = findColumnByName(board, suggestion.destination);
    if (destination) moveCard(board, card.id, destination.id);
    card.updatedAt = Date.now();
    saveBoard();
    renderAll();
    openInspector(card.id);
    toast('Suggestion applied');
  });
  root.append(preview, apply);
}

function renderRoutePreview(suggestion) {
  const root = $('ai-card-output');
  root.replaceChildren();
  const destination = findColumnByName(board, suggestion.destination);
  const text = document.createElement('div');
  text.textContent = `${suggestion.destination || 'No route'}${suggestion.reason ? ` — ${suggestion.reason}` : ''}`;
  root.appendChild(text);
  if (destination) {
    const move = document.createElement('button');
    move.className = 'btn btn-primary btn-sm';
    move.style.marginTop = '9px';
    move.textContent = `Move to ${destination.name}`;
    move.addEventListener('click', () => {
      const card = activeCard();
      if (!card) return;
      moveCard(board, card.id, destination.id);
      saveBoard();
      renderAll();
      openInspector(card.id);
    });
    root.appendChild(move);
  }
}

async function testAIConnection() {
  $('ai-status').textContent = 'Testing…';
  try {
    const text = await callAI([{ role: 'user', content: 'Reply with exactly: ok' }], { maxTokens: 8 });
    $('ai-status').textContent = `Connected · ${text.trim().slice(0, 40)}`;
  } catch (error) {
    $('ai-status').textContent = error.message;
  }
}

function commandActions() {
  const actions = [
    { icon: '＋', title: 'Capture something', sub: 'Focus the universal capture box', run: () => $('quick-input').focus() },
    { icon: '◎', title: 'Focus view', sub: 'NOW, NEXT and WAITING', run: () => setView('focus') },
    { icon: '▦', title: 'Board view', sub: 'Full workflow board', run: () => setView('board') },
    { icon: '◫', title: 'Open archive', sub: `${archive.length} archived`, run: () => openOverlay('archive-overlay') },
    { icon: '⚙', title: 'Open settings', sub: 'AI provider, import and export', run: () => openOverlay('settings-overlay') },
    { icon: '⇩', title: 'Export workspace', sub: 'Download a JSON backup', run: exportWorkspace }
  ];
  const done = findColumnByName(board, 'DONE');
  if (done && cardsForColumn(board, done.id).length) {
    actions.push({ icon: '✓', title: 'Archive all DONE cards', sub: `${cardsForColumn(board, done.id).length} card(s)`, run: archiveDone });
  }
  return actions;
}

function openCommandPalette(seed = '') {
  if (!board) return;
  $('command-overlay').classList.remove('hidden');
  $('command-input').value = seed;
  commandIndex = 0;
  renderCommandResults();
  setTimeout(() => $('command-input').focus(), 0);
}

function closeCommandPalette() {
  $('command-overlay').classList.add('hidden');
}

function renderCommandResults() {
  const root = $('command-results');
  const q = $('command-input').value.trim().toLowerCase();
  const actionItems = commandActions().filter(item => !q || `${item.title} ${item.sub}`.toLowerCase().includes(q));
  const cardItems = board.cards
    .filter(card => !q || cardMatches(card, { query: q }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, q ? 12 : 6)
    .map(card => {
      const col = board.columns.find(column => column.id === card.columnId);
      return { icon: TYPE_ICONS[card.type] || '•', title: card.title, sub: `${col?.name || ''}${card.nextAction ? ` · ${card.nextAction}` : ''}`, run: () => openInspector(card.id) };
    });
  commandItems = [...actionItems, ...cardItems];
  if (commandIndex >= commandItems.length) commandIndex = 0;
  root.innerHTML = '';
  commandItems.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = `command-result${index === commandIndex ? ' active' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'command-icon';
    icon.textContent = item.icon;
    const copy = document.createElement('span');
    copy.className = 'command-copy';
    const title = document.createElement('div');
    title.className = 'command-title';
    title.textContent = item.title;
    const sub = document.createElement('div');
    sub.className = 'command-sub';
    sub.textContent = item.sub || '';
    copy.append(title, sub);
    button.append(icon, copy);
    button.addEventListener('mouseenter', () => { commandIndex = index; renderCommandResults(); });
    button.addEventListener('click', () => runCommand(index));
    root.appendChild(button);
  });
  if (!commandItems.length) {
    const empty = document.createElement('div');
    empty.className = 'focus-empty';
    empty.textContent = 'No matching actions or cards.';
    root.appendChild(empty);
  }
}

function runCommand(index = commandIndex) {
  const item = commandItems[index];
  if (!item) return;
  closeCommandPalette();
  item.run();
}

function exportWorkspace() {
  if (!board) return;
  const payload = { board, archive, settings: { baseUrl: settings.baseUrl, model: settings.model }, exportedAt: new Date().toISOString(), version: 2 };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GeneralManager-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  toast('Backup exported');
}

function importWorkspace(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.board?.columns || !data.board?.cards) throw new Error('Not a GeneralManager backup.');
      const replace = confirm('OK = replace this workspace. Cancel = merge the backup into it.');
      if (replace) {
        board = normalizeBoard(data.board);
        archive = Array.isArray(data.archive) ? data.archive.map(normalizeCard) : [];
      } else {
        mergeImportedBoard(normalizeBoard(data.board), Array.isArray(data.archive) ? data.archive : []);
      }
      saveBoard(true);
      saveArchive(true);
      closeOverlay('settings-overlay');
      renderAll();
      toast(replace ? 'Workspace replaced' : 'Backup merged');
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function mergeImportedBoard(imported, importedArchive) {
  const columnsByName = new Map(sortedColumns(board).map(col => [col.name.toUpperCase(), col]));
  const importedMap = new Map();
  sortedColumns(imported).forEach(source => {
    let destination = columnsByName.get(source.name.toUpperCase());
    if (!destination) {
      destination = { id: makeId(), name: source.name, order: board.columns.length, color: source.color };
      board.columns.push(destination);
      columnsByName.set(destination.name.toUpperCase(), destination);
    }
    importedMap.set(source.id, destination.id);
  });
  const existingIds = new Set(board.cards.map(card => card.id));
  imported.cards.forEach(raw => {
    const card = normalizeCard(raw);
    if (existingIds.has(card.id)) card.id = makeId();
    card.columnId = importedMap.get(card.columnId) || preferredCaptureColumn(board).id;
    card.order = cardsForColumn(board, card.columnId).length;
    board.cards.push(card);
    existingIds.add(card.id);
  });
  const archiveIds = new Set(archive.map(card => card.id));
  importedArchive.forEach(raw => {
    const card = normalizeCard(raw);
    if (archiveIds.has(card.id)) card.id = makeId();
    archive.push(card);
    archiveIds.add(card.id);
  });
}

function archiveDone() {
  const done = findColumnByName(board, 'DONE');
  if (!done) return;
  const cards = cardsForColumn(board, done.id);
  cards.forEach(card => archiveCardCore(board, archive, card.id));
  saveBoard(true);
  saveArchive(true);
  renderAll();
  toast(`${cards.length} DONE card(s) archived`);
}

function renderAll() {
  if (!board) return;
  $('board-title').value = board.meta.boardTitle || 'GeneralManager';
  $('quick-type-select').value = TYPES.includes(board.meta.lastType) ? board.meta.lastType : 'NOTE';
  populateDestinationSelects();
  renderFocus();
  renderBoard();
  setView(board.meta.preferredView || 'focus', false);
}

function wireStaticListeners() {
  if (listenersReady) return;
  listenersReady = true;

  $$('.view-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $('quick-add-btn').addEventListener('click', handleQuickCapture);
  $('quick-input').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); handleQuickCapture(); }
  });
  $('quick-input').addEventListener('input', event => {
    if (isUrl(event.target.value)) $('quick-type-select').value = 'URL';
  });
  $('quick-type-select').addEventListener('change', event => { if (board) { board.meta.lastType = event.target.value; saveBoard(); } });
  $('quick-destination').addEventListener('change', event => {
    if (!board) return;
    const col = board.columns.find(item => item.id === event.target.value);
    if (col) board.meta.lastDestinationName = col.name;
    saveBoard();
  });

  $('search-input').addEventListener('input', event => {
    searchQuery = event.target.value;
    renderFocus();
    renderBoard();
  });
  $('search-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.value.trim()) openCommandPalette(event.target.value.trim());
  });
  $('board-title').addEventListener('input', () => saveBoard());
  $('board-title').addEventListener('keydown', event => { if (event.key === 'Enter') event.target.blur(); });

  $('settings-btn').addEventListener('click', () => openOverlay('settings-overlay'));
  $('archive-btn').addEventListener('click', () => openOverlay('archive-overlay'));
  $('archive-search').addEventListener('input', renderArchive);
  $('empty-archive-btn').addEventListener('click', () => {
    if (!archive.length || !confirm('Permanently delete the entire archive?')) return;
    archive = [];
    saveArchive(true);
    renderArchive();
  });
  $$('[data-close-overlay]').forEach(btn => btn.addEventListener('click', () => closeOverlay(btn.dataset.closeOverlay)));
  $$('.overlay').forEach(overlay => overlay.addEventListener('mousedown', event => {
    if (event.target === overlay) overlay.classList.add('hidden');
  }));

  $$('[data-ai-preset]').forEach(btn => btn.addEventListener('click', () => {
    $('ai-base-url').value = btn.dataset.aiPreset;
    persistSettings();
  }));
  ['ai-base-url', 'ai-api-key', 'ai-model'].forEach(id => $(id).addEventListener('change', persistSettings));
  $('ai-test-btn').addEventListener('click', testAIConnection);
  $('export-btn').addEventListener('click', exportWorkspace);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', importWorkspace);

  $('inspector-close').addEventListener('click', closeInspector);
  $('inspector-backdrop').addEventListener('click', closeInspector);
  $('copy-handoff-btn').addEventListener('click', () => copyCardHandoff());
  $('duplicate-card-btn').addEventListener('click', () => {
    const card = activeCard();
    if (!card) return;
    const copy = duplicateCard(board, card.id);
    saveBoard();
    renderAll();
    if (copy) openInspector(copy.id);
  });
  $('archive-card-btn').addEventListener('click', () => archiveCard());
  $('delete-card-btn').addEventListener('click', () => deleteCard());

  const fieldBindings = [
    ['card-title', 'title'], ['card-next-action', 'nextAction'], ['card-priority', 'priority'],
    ['card-type', 'type'], ['card-ai-model', 'aiModel'], ['card-url', 'url'], ['card-blocker', 'blocker'], ['card-notes', 'notes']
  ];
  fieldBindings.forEach(([id, field]) => {
    const eventName = ['card-priority', 'card-type'].includes(id) ? 'change' : 'input';
    $(id).addEventListener(eventName, event => syncInspectorField(field, event.target.value));
  });
  $('card-column').addEventListener('change', event => syncInspectorField('columnId', event.target.value));
  $('check-add-btn').addEventListener('click', addChecklistItem);
  $('check-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem(); } });
  $$('[data-ai-action]').forEach(btn => btn.addEventListener('click', () => runCardAI(btn.dataset.aiAction)));

  $('command-input').addEventListener('input', () => { commandIndex = 0; renderCommandResults(); });
  $('command-input').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); commandIndex = Math.min(commandItems.length - 1, commandIndex + 1); renderCommandResults(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); commandIndex = Math.max(0, commandIndex - 1); renderCommandResults(); }
    if (event.key === 'Enter') { event.preventDefault(); runCommand(); }
    if (event.key === 'Escape') closeCommandPalette();
  });

  document.addEventListener('click', event => {
    if (!$('context-menu').contains(event.target)) hideContextMenu();
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommandPalette();
      return;
    }
    if (event.key === 'Escape') {
      hideContextMenu();
      if (!$('command-overlay').classList.contains('hidden')) closeCommandPalette();
      else if (!$('inspector').classList.contains('hidden')) closeInspector();
      else $$('.overlay:not(.hidden)').forEach(node => node.classList.add('hidden'));
      return;
    }
    if (!typing && event.key === '/') { event.preventDefault(); $('quick-input').focus(); }
    if (!typing && event.key.toLowerCase() === 'f') setView('focus');
    if (!typing && event.key.toLowerCase() === 'b') setView('board');
  });

  $('logout-btn').addEventListener('click', () => {
    if (confirm('Sign out?')) window.signOutUser?.();
  });
}

wireStaticListeners();

window.onUserChanged?.(async user => {
  currentUser = user;
  if (!user) {
    board = null;
    archive = [];
    activeCardId = null;
    $('user-profile').style.display = 'none';
    $('focus-view').innerHTML = '';
    $('board-container').innerHTML = '';
    closeInspector();
    return;
  }

  $('user-email').textContent = user.email || '';
  $('user-email').title = user.email || '';
  $('user-profile').style.display = 'flex';
  settings = loadSettings();

  const startWorkspace = (rawBoard, rawArchive = []) => {
    board = normalizeBoard(rawBoard || createDefaultBoard());
    archive = Array.isArray(rawArchive) ? rawArchive.map(card => ({ ...normalizeCard(card), archivedAt: card.archivedAt })) : [];
    renderAll();
  };

  try {
    const data = await window.loadUserData(user.uid);
    if (data.board) {
      startWorkspace(data.board, data.archive || []);
      return;
    }

    if (window.hasLocalStorageData?.()) {
      window.showMigrationBanner?.(user.uid, (migratedBoard, migratedArchive) => {
        startWorkspace(migratedBoard, migratedArchive);
        saveBoard(true);
        saveArchive(true);
      }, () => {
        startWorkspace(createDefaultBoard(), []);
        saveBoard(true);
        saveArchive(true);
      });
      return;
    }

    startWorkspace(createDefaultBoard(), []);
    await Promise.all([
      window.saveUserBoardImmediate(user.uid, board),
      window.saveUserArchiveImmediate(user.uid, archive)
    ]);
  } catch (error) {
    console.error('Failed to load GeneralManager workspace:', error);
    startWorkspace(createDefaultBoard(), []);
    toast('Could not load cloud data. Showing a temporary empty workspace.');
  }
});
