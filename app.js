import {
  STATES,
  KINDS,
  PRIORITIES,
  EFFORTS,
  CAPACITY_SLOTS,
  createDefaultWorkspace,
  normalizeWorkspace,
  normalizeItem,
  captureItem,
  setItemState,
  duplicateItem,
  deskItems,
  inboxItems,
  waitingItems,
  regroupCandidates,
  sourceGroups,
  briefStats,
  itemMatches,
  relativeTime,
  itemToHandoff,
  dueInfo,
  staleInfo,
  makeId
} from './core.js';
import { loadUserHarness, saveUserHarness, saveUserHarnessImmediate } from './harness-db.js';

const LS_SETTINGS = 'gm_settings';
const DAY = 86_400_000;
const $ = id => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let workspace = null;
let currentUser = null;
let activeItemId = null;
let currentView = 'desk';
let everythingState = 'ALL';
let commandIndex = 0;
let commandEntries = [];
let settings = loadSettings();
let listenersReady = false;

function toast(message) {
  const region = $('toast-region');
  if (!region) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  region.appendChild(node);
  setTimeout(() => node.remove(), 2600);
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

function saveWorkspace(immediate = false) {
  if (!workspace || !currentUser) return;
  workspace.meta.title = $('board-title')?.value.trim() || workspace.meta.title || 'General Manager';
  const save = immediate ? saveUserHarnessImmediate : saveUserHarness;
  save(currentUser.uid, workspace);
}

function activeItem() {
  return workspace?.items.find(item => item.id === activeItemId) || null;
}

function stateLabel(state) {
  return ({ INBOX: 'Inbox', NOW: 'Now', QUEUE: 'Queue', WAITING: 'Waiting', LATER: 'Later', DONE: 'Done' })[state] || state;
}

function kindLabel(kind) {
  return ({ TASK: 'Task', PROJECT: 'Project', FOLLOWUP: 'Follow-up', IDEA: 'Idea', REFERENCE: 'Reference', ROUTINE: 'Routine' })[kind] || kind;
}

function daypart() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDue(item) {
  const info = dueInfo(item);
  if (!info.hasDue) return null;
  const date = new Date(info.timestamp);
  const text = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (info.overdue) return { text: `Date passed · ${text}`, className: 'overdue' };
  if (info.ms <= DAY) return { text: `Today · ${text}`, className: 'due' };
  if (info.ms <= 3 * DAY) return { text: `Soon · ${text}`, className: 'due' };
  return { text, className: '' };
}

function isTypingTarget(target) {
  return target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function setView(view, persist = true) {
  if (!workspace) return;
  currentView = ['desk', 'inbox', 'everything', 'sources'].includes(view) ? view : 'desk';
  $$('.view').forEach(node => node.classList.add('hidden'));
  $(`${currentView}-view`)?.classList.remove('hidden');
  $$('.nav-tab').forEach(button => button.classList.toggle('active', button.dataset.view === currentView));
  workspace.meta.preferredView = currentView;
  if (persist) saveWorkspace();
  if (currentView === 'inbox') renderInbox();
  if (currentView === 'everything') setTimeout(() => $('everything-search')?.focus(), 0);
}

function renderAll() {
  if (!workspace) return;
  $('board-title').value = workspace.meta.title || 'General Manager';
  renderNav();
  renderDesk();
  renderInbox();
  renderEverything();
  renderSources();
  renderCapacity();
  if (activeItemId && !activeItem()) closeInspector();
}

function renderNav() {
  const count = inboxItems(workspace).length;
  $('inbox-nav-count').textContent = count ? String(count) : '';
}

function renderCapacity() {
  const mode = workspace.meta.capacityMode || 'NORMAL';
  $$('#capacity-switch button').forEach(button => button.classList.toggle('active', button.dataset.capacity === mode));
  $('capacity-copy').textContent = mode === 'LIGHT' ? 'One thing is enough.' : mode === 'FULL' ? 'Five things, still finite.' : 'Three things is enough.';
}

function createPill(text, className = '') {
  const node = document.createElement('span');
  node.className = `pill${className ? ` ${className}` : ''}`;
  node.textContent = text;
  return node;
}

function managerCard(item, index = 0) {
  const card = document.createElement('article');
  card.className = `manager-card${index === 0 ? ' primary' : ''}`;
  card.tabIndex = 0;

  const kicker = document.createElement('div');
  kicker.className = 'card-kicker';
  const left = document.createElement('span');
  left.textContent = item.area || kindLabel(item.kind);
  const right = document.createElement('span');
  right.textContent = stateLabel(item.state);
  kicker.append(left, right);

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.title;

  const next = document.createElement('div');
  next.className = 'card-next';
  next.textContent = item.nextAction || 'Decide the next move';

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.appendChild(createPill(item.effort.toLowerCase()));
  if (item.priority === 'HIGH') meta.appendChild(createPill('high priority'));
  const due = formatDue(item);
  if (due) meta.appendChild(createPill(due.text, due.className));
  if (item.sourceLabel) meta.appendChild(createPill(item.sourceLabel));

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const done = document.createElement('button');
  done.className = 'btn btn-success btn-sm';
  done.textContent = 'Done';
  done.addEventListener('click', event => {
    event.stopPropagation();
    setItemState(workspace, item.id, 'DONE');
    saveWorkspace();
    renderAll();
    toast('Done. Off your desk.');
  });
  const later = document.createElement('button');
  later.className = 'btn btn-quiet btn-sm';
  later.textContent = 'Not now';
  later.addEventListener('click', event => {
    event.stopPropagation();
    setItemState(workspace, item.id, 'LATER');
    saveWorkspace();
    renderAll();
    toast('Parked.');
  });
  actions.append(done, later);

  card.append(kicker, title, next, meta, actions);
  const open = () => openInspector(item.id);
  card.addEventListener('click', open);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
  return card;
}

function renderDesk() {
  $('daypart-label').textContent = `${daypart()} · your desk`;
  const stats = briefStats(workspace);
  const desk = deskItems(workspace);
  const nowRoot = $('desk-now-list');
  nowRoot.replaceChildren();

  if (!desk.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.innerHTML = '<strong>Your desk is clear.</strong> Pull something forward only when it deserves attention.';
    nowRoot.appendChild(empty);
  } else {
    desk.forEach((item, index) => nowRoot.appendChild(managerCard(item, index)));
  }

  const nextRoot = $('desk-next-list');
  nextRoot.replaceChildren();
  const nextCandidate = workspace.items
    .filter(item => item.state === 'QUEUE')
    .sort((a, b) => (b.priority === 'HIGH') - (a.priority === 'HIGH') || b.updatedAt - a.updatedAt)[0];
  if (nextCandidate) {
    const row = document.createElement('button');
    row.className = 'next-candidate';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = nextCandidate.title;
    copy.appendChild(title);
    if (nextCandidate.nextAction) {
      const next = document.createElement('small');
      next.textContent = nextCandidate.nextAction;
      copy.appendChild(next);
    }
    const action = document.createElement('span');
    action.textContent = 'Bring to desk →';
    row.append(copy, action);
    row.addEventListener('click', () => {
      setItemState(workspace, nextCandidate.id, 'NOW');
      saveWorkspace();
      renderAll();
      toast('Moved to your desk.');
    });
    nextRoot.appendChild(row);
  } else {
    const quietNext = document.createElement('div');
    quietNext.className = 'quiet-next';
    quietNext.textContent = 'Nothing is waiting to be pulled forward.';
    nextRoot.appendChild(quietNext);
  }

  const brief = [];
  if (stats.doneToday) brief.push(`${stats.doneToday} finished today`);
  if (stats.inbox) brief.push(`${stats.inbox} waiting in Inbox`);
  if (stats.waiting) brief.push(`${stats.waiting} waiting on something`);
  if (!brief.length) brief.push('Nothing is asking for cleanup');
  $('manager-brief').textContent = brief.join(' · ');

  const attention = regroupCandidates(workspace).slice(0, 4);
  const attentionRoot = $('desk-attention-list');
  attentionRoot.replaceChildren();
  if (!attention.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.innerHTML = '<strong>No cleanup pressure.</strong>Nothing currently needs a regroup decision.';
    attentionRoot.appendChild(empty);
  } else {
    attention.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'attention-row';
      const reason = document.createElement('span');
      reason.className = 'attention-reason';
      reason.textContent = entry.reason;
      const copy = document.createElement('div');
      copy.className = 'attention-copy';
      const title = document.createElement('strong');
      title.textContent = entry.item.title;
      const next = document.createElement('span');
      next.textContent = entry.item.nextAction || `Currently ${stateLabel(entry.item.state)}`;
      copy.append(title, next);
      row.append(reason, copy);
      row.addEventListener('click', () => openInspector(entry.item.id));
      attentionRoot.appendChild(row);
    });
  }

  const hidden = stats.hiddenFromDesk;
  const quiet = [];
  if (stats.waiting) quiet.push(`${stats.waiting} waiting`);
  if (stats.later) quiet.push(`${stats.later} parked for later`);
  if (stats.queue) quiet.push(`${stats.queue} in queue`);
  const root = $('quiet-zone');
  root.innerHTML = hidden
    ? `<strong>${hidden} more unresolved item${hidden === 1 ? '' : 's'} are safely out of sight.</strong> ${quiet.join(' · ')}. Nothing is lost.`
    : '<strong>There is no hidden pile right now.</strong> Everything unresolved fits on the desk.';
}

