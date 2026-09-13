import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultBoard,
  normalizeBoard,
  createCard,
  moveCard,
  duplicateCard,
  isLegacyDefaultBoard,
  upgradeLegacyDefaultBoard,
  staleInfo,
  cardToHandoff
} from '../core.js';

test('fresh board uses resume-first workflow states', () => {
  const board = createDefaultBoard();
  assert.deepEqual(board.columns.map(c => c.name), ['INBOX', 'NOW', 'NEXT', 'WAITING', 'LATER', 'DONE']);
  assert.equal(board.meta.lastDestinationName, 'INBOX');
  assert.equal(board.meta.preferredView, 'focus');
});

test('normalization preserves custom columns and adds vNext card fields', () => {
  const board = normalizeBoard({
    columns: [{ id: 'x', name: 'custom', order: 0 }],
    cards: [{ id: 'c', columnId: 'x', title: 'Hello', type: 'NOTE', priority: 'MED', createdAt: 1, updatedAt: 2 }],
    meta: {}
  });
  assert.equal(board.columns[0].name, 'CUSTOM');
  assert.equal(board.cards[0].nextAction, '');
  assert.equal(board.meta.version, 2);
});

test('capture remembers destination and movement keeps ordering coherent', () => {
  const board = createDefaultBoard();
  const now = board.columns.find(c => c.name === 'NOW');
  const card = createCard(board, { title: 'Ship it', columnId: now.id, type: 'AGENT' });
  assert.equal(board.meta.lastDestinationName, 'NOW');
  const next = board.columns.find(c => c.name === 'NEXT');
  moveCard(board, card.id, next.id);
  assert.equal(card.columnId, next.id);
  assert.equal(card.order, 0);
});

test('duplicate makes an independent card', () => {
  const board = createDefaultBoard();
  const card = createCard(board, { title: 'Research', type: 'RESEARCH' });
  card.subtasks = [{ id: 's1', text: 'Read', done: false }];
  const copy = duplicateCard(board, card.id);
  copy.subtasks[0].done = true;
  assert.notEqual(copy.id, card.id);
  assert.equal(card.subtasks[0].done, false);
});

test('legacy default board upgrades only when exact legacy shape matches', () => {
  const board = normalizeBoard({
    columns: ['BACKLOG', 'ACTIVE', 'PARKED', 'DONE'].map((name, order) => ({ id: name, name, order })),
    cards: [],
    meta: {}
  });
  assert.equal(isLegacyDefaultBoard(board), true);
  upgradeLegacyDefaultBoard(board);
  assert.deepEqual(board.columns.map(c => c.name), ['INBOX', 'NOW', 'NEXT', 'WAITING', 'LATER', 'DONE']);
});

test('stale signals and local handoff are deterministic', () => {
  const now = 10 * 86_400_000;
  const info = staleInfo({ updatedAt: now - 8 * 86_400_000 }, now);
  assert.equal(info.veryStale, true);
  const text = cardToHandoff({ title: 'GM', type: 'AGENT', priority: 'HIGH', nextAction: 'Test it', notes: 'Context', subtasks: [] }, 'NOW');
  assert.match(text, /Next action: Test it/);
  assert.match(text, /State: NOW/);
});
