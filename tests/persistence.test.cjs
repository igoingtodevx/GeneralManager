const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const GM = require('../domain.js');
const fixture = () => ({ board: { columns: [{ id: 'inbox', name: 'INBOX' }], cards: [], meta: { boardTitle: 'Work' } }, archive: [] });
function harness() {
  const documents = new Map(), storage = new Map(); let rejectWrite = false;
  const db = {
    collection: () => ({ doc: uid => ({ collection: () => ({ doc: name => uid + '/' + name }) }) }),
    runTransaction: async fn => {
      const pending = [];
      const result = await fn({ get: async key => ({ exists: documents.has(key), data: () => structuredClone(documents.get(key)) }), set: (key, value) => pending.push([key, structuredClone(value)]) });
      if (rejectWrite && pending.length) throw Error('Write denied');
      pending.forEach(([key, value]) => documents.set(key, value));
      return result;
    }
  };
  const status = {};
  const context = vm.createContext({ db, GM, console, setTimeout: () => 1, clearTimeout: () => {}, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, document: { getElementById: () => status } });
  vm.runInContext(fs.readFileSync(require.resolve('../db.js'), 'utf8'), context);
  return { context, documents, storage, status, reject: () => rejectWrite = true };
}
test('board and archive commit together with a revision', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); h.context.queueWorkspace('a', f.board, []); assert(h.storage.has('gm_recovery_v1_a')); await h.context.flushWorkspace('a'); assert.equal(h.documents.get('a/board').revision, 1); assert(h.documents.has('a/archive')); assert(!h.storage.has('gm_recovery_v1_a')); });
test('failed migration retains BOTH original local copies', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); h.storage.set('gm_board', JSON.stringify(f.board)); h.storage.set('gm_archive', '[]'); h.reject(); await assert.rejects(h.context.importLocalStorageData('a'), /Write denied/); assert(h.storage.has('gm_board')); assert(h.storage.has('gm_archive')); assert(h.storage.has('gm_recovery_v1_a')); assert.equal(h.documents.size, 0); });
test('successful migration clears originals only after commit', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); h.storage.set('gm_board', JSON.stringify(f.board)); h.storage.set('gm_archive', '[]'); await h.context.importLocalStorageData('a'); assert(!h.storage.has('gm_board')); assert(h.documents.has('a/archive')); });
test('stale revision refuses overwrite and keeps recovery', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); h.documents.set('a/board', { ...f.board, revision: 1 }); h.context.queueWorkspace('a', f.board, []); await assert.rejects(h.context.flushWorkspace('a'), /Another session/); assert.equal(h.documents.get('a/board').revision, 1); assert(h.storage.has('gm_recovery_v1_a')); });
test('queued snapshots cannot be changed by later in-memory mutations', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); h.context.queueWorkspace('a', f.board, []); f.board.meta.boardTitle = 'Accidental mutation'; await h.context.flushWorkspace('a'); assert.equal(h.documents.get('a/board').meta.boardTitle, 'Work'); });
test('user recovery keys are isolated', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); await h.context.loadUserData('b'); h.context.queueWorkspace('a', f.board, []); assert.equal(h.context.readRecovery('b'), null); assert(h.context.readRecovery('a')); });
test('invalid data never reaches the write queue', async () => { const h = harness(), f = fixture(); await h.context.loadUserData('a'); f.board.columns = []; assert.throws(() => h.context.queueWorkspace('a', f.board, [])); assert.equal(h.storage.size, 0); });