function renderInbox() {
  if (!workspace) return;
  const items = inboxItems(workspace);
  $('inbox-count').textContent = items.length ? `${items.length} captured` : 'Inbox clear';
  const stage = $('triage-stage');
  stage.replaceChildren();
  $('inbox-tail').textContent = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.innerHTML = '<strong>Inbox clear.</strong>Capture freely. You do not have to maintain emptiness as a streak.';
    stage.appendChild(empty);
    return;
  }

  const item = items[0];
  const card = document.createElement('div');
  card.className = 'triage-card';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${kindLabel(item.kind)} · captured ${relativeTime(item.createdAt)}`;
  const title = document.createElement('h2');
  title.textContent = item.title;
  const context = document.createElement('div');
  context.className = 'triage-context';
  context.textContent = item.notes || item.nextAction || 'No extra context. That is okay.';

  const actions = document.createElement('div');
  actions.className = 'triage-actions';
  [
    ['NOW', 'Now'],
    ['QUEUE', 'Queue'],
    ['WAITING', 'Waiting'],
    ['LATER', 'Later'],
    ['DONE', 'Done']
  ].forEach(([state, label]) => {
    const button = document.createElement('button');
    button.className = state === 'NOW' ? 'btn btn-primary' : 'btn';
    button.textContent = label;
    button.addEventListener('click', () => {
      setItemState(workspace, item.id, state);
      saveWorkspace();
      renderAll();
      if (state === 'WAITING') openInspector(item.id);
    });
    actions.appendChild(button);
  });

  const edit = document.createElement('button');
  edit.className = 'btn btn-quiet btn-sm';
  edit.textContent = 'Open details instead';
  edit.addEventListener('click', () => openInspector(item.id));
  const help = document.createElement('div');
  help.className = 'triage-help';
  help.append(edit);

  card.append(eyebrow, title, context, actions, help);
  stage.appendChild(card);
  if (items.length > 1) $('inbox-tail').textContent = `${items.length - 1} more stay hidden until you decide this one.`;
}

function renderEverything() {
  if (!workspace) return;
  const filterRoot = $('state-filters');
  filterRoot.replaceChildren();
  ['ALL', ...STATES].forEach(state => {
    const button = document.createElement('button');
    button.className = `filter-chip${everythingState === state ? ' active' : ''}`;
    button.textContent = state === 'ALL' ? 'All' : stateLabel(state);
    button.addEventListener('click', () => { everythingState = state; renderEverything(); });
    filterRoot.appendChild(button);
  });

  const query = $('everything-search')?.value || '';
  const items = workspace.items
    .filter(item => everythingState === 'ALL' || item.state === everythingState)
    .filter(item => itemMatches(item, query))
    .sort((a, b) => {
      const doneWeight = (a.state === 'DONE') - (b.state === 'DONE');
      return doneWeight || b.updatedAt - a.updatedAt;
    });

  const root = $('everything-list');
  root.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.innerHTML = '<strong>No matches.</strong>Everything is still where you left it.';
    root.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'everything-row';
    const state = document.createElement('span');
    state.className = 'state-label';
    state.textContent = item.state;
    const copy = document.createElement('div');
    copy.className = 'everything-copy';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const subtitle = document.createElement('span');
    subtitle.textContent = item.nextAction || item.notes || kindLabel(item.kind);
    copy.append(title, subtitle);
    const meta = document.createElement('span');
    meta.className = 'everything-meta';
    meta.textContent = [item.area, item.sourceLabel, relativeTime(item.updatedAt)].filter(Boolean).join(' · ');
    row.append(state, copy, meta);
    row.addEventListener('click', () => openInspector(item.id));
    root.appendChild(row);
  });
}

function renderSources() {
  if (!workspace) return;
  const groups = sourceGroups(workspace);
  const root = $('sources-list');
  root.replaceChildren();
  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.innerHTML = '<strong>No sources connected yet.</strong>That is completely valid. Label an item with a source only when it helps. Later, integrations can feed this layer without taking over the Desk.';
    root.appendChild(empty);
    return;
  }

  groups.forEach(group => {
    const card = document.createElement('article');
    card.className = 'source-card';
    const head = document.createElement('div');
    head.className = 'source-card-head';
    const title = document.createElement('h3');
    title.textContent = group.name;
    const count = document.createElement('span');
    count.className = 'source-count';
    count.textContent = `${group.count} open`;
    head.append(title, count);
    const copy = document.createElement('p');
    copy.textContent = group.needsAttention
      ? `${group.needsAttention} item${group.needsAttention === 1 ? '' : 's'} currently deserve attention. The rest stay below the manager layer.`
      : 'Nothing from this source needs to interrupt you right now.';
    card.append(head, copy);
    card.addEventListener('click', () => {
      setView('everything');
      $('everything-search').value = group.name;
      renderEverything();
    });
    root.appendChild(card);
  });
}

function captureQuick() {
  if (!workspace) return;
  const input = $('quick-input');
  const raw = input.value.trim();
  if (!raw) return;
  const looksLikeUrl = /^https?:\/\//i.test(raw);
  const kind = looksLikeUrl ? 'REFERENCE' : 'TASK';
  captureItem(workspace, { title: raw, kind, sourceUrl: looksLikeUrl ? raw : '' });
  input.value = '';
  saveWorkspace();
  renderAll();
  toast('Captured. No organizing required.');
}

function populateInspectorSelects() {
  const sets = [
    ['item-state', STATES, stateLabel],
    ['item-kind', KINDS, kindLabel],
    ['item-effort', EFFORTS, value => value[0] + value.slice(1).toLowerCase()],
    ['item-priority', PRIORITIES, value => value[0] + value.slice(1).toLowerCase()]
  ];
  sets.forEach(([id, values, formatter]) => {
    const select = $(id);
    if (!select || select.options.length) return;
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = formatter(value);
      select.appendChild(option);
    });
  });
}

function openInspector(itemId) {
  const item = workspace?.items.find(candidate => candidate.id === itemId);
  if (!item) return;
  activeItemId = item.id;
  populateInspectorSelects();
  $('item-title').value = item.title;
  $('item-next-action').value = item.nextAction;
  $('item-state').value = item.state;
  $('item-kind').value = item.kind;
  $('item-effort').value = item.effort;
  $('item-priority').value = item.priority;
  $('item-due').value = item.dueAt ? String(item.dueAt).slice(0, 10) : '';
  $('item-area').value = item.area;
  $('item-waiting').value = item.waitingOn;
  $('item-notes').value = item.notes;
  $('item-source-label').value = item.sourceLabel;
  $('item-source-url').value = item.sourceUrl;
  $('item-tool').value = item.tool;
  $('item-timestamps').textContent = `Created ${new Date(item.createdAt).toLocaleString()} · touched ${relativeTime(item.updatedAt)}`;
  $('ai-item-output').classList.add('hidden');
  $('ai-item-output').replaceChildren();
  renderChecklist(item);
  $('inspector-backdrop').classList.remove('hidden');
  $('inspector').classList.remove('hidden');
  setTimeout(() => $('item-next-action').focus(), 0);
}

function closeInspector() {
  activeItemId = null;
  $('inspector-backdrop').classList.add('hidden');
  $('inspector').classList.add('hidden');
}

function syncInspectorField(field, value) {
  const item = activeItem();
  if (!item) return;
  if (field === 'state') setItemState(workspace, item.id, value);
  else item[field] = value;
  item.updatedAt = Date.now();
  saveWorkspace();
  renderAll();
  $('inspector-status').textContent = 'Saving…';
  setTimeout(() => { if (activeItemId) $('inspector-status').textContent = 'Autosaved'; }, 650);
}

function renderChecklist(item) {
  const root = $('item-checklist');
  root.replaceChildren();
  if (!item.subtasks.length) {
    const note = document.createElement('div');
    note.className = 'field-note';
    note.textContent = 'No steps. Add them only when breaking the thing down actually helps.';
    root.appendChild(note);
    return;
  }
  item.subtasks.forEach(step => {
    const row = document.createElement('div');
    row.className = `check-item${step.done ? ' done' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = step.done;
    checkbox.addEventListener('change', () => {
      step.done = checkbox.checked;
      item.updatedAt = Date.now();
      saveWorkspace();
      renderChecklist(item);
    });
    const text = document.createElement('span');
    text.textContent = step.text;
    const remove = document.createElement('button');
    remove.className = 'btn btn-quiet btn-sm';
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      item.subtasks = item.subtasks.filter(candidate => candidate.id !== step.id);
      item.updatedAt = Date.now();
      saveWorkspace();
      renderChecklist(item);
    });
    row.append(checkbox, text, remove);
    root.appendChild(row);
  });
}

