// Capture the four entry screenshots listed in shots.json.
// Expects the app already serving on port 8901 (`node serve.ts --port 8901`).
// Uses puppeteer installed at /tmp/vf-tools (outside the repo).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const puppeteer = createRequire("/tmp/vf-tools/package.json")("puppeteer");
const root = dirname(fileURLToPath(import.meta.url));
const shots = JSON.parse(readFileSync(join(root, "shots.json"), "utf8"));
const base = "http://127.0.0.1:8901";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  mkdirSync(join(root, "screenshots"), { recursive: true });
  for (const s of shots) {
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
    await page.goto(base + "/" + s.query, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction("window.__shotReady === true", { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: join(root, "screenshots", s.name), type: "jpeg", quality: 88 });
    console.log("saved", s.name, `${s.w}x${s.h}`);
  }
} finally {
  await browser.close();
}
