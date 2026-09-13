// Run with Playwright installed: node tests/browser-smoke.cjs [screenshot-directory]
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const screenshotDir = process.argv[2];
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(target, (err, data) => { res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' }); res.end(err ? 'Not found' : data); });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = []; page.on('pageerror', err => errors.push(err.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/?demo=1`);
    await page.locator('.card').first().waitFor();
    assert.equal(await page.locator('.card').count(), 3);
    assert.equal(await page.locator('#auth-overlay').count(), 0);
    if (screenshotDir) { fs.mkdirSync(screenshotDir, { recursive: true }); await page.screenshot({ path: path.join(screenshotDir, 'board-desktop.png') }); }
    await page.locator('.card').first().focus(); await page.keyboard.press('Enter');
    await page.locator('#modal-notes').fill('Synthetic context. <script>window.injected=true</script>');
    await page.locator('#modal-priority').selectOption('HIGH');
    await page.locator('#new-subtask-input').fill('Verify the release'); await page.locator('#add-subtask-btn').click();
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'card-detail.png') });
    await page.locator('#modal-save-btn').click();
    assert.equal(await page.evaluate(() => window.injected), undefined);
    await page.locator('#quick-input').fill('https://example.com/new-context'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.card').count(), 4);
    await page.locator('#search-input').fill('new-context'); assert.equal(await page.locator('.card').count(), 1);
    await page.locator('#search-input').fill('');
    await page.locator('.card').first().click(); await page.locator('#modal-archive-btn').click();
    assert.equal(await page.locator('.card').count(), 3);
    await page.locator('#archive-view-btn').click(); await page.getByRole('button', { name: 'Restore', exact: true }).click();
    assert.equal(await page.locator('.card').count(), 4);
    await page.locator('#archive-modal-close-btn').click();
    const download = page.waitForEvent('download'); await page.locator('#export-btn').click();
    const backupPath = await (await download).path(); const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.equal(backup.schemaVersion, 1); assert.equal(backup.settings.apiKey, undefined);
    backup.board.meta.boardTitle = 'Imported safely';
    page.once('dialog', dialog => dialog.accept('REPLACE'));
    await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(() => document.getElementById('board-title').value === 'Imported safely');
    // Cancel must mean cancel, never the old accidental merge.
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.card').first().click();
    await page.locator('#modal-column').selectOption({ label: 'ACTIVE' });
    await page.locator('#modal-save-btn').click();
    await page.reload(); await page.locator('.card').first().waitFor();
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'board-mobile.png') });
    assert.equal(await page.locator('.card').count(), 3);
    assert.deepEqual(errors, []);
    console.log('Browser smoke passed: desktop/mobile, demo isolation, keyboard details, checklist, capture, filter, archive/restore, export/import, cancel, no page errors.');
  } finally { await browser.close(); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