function addChecklistItem() {
  const item = activeItem();
  const input = $('check-input');
  const text = input.value.trim();
  if (!item || !text) return;
  item.subtasks.push({ id: makeId(), text, done: false });
  item.updatedAt = Date.now();
  input.value = '';
  saveWorkspace();
  renderChecklist(item);
}

async function copyText(text, message = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(message);
}

function openOverlay(id) {
  $(id)?.classList.remove('hidden');
  if (id === 'settings-overlay') renderSettings();
  if (id === 'regroup-overlay') renderRegroup();
}

function closeOverlay(id) {
  $(id)?.classList.add('hidden');
  if (id === 'regroup-overlay' && workspace) {
    workspace.meta.lastRegroupAt = Date.now();
    saveWorkspace();
  }
}

function renderRegroup() {
  const entries = regroupCandidates(workspace);
  const root = $('regroup-list');
  root.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.style.margin = '0 20px 18px';
    empty.innerHTML = '<strong>Nothing needs a regroup.</strong>You can close this and keep going.';
    root.appendChild(empty);
  } else {
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'regroup-item';
      const reason = document.createElement('span');
      reason.className = 'regroup-reason';
      reason.textContent = entry.reason;
      const copy = document.createElement('div');
      copy.className = 'regroup-copy';
      const title = document.createElement('strong');
      title.textContent = entry.item.title;
      const next = document.createElement('span');
      next.textContent = entry.item.nextAction || `Currently ${stateLabel(entry.item.state)}`;
      copy.append(title, next);
      const actions = document.createElement('div');
      actions.className = 'regroup-actions';
      [['NOW', 'Now'], ['QUEUE', 'Queue'], ['LATER', 'Later'], ['DONE', 'Done']].forEach(([state, label]) => {
        const button = document.createElement('button');
        button.className = `btn btn-sm${state === 'NOW' ? ' btn-primary' : ''}`;
        button.textContent = label;
        button.addEventListener('click', () => {
          setItemState(workspace, entry.item.id, state);
          saveWorkspace();
          renderAll();
          renderRegroup();
        });
        actions.appendChild(button);
      });
      row.append(reason, copy, actions);
      root.appendChild(row);
    });
  }
  const stats = briefStats(workspace);
  $('regroup-footer-copy').textContent = `${entries.length} decision${entries.length === 1 ? '' : 's'} surfaced. ${stats.hiddenFromDesk} other unresolved items stay safely out of sight.`;
}

