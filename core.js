export const STATES = ['INBOX', 'NOW', 'QUEUE', 'WAITING', 'LATER', 'DONE'];
export const KINDS = ['TASK', 'PROJECT', 'FOLLOWUP', 'IDEA', 'REFERENCE', 'ROUTINE'];
export const PRIORITIES = ['HIGH', 'NORMAL', 'LOW'];
export const EFFORTS = ['QUICK', 'MEDIUM', 'DEEP'];
export const CAPACITY_SLOTS = { LIGHT: 1, NORMAL: 3, FULL: 5 };

const DAY = 86_400_000;

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `gm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDefaultWorkspace(now = Date.now()) {
  return {
    items: [],
    meta: {
      version: 3,
      title: 'General Manager',
      capacityMode: 'NORMAL',
      preferredView: 'desk',
      lastCaptureKind: 'TASK',
      lastOpenedAt: now,
      lastRegroupAt: 0
    }
  };
}

function mapLegacyKind(type) {
  const value = String(type || '').toUpperCase();
  if (value === 'IDEA') return 'IDEA';
  if (value === 'URL') return 'REFERENCE';
  if (value === 'REPO' || value === 'RESEARCH') return 'PROJECT';
  return 'TASK';
}

function mapLegacyPriority(priority) {
  const value = String(priority || '').toUpperCase();
  if (value === 'HIGH') return 'HIGH';
  if (value === 'LOW') return 'LOW';
  return 'NORMAL';
}

function mapLegacyState(name) {
  const value = String(name || '').toUpperCase();
  if (['INBOX', 'BACKLOG'].includes(value)) return 'INBOX';
  if (['NOW', 'ACTIVE'].includes(value)) return 'NOW';
  if (value === 'WAITING') return 'WAITING';
  if (['LATER', 'PARKED'].includes(value)) return 'LATER';
  if (value === 'DONE') return 'DONE';
  return 'QUEUE';
}

function migrateLegacyBoard(input, now = Date.now()) {
  const columns = new Map((input?.columns || []).map(col => [col.id, col.name]));
  const workspace = createDefaultWorkspace(now);
  workspace.meta.title = input?.meta?.boardTitle || 'General Manager';
  workspace.items = (input?.cards || []).map(card => normalizeItem({
    id: card.id,
    title: card.title,
    nextAction: card.nextAction,
    notes: card.notes,
    waitingOn: card.blocker,
    sourceUrl: card.url,
    tool: card.aiModel,
    kind: mapLegacyKind(card.type),
    priority: mapLegacyPriority(card.priority),
    state: mapLegacyState(columns.get(card.columnId)),
    subtasks: card.subtasks,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    completedAt: mapLegacyState(columns.get(card.columnId)) === 'DONE' ? card.updatedAt : null
  }, now));
  return workspace;
}

export function normalizeWorkspace(input, now = Date.now()) {
  if (!input || typeof input !== 'object') return createDefaultWorkspace(now);
  if (Array.isArray(input.cards) || Array.isArray(input.columns)) return migrateLegacyBoard(input, now);
  const workspace = structuredClone(input);
  workspace.items = Array.isArray(workspace.items) ? workspace.items.map(item => normalizeItem(item, now)) : [];
  workspace.meta = { ...(workspace.meta || {}) };
  workspace.meta.version = 3;
  workspace.meta.title = workspace.meta.title || workspace.meta.boardTitle || 'General Manager';
  workspace.meta.capacityMode = CAPACITY_SLOTS[workspace.meta.capacityMode] ? workspace.meta.capacityMode : 'NORMAL';
  workspace.meta.preferredView = ['desk', 'inbox', 'everything', 'sources'].includes(workspace.meta.preferredView) ? workspace.meta.preferredView : 'desk';
  workspace.meta.lastCaptureKind = KINDS.includes(workspace.meta.lastCaptureKind) ? workspace.meta.lastCaptureKind : 'TASK';
  workspace.meta.lastOpenedAt = Number.isFinite(workspace.meta.lastOpenedAt) ? workspace.meta.lastOpenedAt : now;
  workspace.meta.lastRegroupAt = Number.isFinite(workspace.meta.lastRegroupAt) ? workspace.meta.lastRegroupAt : 0;
  return workspace;
}

export function normalizeItem(item = {}, now = Date.now()) {
  const state = STATES.includes(String(item.state || '').toUpperCase()) ? String(item.state).toUpperCase() : 'INBOX';
  const createdAt = Number.isFinite(item.createdAt) ? item.createdAt : now;
  const updatedAt = Number.isFinite(item.updatedAt) ? item.updatedAt : createdAt;
  return {
    ...item,
    id: item.id || makeId(),
    title: String(item.title || 'Untitled').trim(),
    nextAction: String(item.nextAction || '').trim(),
    notes: String(item.notes || ''),
    state,
    kind: KINDS.includes(String(item.kind || '').toUpperCase()) ? String(item.kind).toUpperCase() : 'TASK',
    priority: PRIORITIES.includes(String(item.priority || '').toUpperCase()) ? String(item.priority).toUpperCase() : 'NORMAL',
    effort: EFFORTS.includes(String(item.effort || '').toUpperCase()) ? String(item.effort).toUpperCase() : 'MEDIUM',
    area: String(item.area || '').trim(),
    waitingOn: String(item.waitingOn || '').trim(),
    sourceLabel: String(item.sourceLabel || '').trim(),
    sourceUrl: String(item.sourceUrl || item.url || '').trim(),
    tool: String(item.tool || '').trim(),
    dueAt: item.dueAt || '',
    snoozedUntil: item.snoozedUntil || '',
    pinned: !!item.pinned,
    subtasks: Array.isArray(item.subtasks) ? item.subtasks.map(step => ({
      id: step.id || makeId(),
      text: String(step.text || '').trim(),
      done: !!step.done
    })).filter(step => step.text) : [],
    createdAt,
    updatedAt,
    completedAt: state === 'DONE' ? (Number.isFinite(item.completedAt) ? item.completedAt : updatedAt) : null
  };
}

export function captureItem(workspace, { title, kind = 'TASK', sourceUrl = '', sourceLabel = '', state = 'INBOX' } = {}, now = Date.now()) {
  const item = normalizeItem({ title, kind, sourceUrl, sourceLabel, state, createdAt: now, updatedAt: now }, now);
  workspace.items.push(item);
  workspace.meta.lastCaptureKind = item.kind;
  return item;
}

export function setItemState(workspace, itemId, state, now = Date.now()) {
  const item = workspace.items.find(candidate => candidate.id === itemId);
  if (!item || !STATES.includes(state)) return null;
  item.state = state;
  item.updatedAt = now;
  item.completedAt = state === 'DONE' ? now : null;
  if (state !== 'WAITING') item.waitingOn = item.waitingOn || '';
  return item;
}

export function duplicateItem(workspace, itemId, now = Date.now()) {
  const item = workspace.items.find(candidate => candidate.id === itemId);
  if (!item) return null;
  const copy = normalizeItem({
    ...structuredClone(item),
    id: makeId(),
    title: `${item.title} (copy)`,
    state: item.state === 'DONE' ? 'QUEUE' : item.state,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  }, now);
  workspace.items.push(copy);
  return copy;
}

export function isAvailable(item, now = Date.now()) {
  if (!item.snoozedUntil) return true;
  const wake = Date.parse(item.snoozedUntil);
  return !Number.isFinite(wake) || wake <= now;
}

export function dueInfo(item, now = Date.now()) {
  if (!item.dueAt) return { hasDue: false, overdue: false, ms: Infinity, days: Infinity };
  const due = Date.parse(item.dueAt);
  if (!Number.isFinite(due)) return { hasDue: false, overdue: false, ms: Infinity, days: Infinity };
  const ms = due - now;
  return { hasDue: true, overdue: ms < 0, ms, days: Math.ceil(ms / DAY), timestamp: due };
}

export function staleInfo(item, now = Date.now()) {
  const ageMs = Math.max(0, now - (item.updatedAt || item.createdAt || now));
  const days = Math.floor(ageMs / DAY);
  return { ageMs, days, stale: days >= 3, veryStale: days >= 7 };
}

export function attentionScore(item, now = Date.now()) {
  if (item.state === 'DONE' || item.state === 'LATER' || item.state === 'WAITING' || !isAvailable(item, now)) return -Infinity;
  let score = 0;
  if (item.state === 'NOW') score += 120;
  if (item.state === 'QUEUE') score += 24;
  if (item.pinned) score += 80;
  if (item.priority === 'HIGH') score += 28;
  if (item.priority === 'LOW') score -= 8;
  const due = dueInfo(item, now);
  if (due.hasDue) {
    if (due.overdue) score += 85 + Math.min(25, Math.abs(due.days) * 3);
    else if (due.ms <= DAY) score += 65;
    else if (due.ms <= 3 * DAY) score += 42;
    else if (due.ms <= 7 * DAY) score += 18;
  }
  const stale = staleInfo(item, now);
  if (item.state === 'NOW' && stale.stale) score += 12;
  return score;
}

export function deskItems(workspace, now = Date.now()) {
  const limit = CAPACITY_SLOTS[workspace?.meta?.capacityMode] || 3;
  return workspace.items
    .filter(item => item.state === 'NOW' && isAvailable(item, now))
    .sort((a, b) => attentionScore(b, now) - attentionScore(a, now) || b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function inboxItems(workspace, now = Date.now()) {
  return workspace.items
    .filter(item => item.state === 'INBOX' && isAvailable(item, now))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function waitingItems(workspace) {
  return workspace.items
    .filter(item => item.state === 'WAITING')
    .sort((a, b) => a.updatedAt - b.updatedAt);
}

export function regroupCandidates(workspace, now = Date.now(), limit = 7) {
  const candidates = workspace.items
    .filter(item => item.state !== 'DONE' && isAvailable(item, now))
    .map(item => {
      const due = dueInfo(item, now);
      const stale = staleInfo(item, now);
      let reason = '';
      let score = 0;
      if (due.overdue) { reason = 'Date passed'; score += 100; }
      else if (due.hasDue && due.ms <= DAY) { reason = 'Due soon'; score += 82; }
      else if (item.state === 'NOW' && stale.stale) { reason = `In Now for ${stale.days}d`; score += 72; }
      else if (item.state === 'WAITING' && stale.veryStale) { reason = `Waiting ${stale.days}d`; score += 58; }
      else if (item.state === 'INBOX' && stale.days >= 2) { reason = `Unsorted for ${stale.days}d`; score += 52; }
      else if (item.priority === 'HIGH' && item.state === 'QUEUE') { reason = 'High priority in queue'; score += 44; }
      else if (stale.veryStale && ['QUEUE', 'INBOX'].includes(item.state)) { reason = `Untouched ${stale.days}d`; score += 34; }
      if (item.pinned) score += 25;
      return { item, reason, score };
    })
    .filter(entry => entry.reason)
    .sort((a, b) => b.score - a.score || a.item.updatedAt - b.item.updatedAt)
    .slice(0, limit);
  return candidates;
}

function sourceName(item) {
  if (item.sourceLabel) return item.sourceLabel;
  if (item.tool) return item.tool;
  if (item.sourceUrl) {
    try { return new URL(item.sourceUrl).hostname.replace(/^www\./, ''); }
    catch { return 'Link'; }
  }
  return '';
}

export function sourceGroups(workspace, now = Date.now()) {
  const groups = new Map();
  workspace.items.filter(item => item.state !== 'DONE').forEach(item => {
    const name = sourceName(item);
    if (!name) return;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  });
  return [...groups.entries()].map(([name, items]) => ({
    name,
    count: items.length,
    needsAttention: items.filter(item => attentionScore(item, now) >= 60).length,
    newestAt: Math.max(...items.map(item => item.updatedAt || item.createdAt || 0)),
    items: items.sort((a, b) => b.updatedAt - a.updatedAt)
  })).sort((a, b) => b.needsAttention - a.needsAttention || b.newestAt - a.newestAt);
}

export function briefStats(workspace, now = Date.now()) {
  const unresolved = workspace.items.filter(item => item.state !== 'DONE');
  const doneToday = workspace.items.filter(item => item.state === 'DONE' && item.completedAt && now - item.completedAt < DAY).length;
  return {
    now: workspace.items.filter(item => item.state === 'NOW').length,
    queue: workspace.items.filter(item => item.state === 'QUEUE').length,
    inbox: workspace.items.filter(item => item.state === 'INBOX').length,
    waiting: workspace.items.filter(item => item.state === 'WAITING').length,
    later: workspace.items.filter(item => item.state === 'LATER').length,
    unresolved: unresolved.length,
    doneToday,
    hiddenFromDesk: Math.max(0, unresolved.length - deskItems(workspace, now).length)
  };
}

export function itemMatches(item, query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.nextAction, item.notes, item.area, item.waitingOn, item.sourceLabel, item.sourceUrl, item.tool, item.kind, item.state]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(q));
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

export function itemToHandoff(item) {
  const lines = [
    `# ${item.title}`,
    `State: ${item.state}`,
    `Kind: ${item.kind}`,
    item.area ? `Area: ${item.area}` : '',
    item.nextAction ? `Next action: ${item.nextAction}` : '',
    item.waitingOn ? `Waiting on: ${item.waitingOn}` : '',
    item.dueAt ? `Due: ${item.dueAt}` : '',
    item.sourceLabel ? `Source: ${item.sourceLabel}` : '',
    item.sourceUrl ? `Source URL: ${item.sourceUrl}` : '',
    item.tool ? `Tool / system: ${item.tool}` : '',
    item.notes ? `\nContext:\n${item.notes}` : '',
    item.subtasks?.length ? `\nSteps:\n${item.subtasks.map(step => `- [${step.done ? 'x' : ' '}] ${step.text}`).join('\n')}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}
