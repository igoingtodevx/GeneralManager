import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultWorkspace,
  normalizeWorkspace,
  captureItem,
  setItemState,
  deskItems,
  regroupCandidates,
  sourceGroups,
  briefStats,
  itemToHandoff
} from '../core.js';

const DAY = 86_400_000;

test('fresh workspace starts calm and finite', () => {
  const workspace = createDefaultWorkspace(1000);
  assert.equal(workspace.meta.version, 3);
  assert.equal(workspace.meta.capacityMode, 'NORMAL');
  assert.equal(workspace.meta.preferredView, 'desk');
  assert.deepEqual(workspace.items, []);
});

test('legacy board migrates into universal items without losing context', () => {
  const workspace = normalizeWorkspace({
    columns: [
      { id: 'a', name: 'ACTIVE', order: 0 },
      { id: 'b', name: 'PARKED', order: 1 }
    ],
    cards: [{
      id: 'c', columnId: 'a', title: 'Ship client thing', type: 'REPO', priority: 'HIGH',
      nextAction: 'Run final check', notes: 'Keep this context', url: 'https://example.com',
      createdAt: 1, updatedAt: 2, subtasks: []
    }],
    meta: { boardTitle: 'Old GM' }
  }, 100);
  assert.equal(workspace.meta.title, 'Old GM');
  assert.equal(workspace.items[0].state, 'NOW');
  assert.equal(workspace.items[0].kind, 'PROJECT');
  assert.equal(workspace.items[0].nextAction, 'Run final check');
  assert.equal(workspace.items[0].sourceUrl, 'https://example.com');
});

test('capture is frictionless and triage is explicit', () => {
  const workspace = createDefaultWorkspace(1000);
  const item = captureItem(workspace, { title: 'Call landlord', kind: 'FOLLOWUP' }, 2000);
  assert.equal(item.state, 'INBOX');
  assert.equal(workspace.meta.lastCaptureKind, 'FOLLOWUP');
  setItemState(workspace, item.id, 'NOW', 3000);
  assert.equal(item.state, 'NOW');
  assert.equal(item.updatedAt, 3000);
});

test('desk capacity is a hard attention budget, not a backlog view', () => {
  const workspace = createDefaultWorkspace(0);
  workspace.meta.capacityMode = 'LIGHT';
  captureItem(workspace, { title: 'A', state: 'QUEUE' }, 10);
  captureItem(workspace, { title: 'B', state: 'NOW' }, 20);
  captureItem(workspace, { title: 'C', state: 'QUEUE' }, 30);
  const desk = deskItems(workspace, 40);
  assert.equal(desk.length, 1);
  assert.equal(desk[0].title, 'B');
});

test('queue stays out of the active desk even when capacity is available', () => {
  const workspace = createDefaultWorkspace(0);
  workspace.meta.capacityMode = 'FULL';
  captureItem(workspace, { title: 'Active', state: 'NOW' }, 10);
  captureItem(workspace, { title: 'Possible next', state: 'QUEUE' }, 20);
  assert.deepEqual(deskItems(workspace, 30).map(item => item.title), ['Active']);
});

test('regroup surfaces only meaningful re-entry decisions', () => {
  const now = 20 * DAY;
  const workspace = createDefaultWorkspace(now);
  const staleNow = captureItem(workspace, { title: 'Stale active', state: 'NOW' }, now - 8 * DAY);
  staleNow.updatedAt = now - 8 * DAY;
  const freshQueue = captureItem(workspace, { title: 'Fresh queue', state: 'QUEUE' }, now - 1_000);
  const oldWaiting = captureItem(workspace, { title: 'Old wait', state: 'WAITING' }, now - 10 * DAY);
  oldWaiting.updatedAt = now - 10 * DAY;
  const entries = regroupCandidates(workspace, now);
  assert.deepEqual(entries.map(entry => entry.item.title), ['Stale active', 'Old wait']);
  assert.equal(entries.some(entry => entry.item.id === freshQueue.id), false);
});

test('source groups batch systems below the attention layer', () => {
  const workspace = createDefaultWorkspace(0);
  captureItem(workspace, { title: 'Run 1', state: 'QUEUE', sourceLabel: 'Hermes' }, 10);
  captureItem(workspace, { title: 'Run 2', state: 'QUEUE', sourceLabel: 'Hermes' }, 20);
  captureItem(workspace, { title: 'Mail', state: 'WAITING', sourceLabel: 'Gmail' }, 30);
  const groups = sourceGroups(workspace, 40);
  assert.equal(groups.find(group => group.name === 'Hermes').count, 2);
  assert.equal(groups.find(group => group.name === 'Gmail').count, 1);
});

test('brief and handoff remain deterministic without AI', () => {
  const workspace = createDefaultWorkspace(0);
  const item = captureItem(workspace, { title: 'General Manager', state: 'NOW' }, 100);
  item.nextAction = 'Test re-entry';
  item.area = 'Product';
  const stats = briefStats(workspace, 200);
  assert.equal(stats.now, 1);
  const text = itemToHandoff(item);
  assert.match(text, /Next action: Test re-entry/);
  assert.match(text, /Area: Product/);
});