function renderSettings() {
  settings = loadSettings();
  $('ai-base-url').value = settings.baseUrl || '';
  $('ai-model').value = settings.model || '';
  $('ai-api-key').value = settings.apiKey || '';
  $('ai-status').textContent = '';
}

async function callAI(messages, maxTokens = 700) {
  persistSettings();
  if (!settings.apiKey || !settings.baseUrl || !settings.model) throw new Error('Configure an endpoint, key and model in Settings first.');
  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({ model: settings.model, messages, temperature: 0.2, max_tokens: maxTokens })
  });
  if (!response.ok) {
    let detail = response.statusText;
    try { detail = (await response.json()).error?.message || detail; } catch { /* noop */ }
    throw new Error(`${response.status}: ${detail}`);
  }
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() || '';
}

function aiContext(item) {
  return {
    title: item.title,
    state: item.state,
    nextAction: item.nextAction,
    area: item.area,
    waitingOn: item.waitingOn,
    dueAt: item.dueAt,
    notes: item.notes,
    source: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    tool: item.tool,
    steps: item.subtasks
  };
}

function renderAIOutput(text, action) {
  const root = $('ai-item-output');
  root.classList.remove('hidden');
  root.replaceChildren();
  const copy = document.createElement('div');
  copy.textContent = text;
  root.appendChild(copy);
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const copyButton = document.createElement('button');
  copyButton.className = 'btn btn-sm';
  copyButton.textContent = 'Copy';
  copyButton.addEventListener('click', () => copyText(text));
  actions.appendChild(copyButton);
  if (action === 'smaller') {
    const apply = document.createElement('button');
    apply.className = 'btn btn-primary btn-sm';
    apply.textContent = 'Use as next move';
    apply.addEventListener('click', () => {
      const item = activeItem();
      if (!item) return;
      item.nextAction = text.replace(/^[-–—•\s]+/, '').trim();
      item.updatedAt = Date.now();
      saveWorkspace();
      openInspector(item.id);
      renderAll();
    });
    actions.appendChild(apply);
  }
  if (action === 'clean') {
    const apply = document.createElement('button');
    apply.className = 'btn btn-primary btn-sm';
    apply.textContent = 'Replace context';
    apply.addEventListener('click', () => {
      const item = activeItem();
      if (!item) return;
      item.notes = text;
      item.updatedAt = Date.now();
      saveWorkspace();
      openInspector(item.id);
      renderAll();
    });
    actions.appendChild(apply);
  }
  root.appendChild(actions);
}

