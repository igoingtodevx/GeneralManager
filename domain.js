/* Shared, dependency-free boundary for imported and persisted workspaces. */
(function (root) {
  'use strict';
  const MAX_BYTES = 700000;
  const types = ['AGENT', 'RESEARCH', 'REPO', 'URL', 'NOTE', 'IDEA'];
  const priorities = ['HIGH', 'MED', 'LOW'];
  const colors = ['PURPLE', 'BLUE', 'GREEN', 'YELLOW', 'PINK', 'GRAY'];
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function text(value, name, max, fallback = '') {
    if (value === undefined) return fallback;
    assert(typeof value === 'string' && value.length <= max, name + ' is invalid or too long.');
    return value;
  }
  function id(value) {
    assert(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value), 'Invalid identifier.');
    return value;
  }
  function safeUrl(value) {
    if (!value) return '';
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function validateWorkspace(input) {
    assert(input && typeof input === 'object', 'Expected a workspace object.');
    assert(input.schemaVersion === undefined || input.schemaVersion === 1, 'Unsupported backup version.');
    assert(new TextEncoder().encode(JSON.stringify(input)).length <= MAX_BYTES, 'Workspace exceeds the 700 KB safety limit.');
    const b = input.board;
    assert(b && Array.isArray(b.columns) && b.columns.length >= 1 && b.columns.length <= 8, 'A board needs 1–8 columns.');
    assert(Array.isArray(b.cards) && b.cards.length <= 1000, 'Invalid card collection (maximum 1000).');
    const ids = new Set();
    const columns = b.columns.map((c, order) => {
      const key = id(c.id); assert(!ids.has(key), 'Duplicate column identifier.'); ids.add(key);
      const name = text(c.name, 'Column name', 80).trim(); assert(name, 'Column name is empty.');
      return { id: key, name, order, ...(colors.includes(c.color) ? { color: c.color } : {}) };
    });
    const cardIds = new Set();
    function card(c, order, archived) {
      const key = id(c.id); assert(!cardIds.has(key), 'Duplicate card identifier.'); cardIds.add(key);
      const columnId = id(c.columnId);
      assert(archived || ids.has(columnId), 'A card refers to a missing column.');
      assert(types.includes(c.type) && priorities.includes(c.priority), 'Invalid card type or priority.');
      const title = text(c.title, 'Card title', 500).trim(); assert(title, 'Card title is empty.');
      const url = text(c.url, 'URL', 4096); assert(!url || safeUrl(url), 'Only HTTP(S) card URLs are allowed.');
      const subtasks = c.subtasks || []; assert(Array.isArray(subtasks) && subtasks.length <= 100, 'Invalid checklist.');
      const subIds = new Set();
      for (const timestamp of ['createdAt', 'updatedAt']) assert(Number.isFinite(c[timestamp]) && c[timestamp] >= 0, 'Invalid timestamp.');
      return { id: key, columnId, title, type: c.type, priority: c.priority, url, notes: text(c.notes, 'Notes', 20000), aiModel: text(c.aiModel, 'Model', 200), order, createdAt: c.createdAt, updatedAt: c.updatedAt,
        subtasks: subtasks.map(s => { const key = id(s.id); assert(!subIds.has(key), 'Duplicate checklist identifier.'); subIds.add(key); assert(typeof s.done === 'boolean', 'Invalid checklist state.'); return { id: key, text: text(s.text, 'Checklist text', 1000), done: s.done }; }) };
    }
    const archived = input.archive === undefined ? [] : input.archive;
    assert(Array.isArray(archived) && archived.length <= 1000, 'Invalid archive (maximum 1000).');
    const cards = [...b.cards].sort((a, b) => (a.order || 0) - (b.order || 0)).map((c, i) => card(c, i, false));
    return { schemaVersion: 1, board: { columns, cards, meta: { boardTitle: text(b.meta?.boardTitle, 'Board title', 120, 'GeneralManager'), lastType: types.includes(b.meta?.lastType) ? b.meta.lastType : 'NOTE' } }, archive: archived.map((c, i) => card(c, i, true)) };
  }
  function mergeWorkspaces(current, incoming) {
    const base = validateWorkspace(current), added = validateWorkspace(incoming);
    const map = new Map();
    for (const col of added.board.columns) {
      let dest = base.board.columns.find(c => c.name === col.name);
      if (!dest) {
        assert(!base.board.columns.some(c => c.id === col.id), 'Column identifier collision.');
        dest = { ...col, order: base.board.columns.length }; base.board.columns.push(dest);
      }
      map.set(col.id, dest.id);
    }
    const seen = new Set([...base.board.cards, ...base.archive].map(c => c.id));
    for (const c of added.board.cards) if (!seen.has(c.id)) { base.board.cards.push({ ...c, columnId: map.get(c.columnId), order: base.board.cards.length }); seen.add(c.id); }
    for (const c of added.archive) if (!seen.has(c.id)) { base.archive.push({ ...c, columnId: map.get(c.columnId) || c.columnId }); seen.add(c.id); }
    return validateWorkspace(base);
  }
  const api = { MAX_BYTES, safeUrl, validateWorkspace, mergeWorkspaces };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GM = api;
})(globalThis);
