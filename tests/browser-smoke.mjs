const appPort = process.env.GM_APP_PORT;
const cdpPort = process.env.GM_CDP_PORT;
if (!appPort || !cdpPort) throw new Error('Smoke ports were not provided');
const endpoint = `http://127.0.0.1:${cdpPort}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPage() {
  for (let i = 0; i < 180; i += 1) {
    try {
      const pages = await fetch(`${endpoint}/json`).then(res => res.json());
      const page = pages.find(item => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* Chrome is still starting. */ }
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint never became ready');
}

const page = await getPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let id = 0;
const pending = new Map();
const runtimeExceptions = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeExceptions.push(message.params.exceptionDetails);
});

function cdp(method, params = {}) {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(messageId)) return;
      pending.delete(messageId);
      reject(new Error(`CDP timeout: ${method}`));
    }, 8000);
  });
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}

async function waitFor(expression, label, loops = 120) {
  for (let i = 0; i < loops; i += 1) {
    if (await evaluate(expression).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

await cdp('Runtime.enable');
await cdp('Page.enable');
await cdp('Page.navigate', { url: `http://127.0.0.1:${appPort}/?demo=1` });
await waitFor(`document.body?.classList.contains('demo-mode') && !!document.getElementById('quick-input') && !document.getElementById('demo-badge').classList.contains('hidden')`, 'demo boot');

// Start from the deterministic synthetic seed.
await evaluate(`localStorage.removeItem('gm_demo_harness_v3'); location.reload(); true`);
await waitFor(`document.body?.classList.contains('demo-mode') && document.querySelectorAll('.manager-card').length === 1`, 'seeded demo after reload');

const shell = await evaluate(`({
  title: document.title,
  authOverlay: !!document.getElementById('auth-overlay'),
  quickKindPresent: !!document.getElementById('quick-kind'),
  firebaseLoaded: performance.getEntriesByType('resource').some(r => r.name.includes('firebasejs')),
  demoBadge: document.getElementById('demo-badge').textContent.trim()
})`);
if (shell.title !== 'General Manager' || shell.authOverlay || shell.quickKindPresent || shell.firebaseLoaded) {
  throw new Error(`Unexpected demo shell: ${JSON.stringify(shell)}`);
}

// Capture must persist immediately enough to survive a reload.
const capturedTitle = 'Smoke capture survives reload';
await evaluate(`(() => { const i=document.getElementById('quick-input'); i.value=${JSON.stringify(capturedTitle)}; document.getElementById('quick-add-btn').click(); })()`);
await waitFor(`JSON.parse(localStorage.getItem('gm_demo_harness_v3')).items.some(i => i.title === ${JSON.stringify(capturedTitle)})`, 'captured item in local storage');
await cdp('Page.reload');
await waitFor(`document.body?.classList.contains('demo-mode') && !!document.querySelector('.manager-card') && JSON.parse(localStorage.getItem('gm_demo_harness_v3')).items.some(i => i.title === ${JSON.stringify(capturedTitle)})`, 'rehydrated demo after capture reload');

// Light means exactly one active commitment; Up Next may not silently create another.
await evaluate(`document.querySelector('[data-capacity="LIGHT"]').click()`);
await waitFor(`document.querySelector('[data-capacity="LIGHT"]').classList.contains('active')`, 'Light capacity activation');
await evaluate(`document.querySelector('.next-candidate')?.click()`);
await sleep(100);
const capacityState = await evaluate(`(() => { const w=JSON.parse(localStorage.getItem('gm_demo_harness_v3')); return { now:w.items.filter(i=>i.state==='NOW').length, toast:document.getElementById('toast-region').innerText }; })()`);
if (capacityState.now !== 1 || !/desk is full/i.test(capacityState.toast)) throw new Error(`NOW boundary failed: ${JSON.stringify(capacityState)}`);

// Inbox skip must reveal a different decision without changing the skipped item's state.
await evaluate(`document.querySelector('[data-view="inbox"]').click()`);
await waitFor(`!!document.querySelector('.triage-card h2')`, 'inbox triage');
const beforeSkip = await evaluate(`document.querySelector('.triage-card h2').textContent`);
await evaluate(`[...document.querySelectorAll('.triage-secondary button')].find(b=>b.textContent.includes('Skip'))?.click()`);
await waitFor(`document.querySelector('.triage-card h2')?.textContent !== ${JSON.stringify(beforeSkip)}`, 'next triage item');

// Seed five regroup candidates and prove one session is capped at three with no refill.
await evaluate(`(async () => {
  const m = await import('/core.js');
  const w = m.createDefaultWorkspace(Date.now());
  w.meta.capacityMode='NORMAL';
  m.captureItem(w,{title:'Active',state:'NOW'},Date.now()-8*86400000).updatedAt=Date.now()-8*86400000;
  for(let n=1;n<=5;n++){ const x=m.captureItem(w,{title:'Old queue '+n,state:'QUEUE'},Date.now()-10*86400000); x.priority='HIGH'; x.updatedAt=Date.now()-10*86400000; }
  localStorage.setItem('gm_demo_harness_v3',JSON.stringify(w));
  return true;
})()`);
await cdp('Page.reload');
await waitFor(`document.body?.classList.contains('demo-mode') && !!document.getElementById('regroup-btn')`, 'regroup seed reload');
await evaluate(`document.getElementById('regroup-btn').click()`);
await waitFor(`document.querySelectorAll('.regroup-item').length === 3`, 'three-item regroup session');
for (const expected of [2, 1, 0]) {
  await evaluate(`document.querySelector('.regroup-item .regroup-actions button:nth-child(2)')?.click()`);
  await waitFor(`document.querySelectorAll('.regroup-item').length === ${expected}`, `regroup remaining ${expected}`);
}

const lockHeld = await evaluate(`navigator.locks?.query().then(x => x.held.some(l => l.name === 'general-manager-demo-writer'))`);
if (lockHeld !== true) throw new Error('Demo writer lock is not held');

if (runtimeExceptions.length) {
  const first = runtimeExceptions[0];
  throw new Error(`Runtime exception: ${first.exception?.description || first.text}`);
}

console.log('General Manager portfolio demo browser smoke passed:', { shell, capacityState, beforeSkip });
ws.close();