async function runItemAI(action) {
  const item = activeItem();
  if (!item) return;
  const root = $('ai-item-output');
  root.classList.remove('hidden');
  root.textContent = 'Thinking…';
  const context = JSON.stringify(aiContext(item), null, 2);
  const prompts = {
    smaller: 'Turn this into the smallest genuinely useful next physical action. One short line only. Do not invent facts or add motivational language.',
    resume: 'Create a compact re-entry brief using exactly: WHERE IT STANDS, NEXT MOVE, WATCH OUT. Do not invent anything not in the item.',
    clean: 'Rewrite the context into compact future-you notes. Preserve every concrete fact, constraint and open question. Remove repetition. No commentary.',
    handoff: 'Create a strong handoff for another capable person or AI agent. Include goal, current state, known context, next move, constraints and open questions. Never invent facts.'
  };
  try {
    const text = await callAI([
      { role: 'system', content: prompts[action] },
      { role: 'user', content: context }
    ], action === 'smaller' ? 180 : action === 'resume' ? 450 : 850);
    renderAIOutput(text, action);
  } catch (error) {
    root.textContent = `AI unavailable: ${error.message}`;
  }
}

function openCommand() {
  $('command-overlay').classList.remove('hidden');
  $('command-input').value = '';
  commandIndex = 0;
  renderCommandResults();
  setTimeout(() => $('command-input').focus(), 0);
}

