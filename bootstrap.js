function loadScript(src, type = '') {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (type) script.type = type;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

(async () => {
  try {
    if (!window.GM_DEMO_MODE) {
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
      await loadScript('/firebase-config.js');
    }
    await loadScript('/auth.js');
    await loadScript('/db.js');
    await loadScript('/app.js', 'module');
  } catch (error) {
    console.error('General Manager bootstrap failed:', error);
    const region = document.getElementById('toast-region');
    if (region) {
      const node = document.createElement('div');
      node.className = 'toast';
      node.textContent = 'General Manager could not start.';
      region.appendChild(node);
    }
  }
})();
