const endpoint = 'http://127.0.0.1:9222';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPage() {
  for (let i = 0; i < 180; i += 1) {
    try {
      const pages = await fetch(`${endpoint}/json`).then(res => res.json());
      const page = pages.find(item => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome is still starting.
    }
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
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeExceptions.push(message.params.exceptionDetails);
  }
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
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result?.value;
}

await cdp('Runtime.enable');
await cdp('Page.enable');
await cdp('Page.navigate', { url: 'http://127.0.0.1:8080/' });

let ready = false;
for (let i = 0; i < 100; i += 1) {
  ready = await evaluate(`
    document.readyState === 'complete' &&
    !!document.getElementById('quick-input') &&
    typeof window.onUserChanged === 'function' &&
    typeof window.loadUserData === 'function' &&
    typeof window.saveUserBoard === 'function'
  `).catch(() => false);
  if (ready) break;
  await sleep(100);
}

if (!ready) {
  throw new Error('Application scripts did not reach a ready persistence/auth boundary');
}

// Settings is deliberately usable before a workspace has loaded. Clicking it
// proves the vNext module reached wireStaticListeners without faking Firebase auth.
await evaluate(`document.getElementById('settings-btn').click()`);
await sleep(100);

const settingsOpened = await evaluate(`
  !document.getElementById('settings-overlay').classList.contains('hidden')
`);

if (!settingsOpened) {
  throw new Error('vNext controller did not wire the Settings action');
}

const shellState = await evaluate(`({
  capturePresent: !!document.getElementById('quick-destination'),
  inspectorPresent: !!document.getElementById('inspector'),
  settingsOpen: !document.getElementById('settings-overlay').classList.contains('hidden'),
  title: document.title
})`);

if (!shellState.capturePresent || !shellState.inspectorPresent || !shellState.settingsOpen || shellState.title !== 'GeneralManager') {
  throw new Error(`Unexpected shell state: ${JSON.stringify(shellState)}`);
}

const seriousExceptions = runtimeExceptions.filter(item => {
  const text = `${item.text || ''} ${item.exception?.description || ''}`;
  return !/firebase|network|ERR_/i.test(text);
});

if (seriousExceptions.length) {
  throw new Error(`Runtime exception: ${seriousExceptions[0].text || seriousExceptions[0].exception?.description}`);
}

console.log('Browser runtime smoke passed:', shellState);
ws.close();
