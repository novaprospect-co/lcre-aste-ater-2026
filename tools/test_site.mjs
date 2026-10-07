import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {}, URL, Intl };
vm.createContext(context);
vm.runInContext(await fs.readFile(path.join(root, 'data/properties.js'), 'utf8'), context);
vm.runInContext(await fs.readFile(path.join(root, 'app.js'), 'utf8'), context);
const data = context.window.LCRE_DATA.properties;
assert.equal(data.filter(p => p.geocoding?.status === 'verified').length, 26);
assert.equal(data.filter(p => p.geocoding?.status === 'street').length, 4);
assert.equal(data.filter(p => p.geocoding?.status === 'review').length, 0);
assert.ok(data.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
const baselinePath = path.join(root, '../qa/pre-map-data.json');
const baseline = await fs.readFile(baselinePath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
for (const property of baseline ? data : []) {
  const original = baseline.properties.find(p => p.id === property.id);
  const { latitude, longitude, geocoding, ...unchanged } = property;
  assert.deepEqual(JSON.parse(JSON.stringify(unchanged)), original, `Source property changed: ${property.id}`);
}
const { select, safeUrl, ranks } = context.window.LCRE;
assert.equal(data.length, 30);
assert.equal(new Set(data.map(p => p.id)).size, 30);
assert.equal(new Set(data.map(p => p.lot)).size, 30);
assert.equal(data.filter(p => safeUrl(p.officialUrl)).length, 30);
assert.equal(data.filter(p => safeUrl(p.videoUrl)).length, 29);
assert.equal(safeUrl('javascript:alert(1)'), null);
assert.equal(safeUrl('https://example.org/'), 'https://example.org/');
assert.equal(select(data, { maxPrice: 0 }).length, 0);
assert.equal(select(data, { maxPrice: 118575 }).length, 1);
assert.equal(select(data, { maxPrice: '' }).length, 30);
for (const rank of ranks) assert.equal(select(data, { evaluation: rank }).length, data.filter(p => p.evaluation === rank).length);
let combinations = 0;
for (const neighborhood of ['', ...new Set(data.map(p => p.neighborhood))]) {
  for (const category of ['', ...new Set(data.map(p => p.category))]) {
    for (const evaluation of ['', ...ranks]) {
      for (const maxPrice of ['', 0, 200000, 300000, 600000]) {
        const expected = data.filter(p => (!neighborhood || p.neighborhood === neighborhood) && (!category || p.category === category) && (!evaluation || p.evaluation === evaluation) && (maxPrice === '' || p.startingPrice <= maxPrice));
        assert.equal(select(data, { neighborhood, category, evaluation, maxPrice }).length, expected.length);
        combinations++;
      }
    }
  }
}
const modes = ['evaluation', 'price-asc', 'price-desc', 'rate-asc', 'surface-desc', 'auction-asc'];
const key = (p, mode) => ({ evaluation: ranks.indexOf(p.evaluation), 'price-asc': p.startingPrice, 'price-desc': -p.startingPrice, 'rate-asc': p.pricePerSqm, 'surface-desc': -p.surface, 'auction-asc': p.auctionSortKey })[mode];
for (const mode of modes) {
  const rows = select(data, {}, mode);
  assert.equal(new Set(rows.map(p => p.id)).size, 30);
  for (let i = 1; i < rows.length; i++) assert.ok(key(rows[i - 1], mode) <= key(rows[i], mode), mode);
  const missing = { id: 'missing', sourceRow: 99, evaluation: 'NA', startingPrice: null, surface: null, pricePerSqm: null, auctionSortKey: null };
  assert.equal(select([...data, missing], {}, mode).at(-1).id, 'missing');
}
console.log(`PASS: ${combinations} filter combinations, six sorts, missing values, unique lots, URL safety.`);

// Browser testing is optional at invocation; no browser dependency at runtime.
if (!process.argv.includes('--browser')) process.exit(0);
const modulePath = process.env.LCRE_PLAYWRIGHT_PATH;
if (!modulePath) throw new Error('Set LCRE_PLAYWRIGHT_PATH to the installed playwright/index.mjs.');
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
// Do not request live OSM tiles during automated pan/zoom tests.
await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }));
const errors = [], requests = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('request', request => requests.push(request.url()));
const base = process.argv.includes('--file') ? pathToFileURL(path.join(root, 'index.html')).href : process.env.LCRE_PREVIEW_URL || 'http://127.0.0.1:8765/';
try {
  await page.goto(base);
  await page.locator('.property-card').last().waitFor();
  assert.equal(await page.locator('.property-card').count(), 30);
  assert.equal(await page.locator('.property-marker').count(), 30);
  assert.equal(await page.locator('.property-marker.is-approximate').count(), 4);
  assert.equal(await page.locator('.map-source').count(), 0);
  assert.ok(await page.locator('#map-tile-message').isHidden());
  assert.equal(await page.locator('#map-review-list li').count(), 0);
  assert.equal(await page.evaluate(() => L.version), '1.9.4');
  assert.ok(await page.evaluate(() => document.querySelector('#filters').compareDocumentPosition(document.querySelector('#map-section')) & Node.DOCUMENT_POSITION_FOLLOWING));
  assert.ok(await page.evaluate(() => document.querySelector('#map-section').compareDocumentPosition(document.querySelector('.results-toolbar')) & Node.DOCUMENT_POSITION_FOLLOWING));
  assert.equal(await page.evaluate(() => window.LCRE_Map.controller.map.options.scrollWheelZoom), false);
  assert.equal(await page.locator('#page-title').textContent(), 'ASTA ATER ROMA, OTTOBRE 2026');
  const disclaimers = await page.locator('body').innerText();
  assert.equal(disclaimers.split('Questa pagina riorganizza informazioni pubblicamente disponibili per facilitarne la consultazione.').length - 1, 1);
  assert.equal(await page.locator('footer #informazioni').count(), 1);
  assert.equal(await page.locator('.hero-index').count(), 0);
  assert.equal(await page.locator('.auction-line time').first().textContent(), '16 OTTOBRE alle ore 11:45');
  assert.deepEqual(await page.locator('#category option').allTextContents(), ['Tutte le tipologie', 'Bilocale', 'Monolocale', 'Pentilocale', 'Quadrilocale', 'Trilocale']);
  assert.ok((await page.locator('.property-card').first().boundingBox()).height < 480, 'Desktop card is not compact');
  const cards = await page.locator('.property-card').evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.propertyId, official: n.querySelector('.official-link')?.getAttribute('href'), video: n.querySelector('.video-link')?.getAttribute('href') || null, text: n.textContent })));
  assert.equal(new Set(cards.map(c => c.id)).size, 30);
  for (const source of data) {
    const card = cards.find(c => c.id === source.id);
    assert.equal(card.official, source.officialUrl);
    assert.equal(card.video, source.videoUrl);
    assert.ok(card.text.includes(source.address));
    assert.ok(card.text.includes(source.lot));
    const labels = { Mono: 'Monolocale', Bilo: 'Bilocale', Trilo: 'Trilocale', Quadri: 'Quadrilocale', Penta: 'Pentilocale' };
    assert.ok(card.text.includes(labels[source.category]));
    if (source.condition === 'Ottime') assert.ok(card.text.includes("Pronto all'uso"));
    if (source.condition === 'Buone') assert.ok(card.text.includes("Quasi pronto all'uso"));
    if (source.condition === 'Da lavori') assert.ok(card.text.includes('Da fare lavori'));
  }
  assert.equal(await page.locator('a[target="_blank"]:not([rel="noopener noreferrer"])').count(), 0);
  assert.equal(await page.locator('iframe').count(), 0);
  await page.selectOption('#neighborhood', 'Ardeatino');
  await page.selectOption('#category', 'Trilo');
  await page.selectOption('#evaluation', 'Sufficiente');
  await page.fill('#max-price', '200000');
  assert.equal(await page.locator('.property-card').count(), 2);
  assert.equal(await page.locator('.property-marker').count(), 2);
  await page.fill('#max-price', '0');
  assert.equal(await page.locator('.property-card').count(), 0);
  assert.equal(await page.locator('.property-marker').count(), 0);
  await assert.doesNotReject(() => page.locator('#empty-state').waitFor({ state: 'visible' }));
  await page.click('#empty-reset');
  await page.waitForFunction(() => document.querySelectorAll('.property-card').length === 30);
  assert.equal(await page.locator('#sort').inputValue(), 'evaluation');
  assert.equal(await page.locator('.property-marker').count(), 30);
  // Every existing filter value, including unresolved-only results, stays synchronized.
  for (const control of ['neighborhood', 'category', 'evaluation']) {
    const values = await page.locator(`#${control} option`).evaluateAll(nodes => nodes.map(node => node.value));
    for (const value of values) {
      await page.selectOption(`#${control}`, value);
      const ids = await page.locator('.property-card').evaluateAll(nodes => nodes.map(node => node.dataset.propertyId));
      const expected = Array.from(data.filter(p => ids.includes(p.id) && ['verified', 'street'].includes(p.geocoding.status)), p => p.id).sort();
      const actual = await page.locator('.property-marker').evaluateAll(nodes => nodes.map(node => node.dataset.propertyId).sort());
      assert.deepEqual(actual, expected);
      assert.ok(await page.evaluate(() => { const controller = window.LCRE_Map.controller; return [...controller.markers.values()].every(marker => controller.map.getBounds().contains(marker.getLatLng())); }));
    }
    await page.selectOption(`#${control}`, '');
  }
  await page.selectOption('#neighborhood', 'Garbatella');
  await page.fill('#max-price', '250000');
  assert.equal(await page.locator('.property-card').count(), 4);
  assert.equal(await page.locator('.property-marker').count(), 4);
  assert.equal(await page.locator('#map-review-list li').count(), 0);
  await page.click('#filters button[type="reset"]');
  await page.waitForFunction(() => document.querySelectorAll('.property-marker').length === 30);
  // Street-level markers must be labeled as indicative and link to their own lot.
  const streetLots = Array.from(data.filter(p => p.geocoding.status === 'street'));
  for (const p of streetLots) {
    await page.evaluate(id => window.LCRE_Map.controller.markers.get(id).openPopup(), p.id);
    await page.waitForFunction(() => document.querySelectorAll('.map-popup').length === 1);
    assert.equal(await page.locator('.popup-location-note').innerText(), 'Posizione indicativa della via · civico non disponibile');
    await page.click(`.popup-card-button[data-card-id="${p.id}"]`);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.propertyId), p.id);
  }
  const odescalchi = streetLots.filter(p => p.address === 'Viale C. T. Odescalchi');
  assert.equal(odescalchi.length, 3);
  const anchors = await page.evaluate(ids => ids.map(id => window.LCRE_Map.controller.markers.get(id).options.icon.options.iconAnchor), odescalchi.map(p => p.id));
  assert.equal(new Set(anchors.map(JSON.stringify)).size, 3);
  // Identical coordinates keep all five Annio Felice lots individually accessible.
  await page.selectOption('#neighborhood', 'Ardeatino');
  const shared = data.filter(p => p.address === 'Via Annio Felice 26');
  const sharedLocations = await page.evaluate(ids => ids.map(id => { const marker = window.LCRE_Map.controller.markers.get(id); return { location: marker.getLatLng(), anchor: marker.options.icon.options.iconAnchor }; }), shared.map(p => p.id));
  assert.equal(new Set(sharedLocations.map(p => JSON.stringify(p.location))).size, 1);
  assert.equal(new Set(sharedLocations.map(p => JSON.stringify(p.anchor))).size, 5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const p of shared) {
    await page.evaluate(id => window.LCRE_Map.controller.markers.get(id).openPopup(), p.id);
    await page.waitForFunction(() => document.querySelectorAll('.map-popup').length === 1);
    assert.ok((await page.locator('.map-popup').innerText()).includes(p.lot));
    await page.click(`.popup-card-button[data-card-id="${p.id}"]`);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.propertyId), p.id);
    assert.ok(await page.locator(`.property-card[data-property-id="${p.id}"]`).evaluate(node => node.classList.contains('is-selected')));
  }
  await page.click(`.card-map-button[data-map-property="${shared[0].id}"]`);
  await page.waitForFunction(() => document.querySelectorAll('.map-popup').length === 1);
  assert.ok((await page.locator('.map-popup').innerText()).includes(shared[0].lot));
  await page.click('#filters button[type="reset"]');
  await page.waitForFunction(() => document.querySelectorAll('.property-marker').length === 30);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const mode of modes) {
    await page.selectOption('#sort', mode);
    const ids = await page.locator('.property-card').evaluateAll(nodes => nodes.map(n => n.dataset.propertyId));
    assert.deepEqual(ids, Array.from(select(data, {}, mode), p => p.id));
  }
  await page.selectOption('#sort', 'evaluation');
  await page.evaluate(() => { document.activeElement.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  const qa = path.join(path.dirname(root), 'qa');
  await fs.mkdir(qa, { recursive: true });
  await page.screenshot({ path: path.join(qa, 'desktop.png'), fullPage: false });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}`);
    const columns = await page.locator('#properties').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width <= 700 ? 1 : width <= 1000 ? 2 : 3);
    assert.equal((await page.locator('#property-map').boundingBox()).height, width <= 700 ? 350 : 480);
    if (width <= 700) {
      const size = await page.locator('.official-link').first().boundingBox();
      assert.ok(size.height >= 44);
      const cardHeight = (await page.locator('.property-card').first().boundingBox()).height;
      console.log(`Mobile ${width}px: first card ${Math.round(cardHeight)}px high.`);
      if (cardHeight >= 450) await page.locator('.property-card').first().screenshot({ path: path.join(qa, `card-${width}.png`) });
      assert.ok(cardHeight < 480, `Mobile card is not compact at ${width}: ${cardHeight}px`);
    }
    if (width === 390) {
      await page.evaluate(id => window.LCRE_Map.controller.markers.get(id).openPopup(), streetLots[0].id);
      await page.locator('#map-section').screenshot({ path: path.join(qa, 'street-mobile.png') });
      await page.evaluate(() => window.LCRE_Map.controller.map.closePopup());
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(qa, 'mobile.png') });
      await page.locator('.results-toolbar').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.screenshot({ path: path.join(qa, 'mobile-cards.png') });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    }
  }
  // Keyboard navigation reaches the skip link and all labeled controls.
  await page.reload();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.ok(requests.every(url => url.startsWith(new URL('.', base).href) || url.startsWith('https://tile.openstreetmap.org/')), 'Unexpected external runtime request');
  assert.ok(requests.every(url => !url.includes('nominatim') && !url.includes('/geoserver/')), 'Runtime geocoding request');
  // Also verify direct file preview: no fetch, modules or server dependency.
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  assert.equal(await page.locator('.property-card').count(), 30);
  assert.equal(errors.length, 0, errors.join('\n'));
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touch = await mobile.newPage();
  await touch.route('https://tile.openstreetmap.org/**', route => route.abort());
  await touch.goto(pathToFileURL(path.join(root, 'index.html')).href);
  assert.equal(await touch.evaluate(() => window.LCRE_Map.controller.map.dragging.enabled()), false);
  assert.equal(await touch.locator('#property-map').evaluate(node => getComputedStyle(node).touchAction), 'pan-y');
  await touch.click('#map-interaction');
  assert.equal(await touch.evaluate(() => window.LCRE_Map.controller.map.dragging.enabled()), true);
  assert.equal(await touch.evaluate(() => window.LCRE_Map.controller.map.touchZoom.enabled()), true);
  assert.equal(await touch.locator('#property-map').evaluate(node => getComputedStyle(node).touchAction), 'none');
  await touch.click('#map-interaction');
  assert.equal(await touch.evaluate(() => window.LCRE_Map.controller.map.dragging.enabled()), false);
  await mobile.close();
  console.log('PASS: 30 cards/markers, 59 unchanged URLs, 26 civic positions/4 clearly labeled street positions, all filter values, shared markers, popup/card navigation, reset, six sorts, seven widths, mobile gestures, no runtime geocoding. Automated tiles replaced by a test fixture.');
} finally {
  await browser.close();
}
