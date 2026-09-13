export const TYPES = ['AGENT', 'RESEARCH', 'REPO', 'URL', 'NOTE', 'IDEA'];
export const PRIORITIES = ['HIGH', 'MED', 'LOW'];
export const DEFAULT_COLUMNS = ['INBOX', 'NOW', 'NEXT', 'WAITING', 'LATER', 'DONE'];

export const TYPE_ICONS = {
  AGENT: '🤖', RESEARCH: '🔬', REPO: '📦', URL: '🔗', NOTE: '📝', IDEA: '💡'
};

const DAY = 86_400_000;

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `gm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDefaultBoard() {
  const columns = DEFAULT_COLUMNS.map((name, order) => ({ id: makeId(), name, order }));
  return {
    columns,
    cards: [],
    meta: {
      version: 2,
      boardTitle: 'GeneralManager',
      lastType: 'NOTE',
      lastDestinationName: 'INBOX',
      preferredView: 'focus'
    }
  };
}

export function normalizeBoard(input) {
  const board = input && typeof input === 'object' ? structuredClone(input) : createDefaultBoard();
  board.columns = Array.isArray(board.columns) && board.columns.length ? board.columns : createDefaultBoard().columns;
  board.columns = board.columns.map((col, index) => ({
    id: col.id || makeId(),
    name: String(col.name || `COLUMN ${index + 1}`).trim().toUpperCase(),
    order: Number.isFinite(col.order) ? col.order : index,
    color: col.color || undefined
  })).sort((a, b) => a.order - b.order);
  board.columns.forEach((col, index) => { col.order = index; });

  board.cards = Array.isArray(board.cards) ? board.cards.map(normalizeCard) : [];
  const validColumns = new Set(board.columns.map(col => col.id));
  board.cards.forEach(card => {
    if (!validColumns.has(card.columnId)) card.columnId = board.columns[0].id;
  });

  board.meta = { ...(board.meta || {}) };
  board.meta.version = 2;
  board.meta.boardTitle = board.meta.boardTitle || 'GeneralManager';
  board.meta.lastType = TYPES.includes(board.meta.lastType) ? board.meta.lastType : 'NOTE';
  board.meta.lastDestinationName = board.meta.lastDestinationName || preferredCaptureColumn(board)?.name || board.columns[0].name;
  board.meta.preferredView = board.meta.preferredView === 'board' ? 'board' : 'focus';
  return board;
}

export function normalizeCard(card = {}) {
  const now = Date.now();
  return {
    ...card,
    id: card.id || makeId(),
    type: TYPES.includes(card.type) ? card.type : 'NOTE',
    title: String(card.title || 'Untitled').trim(),
    url: card.url || '',
    notes: card.notes || '',
    nextAction: card.nextAction || '',
    blocker: card.blocker || '',
    priority: PRIORITIES.includes(card.priority) ? card.priority : 'MED',
    aiModel: card.aiModel || '',
    subtasks: Array.isArray(card.subtasks) ? card.subtasks : [],
    order: Number.isFinite(card.order) ? card.order : 0,
    createdAt: Number.isFinite(card.createdAt) ? card.createdAt : now,
    updatedAt: Number.isFinite(card.updatedAt) ? card.updatedAt : now
  };
}

export function preferredCaptureColumn(board) {
  const columns = sortedColumns(board);
  const remembered = columns.find(col => col.name === board?.meta?.lastDestinationName);
  return remembered || columns.find(col => col.name === 'INBOX') || columns[0];
}

export function sortedColumns(board) {
  return [...(board?.columns || [])].sort((a, b) => a.order - b.order);
}

export function cardsForColumn(board, columnId) {
  return (board?.cards || [])
    .filter(card => card.columnId === columnId)
    .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt);
}

export function findColumnByName(board, name) {
  const target = String(name || '').trim().toUpperCase();
  return (board?.columns || []).find(col => col.name.toUpperCase() === target) || null;
}

export function createCard(board, { title, type = 'NOTE', columnId, url = '' }) {
  const destination = board.columns.find(col => col.id === columnId) || preferredCaptureColumn(board);
  const now = Date.now();
  const card = normalizeCard({
    id: makeId(),
    columnId: destination.id,
    type,
    title,
    url,
    order: cardsForColumn(board, destination.id).length,
    createdAt: now,
    updatedAt: now
  });
  board.cards.push(card);
  board.meta.lastType = card.type;
  board.meta.lastDestinationName = destination.name;
  return card;
}

export function moveCard(board, cardId, columnId, targetIndex = null) {
  const card = board.cards.find(item => item.id === cardId);
  const column = board.columns.find(item => item.id === columnId);
  if (!card || !column) return null;
  card.columnId = column.id;
  card.updatedAt = Date.now();
  const siblings = cardsForColumn(board, column.id).filter(item => item.id !== card.id);
  const index = targetIndex == null ? siblings.length : Math.max(0, Math.min(targetIndex, siblings.length));
  siblings.splice(index, 0, card);
  siblings.forEach((item, order) => { item.order = order; });
  return card;
}

export function duplicateCard(board, cardId) {
  const original = board.cards.find(card => card.id === cardId);
  if (!original) return null;
  const now = Date.now();
  const copy = normalizeCard({
    ...structuredClone(original),
    id: makeId(),
    title: `${original.title} (copy)`,
    order: cardsForColumn(board, original.columnId).length,
    createdAt: now,
    updatedAt: now
  });
  board.cards.push(copy);
  return copy;
}

export function archiveCard(board, archive, cardId) {
  const index = board.cards.findIndex(card => card.id === cardId);
  if (index < 0) return null;
  const [card] = board.cards.splice(index, 1);
  archive.push({ ...card, archivedAt: Date.now() });
  return card;
}

export function cardMatches(card, { query = '', type = 'ALL', priority = 'ALL' } = {}) {
  if (type !== 'ALL' && card.type !== type) return false;
  if (priority !== 'ALL' && card.priority !== priority) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [card.title, card.nextAction, card.notes, card.url, card.aiModel, card.blocker]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(q));
}

export function staleInfo(card, now = Date.now()) {
  const age = Math.max(0, now - (card.updatedAt || card.createdAt || now));
  const days = Math.floor(age / DAY);
  return { ageMs: age, days, stale: days >= 3, veryStale: days >= 7 };
}

export function focusColumns(board) {
  const columns = sortedColumns(board);
  const preferred = ['NOW', 'NEXT', 'WAITING'];
  const exact = preferred.map(name => findColumnByName(board, name)).filter(Boolean);
  if (exact.length) return exact;
  return columns.slice(0, Math.min(3, columns.length));
}

export function isLegacyDefaultBoard(board) {
  const names = sortedColumns(board).map(col => col.name.toUpperCase());
  return names.length === 4 && names.join('|') === 'BACKLOG|ACTIVE|PARKED|DONE';
}

export function upgradeLegacyDefaultBoard(board) {
  if (!isLegacyDefaultBoard(board)) return board;
  const [backlog, active, parked, done] = sortedColumns(board);
  backlog.name = 'INBOX';
  active.name = 'NOW';
  parked.name = 'LATER';
  const next = { id: makeId(), name: 'NEXT', order: 2 };
  const waiting = { id: makeId(), name: 'WAITING', order: 3 };
  board.columns = [backlog, active, next, waiting, parked, done];
  board.columns.forEach((col, index) => { col.order = index; });
  board.meta.lastDestinationName = 'INBOX';
  board.meta.preferredView = 'focus';
  return board;
}

export function relativeTime(timestamp, now = Date.now()) {
  const diff = Math.max(0, now - Number(timestamp || now));
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function cardToHandoff(card, columnName = '') {
  const lines = [
    `# ${card.title}`,
    columnName ? `State: ${columnName}` : '',
    `Type: ${card.type}`,
    card.priority ? `Priority: ${card.priority}` : '',
    card.nextAction ? `Next action: ${card.nextAction}` : '',
    card.blocker ? `Blocker / waiting on: ${card.blocker}` : '',
    card.url ? `URL: ${card.url}` : '',
    card.aiModel ? `Model / tool: ${card.aiModel}` : '',
    card.notes ? `\nContext:\n${card.notes}` : '',
    card.subtasks?.length ? `\nChecklist:\n${card.subtasks.map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}
