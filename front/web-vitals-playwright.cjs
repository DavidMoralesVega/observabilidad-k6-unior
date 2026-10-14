// Web Vitals (LCP, CLS, INP) medidos desde Playwright con la librería oficial web-vitals.
// Uso (desde front/):  node web-vitals-playwright.cjs [url] [headed] [--lento]
//   Antes, una sola vez:  npm install  y  npx playwright install chromium
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
// Ojo: addInitScript envuelve el código en una función, así que `var webVitals` no queda global;
// lo colgamos de window a mano.
const WEB_VITALS = fs.readFileSync(path.join(__dirname, 'node_modules/web-vitals/dist/web-vitals.iife.js'), 'utf8') + ';window.webVitals = webVitals;';

(async () => {
  const url = process.argv.slice(2).find((a) => a.startsWith('http')) || 'https://learn-unior.web.app/programas/';
  const headless = !process.argv.includes('headed');
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1) La librería se carga ANTES que la página, y cada métrica se guarda en window.__vitals
  await page.addInitScript({ content: WEB_VITALS });
  await page.addInitScript(() => {
    window.__vitals = {};
    window.__events = [];
    const guardar = (m) => (window.__vitals[m.name] = { value: m.value, rating: m.rating });
    addEventListener('DOMContentLoaded', () => {
      webVitals.onLCP(guardar, { reportAllChanges: true });
      webVitals.onCLS(guardar, { reportAllChanges: true });
      webVitals.onINP(guardar, { reportAllChanges: true });
      webVitals.onFCP(guardar);
      webVitals.onTTFB(guardar);
      // Control: entradas crudas de Event Timing (lo que usa INP por dentro)
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__events.push({ name: e.name, duration: e.duration, interactionId: e.interactionId })))
        .observe({ type: 'event', durationThreshold: 16, buffered: true });
    });
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  // Modo demostración: un manejador de clic que bloquea el hilo principal 300 ms
  if (process.argv.includes('--lento')) {
    await page.evaluate(() => document.addEventListener('click', () => { const t = performance.now(); while (performance.now() - t < 300); }));
  }

  // 2) INP necesita interacciones reales: clic y teclado
  await page.mouse.click(640, 300);
  const enlace = page.getByRole('link').first();
  await enlace.hover();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.mouse.click(200, 500);
  await page.waitForTimeout(1500);

  // 3) LCP y CLS se "cierran" cuando la pestaña se oculta: lo simulamos
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);

  const vitals = await page.evaluate(() => window.__vitals);
  const events = await page.evaluate(() => window.__events);
  // 4) Resultado: una línea por métrica (CLS no tiene unidad; el resto, en milisegundos)
  console.log(`${url}  (Chromium ${browser.version()}, ${headless ? 'headless' : 'con ventana'})`);
  for (const nombre of ['LCP', 'CLS', 'INP', 'FCP', 'TTFB']) {
    const m = vitals[nombre];
    if (!m) { console.log(`${nombre.padEnd(5)} sin dato`); continue; }
    const valor = nombre === 'CLS' ? m.value.toFixed(4) : `${Math.round(m.value)} ms`;
    console.log(`${nombre.padEnd(5)} ${valor.padStart(8)}   ${m.rating}`);
  }
  const inter = events.filter((e) => e.interactionId > 0);
  console.log(`eventos de interacción medidos: ${inter.length} (sin interacciones no hay INP)`);
  await browser.close();
})();
