(() => {
  const params = new URLSearchParams(location.search);
  const cleanPath = location.pathname.replace(/\/+$/, '') || '/';
  const demo = params.get('demo') === '1' || cleanPath === '/demo';
  window.GM_DEMO_MODE = demo;
  window.GM_DEMO_READ_ONLY = false;

  if (!demo) {
    window.GM_DEMO_LOCK_READY = Promise.resolve(true);
    return;
  }

  document.documentElement.classList.add('demo-mode');

  if (!navigator.locks?.request) {
    window.GM_DEMO_LOCK_READY = Promise.resolve(true);
    return;
  }

  let resolveReady;
  window.GM_DEMO_LOCK_READY = new Promise(resolve => { resolveReady = resolve; });
  navigator.locks.request('general-manager-demo-writer', { ifAvailable: true }, lock => {
    if (!lock) {
      window.GM_DEMO_READ_ONLY = true;
      resolveReady(false);
      return undefined;
    }
    resolveReady(true);
    return new Promise(() => {});
  }).catch(() => resolveReady(true));
})();
