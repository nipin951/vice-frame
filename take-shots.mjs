// Photographs the app exactly as shots.json describes, with a stock headless Chromium
// (puppeteer, installed outside the repo): each shot opens the app with its ?shot= query at
// its window size, waits for the app to signal window.__shotReady, and saves a JPEG of the
// viewport into screenshots/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/tmp/vf-tools/package.json');
const puppeteer = require('puppeteer');

const here = dirname(fileURLToPath(import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const APP_URL = 'http://127.0.0.1:8901';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  for (const shot of shots) {
    await page.setViewport({ width: shot.w, height: shot.h, deviceScaleFactor: 1 });
    await page.goto(APP_URL + '/' + shot.query, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction('window.__shotReady === true', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: join(here, 'screenshots', shot.name), type: 'jpeg', quality: 88 });
    console.log('saved', shot.name);
  }
} finally {
  await browser.close();
}