function closeCommand() {
  $('command-overlay').classList.add('hidden');
}

function renderCommandResults() {
  const query = $('command-input').value.trim().toLowerCase();
  const actions = [
    { label: 'Go to Desk', meta: 'view', run: () => setView('desk') },
    { label: 'Open Inbox', meta: 'view', run: () => setView('inbox') },
    { label: 'Regroup', meta: 're-entry', run: () => openOverlay('regroup-overlay') },
    { label: 'Capture something', meta: 'action', run: () => { setView('desk'); setTimeout(() => $('quick-input').focus(), 0); } }
  ];
  const matchingActions = actions.filter(entry => !query || entry.label.toLowerCase().includes(query));
  const matchingItems = workspace.items
    .filter(item => !query || itemMatches(item, query))
    .filter(item => item.state !== 'DONE' || query)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)
    .map(item => ({ label: item.title, meta: `${stateLabel(item.state)} · ${item.area || kindLabel(item.kind)}`, run: () => openInspector(item.id) }));
  commandEntries = [...matchingActions, ...matchingItems];
  if (commandIndex >= commandEntries.length) commandIndex = Math.max(0, commandEntries.length - 1);
  const root = $('command-results');
  root.replaceChildren();
  if (!commandEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'field-note';
    empty.style.padding = '14px';
    empty.textContent = 'No matches.';
    root.appendChild(empty);
    return;
  }
  commandEntries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = `command-item${index === commandIndex ? ' active' : ''}`;
    const label = document.createElement('strong');
    label.textContent = entry.label;
    const meta = document.createElement('span');
    meta.textContent = entry.meta;
    row.append(label, meta);
    row.addEventListener('click', () => { closeCommand(); entry.run(); });
    root.appendChild(row);
  });
}

function exportData() {
  const safeSettings = { baseUrl: settings.baseUrl, model: settings.model };
  const payload = { exportedAt: new Date().toISOString(), workspace, settings: safeSettings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `general-manager-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const incoming = normalizeWorkspace(payload.workspace || payload);
  const replace = confirm('Replace the current harness with this import? Press Cancel to merge instead.');
  if (replace) {
    workspace = incoming;
  } else {
    const existing = new Set(workspace.items.map(item => item.id));
    incoming.items.forEach(item => workspace.items.push(existing.has(item.id) ? normalizeItem({ ...item, id: makeId() }) : item));
  }
  await saveUserHarnessImmediate(currentUser.uid, workspace);
  renderAll();
  setView(workspace.meta.preferredView || 'desk', false);
  toast(replace ? 'Import replaced workspace' : 'Import merged');
}

function attachListeners() {
  if (listenersReady) return;
  listenersReady = true;

  $$('.nav-tab').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('quick-add-btn').addEventListener('click', captureQuick);
  $('quick-input').addEventListener('keydown', event => { if (event.key === 'Enter') captureQuick(); });

  $$('#capacity-switch button').forEach(button => button.addEventListener('click', () => {
    if (!workspace) return;
    workspace.meta.capacityMode = button.dataset.capacity;
    saveWorkspace();
    renderAll();
  }));

  $('regroup-btn').addEventListener('click', () => openOverlay('regroup-overlay'));
  $('attention-regroup-btn').addEventListener('click', () => openOverlay('regroup-overlay'));
  $('search-btn').addEventListener('click', openCommand);
  $('settings-btn').addEventListener('click', () => openOverlay('settings-overlay'));
  $('inspector-close').addEventListener('click', closeInspector);
  $('inspector-backdrop').addEventListener('click', closeInspector);
  $('copy-handoff-btn').addEventListener('click', () => { const item = activeItem(); if (item) copyText(itemToHandoff(item), 'Handoff copied'); });

  const fields = [
    ['item-title', 'title'], ['item-next-action', 'nextAction'], ['item-state', 'state'], ['item-kind', 'kind'],
    ['item-effort', 'effort'], ['item-priority', 'priority'], ['item-due', 'dueAt'], ['item-area', 'area'],
    ['item-waiting', 'waitingOn'], ['item-notes', 'notes'], ['item-source-label', 'sourceLabel'],
    ['item-source-url', 'sourceUrl'], ['item-tool', 'tool']
  ];
  fields.forEach(([id, field]) => {
    const node = $(id);
    const eventName = node.tagName === 'SELECT' || node.type === 'date' ? 'change' : 'input';
    node.addEventListener(eventName, event => syncInspectorField(field, event.target.value));
  });

  $('check-add-btn').addEventListener('click', addChecklistItem);
  $('check-input').addEventListener('keydown', event => { if (event.key === 'Enter') addChecklistItem(); });
  $('duplicate-item-btn').addEventListener('click', () => {
    const item = activeItem();
    if (!item) return;
    const copy = duplicateItem(workspace, item.id);
    saveWorkspace();
    renderAll();
    openInspector(copy.id);
  });
  $('snooze-item-btn').addEventListener('click', () => {
    const item = activeItem();
    if (!item) return;
    item.snoozedUntil = new Date(Date.now() + DAY).toISOString();
    item.updatedAt = Date.now();
    saveWorkspace();
    renderAll();
    closeInspector();
    toast('Out of sight until tomorrow.');
  });
  $('complete-item-btn').addEventListener('click', () => {
    const item = activeItem();
    if (!item) return;
    setItemState(workspace, item.id, 'DONE');
    saveWorkspace();
    renderAll();
    closeInspector();
    toast('Done.');
  });
  $('delete-item-btn').addEventListener('click', () => {
    const item = activeItem();
    if (!item || !confirm(`Delete “${item.title}” permanently?`)) return;
    workspace.items = workspace.items.filter(candidate => candidate.id !== item.id);
    saveWorkspace();
    renderAll();
    closeInspector();
  });

  $$('[data-ai-action]').forEach(button => button.addEventListener('click', () => runItemAI(button.dataset.aiAction)));
  $$('[data-close-overlay]').forEach(button => button.addEventListener('click', () => closeOverlay(button.dataset.closeOverlay)));
  $$('[data-ai-preset]').forEach(button => button.addEventListener('click', () => { $('ai-base-url').value = button.dataset.aiPreset; persistSettings(); }));
  ['ai-base-url', 'ai-model', 'ai-api-key'].forEach(id => $(id).addEventListener('input', persistSettings));
  $('ai-test-btn').addEventListener('click', async () => {
    const status = $('ai-status');
    status.textContent = 'Testing…';
    try {
      await callAI([{ role: 'user', content: 'Reply with exactly OK' }], 12);
      status.textContent = 'Connected.';
    } catch (error) {
      status.textContent = error.message;
    }
  });

  $('export-btn').addEventListener('click', exportData);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await importData(file); }
    catch (error) { alert(`Import failed: ${error.message}`); }
    event.target.value = '';
  });

  $('everything-search').addEventListener('input', renderEverything);
  $('command-input').addEventListener('input', () => { commandIndex = 0; renderCommandResults(); });
  $('command-input').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); commandIndex = Math.min(commandIndex + 1, commandEntries.length - 1); renderCommandResults(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); commandIndex = Math.max(commandIndex - 1, 0); renderCommandResults(); }
    if (event.key === 'Enter' && commandEntries[commandIndex]) { event.preventDefault(); const entry = commandEntries[commandIndex]; closeCommand(); entry.run(); }
    if (event.key === 'Escape') closeCommand();
  });
  $('command-overlay').addEventListener('click', event => { if (event.target === $('command-overlay')) closeCommand(); });

  $('board-title').addEventListener('input', () => saveWorkspace());
  $('logout-btn').addEventListener('click', () => window.signOutUser?.());

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!$('command-overlay').classList.contains('hidden')) closeCommand(); else openCommand();
      return;
    }
    if (event.key === '/' && !isTypingTarget(event.target)) {
      event.preventDefault();
      setView('desk');
      $('quick-input').focus();
      return;
    }
    if (event.key === 'Escape') {
      if (!$('command-overlay').classList.contains('hidden')) closeCommand();
      else if (!$('regroup-overlay').classList.contains('hidden')) closeOverlay('regroup-overlay');
      else if (!$('settings-overlay').classList.contains('hidden')) closeOverlay('settings-overlay');
      else if (!$('inspector').classList.contains('hidden')) closeInspector();
    }
  });
}

async function bootstrapForUser(user) {
  currentUser = user;
  $('user-email').textContent = user.email || '';
  let stored = await loadUserHarness(user.uid);
  if (!stored) {
    const legacy = await window.loadUserData?.(user.uid).catch(() => ({ board: null, archive: [] }));
    workspace = normalizeWorkspace(legacy?.board || createDefaultWorkspace());
    workspace.meta.seededFromLegacy = !!legacy?.board;
    workspace.meta.seededAt = Date.now();
    await saveUserHarnessImmediate(user.uid, workspace);
  } else {
    workspace = normalizeWorkspace(stored);
  }
  const previousOpen = workspace.meta.lastOpenedAt;
  workspace.meta.lastOpenedAt = Date.now();
  renderAll();
  setView(workspace.meta.preferredView || 'desk', false);
  saveWorkspace();

  if (previousOpen && Date.now() - previousOpen > 36 * 60 * 60 * 1000 && regroupCandidates(workspace).length) {
    setTimeout(() => openOverlay('regroup-overlay'), 350);
  }
}

attachListeners();

window.onUserChanged?.(async user => {
  if (!user) {
    currentUser = null;
    workspace = null;
    activeItemId = null;
    return;
  }
  try {
    await bootstrapForUser(user);
  } catch (error) {
    console.error('Failed to bootstrap General Manager harness:', error);
    toast('Could not load the manager workspace.');
  }
});
