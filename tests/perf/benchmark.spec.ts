// 60-second throttled Chromium benchmark.
//
// Target: live Cloudflare Pages deploy at pantheon-292.pages.dev.
// Throttling: CPU 4x (via CDP Emulation.setCPUThrottlingRate).
// Viewport: iPhone 12 (390×844 @ 3× DPR) — the mobile-floor target.
//
// Measures rAF frame times for 60 s inside the match scene and reports
// p50 / p95 / p99 / avg FPS. Writes a machine-readable JSON artifact to
// tests/perf/results.json for the orchestrator to ingest into PROGRESS.md.

import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_URL = process.env.BENCHMARK_URL ?? 'https://pantheon-292.pages.dev';
const MEASURE_MS = Number(process.env.BENCHMARK_DURATION_MS ?? 60_000);
const RESULTS_PATH = path.join(process.cwd(), 'tests', 'perf', 'results.json');

interface FrameStats {
  avgFps: number;
  p50Fps: number;
  p95Fps: number;
  p99Fps: number;
  frameCount: number;
  durationMs: number;
  targetUrl: string;
  timestamp: string;
}

test('throttled-chromium 60s match benchmark', async ({ browser }) => {
  test.setTimeout(MEASURE_MS + 60_000); // benchmark + setup + teardown

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // eslint-disable-next-line no-console
  console.log(`[bench] navigating to ${TARGET_URL} with 4x CPU throttle, iPhone-12 viewport`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('canvas', { timeout: 15_000 });

  // Drive the UI from menu → match via the public store. Shipping app
  // exposes zustand's getState via our store module namespace if needed;
  // simplest approach is to click through the UI.
  // Main menu Play button → god-select
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(300);
  // god-select → Start Match
  await page.getByRole('button', { name: /Start Match/i }).click();
  // Loading auto-advances to 'match' after 400 ms (App.tsx loading hook)
  await page.waitForTimeout(1000);

  // eslint-disable-next-line no-console
  console.log(`[bench] measuring ${MEASURE_MS / 1000}s of frames`);

  const stats: FrameStats = await page.evaluate<FrameStats, number>((durationMs) => {
    return new Promise<FrameStats>((resolve) => {
      const frames: number[] = [];
      const start = performance.now();
      let last = start;
      const loop = (now: number) => {
        frames.push(now - last);
        last = now;
        if (now - start < durationMs) {
          requestAnimationFrame(loop);
        } else {
          frames.sort((a, b) => a - b);
          const total = frames.reduce((s, v) => s + v, 0);
          const avgMs = total / frames.length;
          const pct = (p: number) => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))] ?? 0;
          resolve({
            avgFps: 1000 / avgMs,
            p50Fps: 1000 / pct(0.5),
            p95Fps: 1000 / pct(0.95),
            p99Fps: 1000 / pct(0.99),
            frameCount: frames.length,
            durationMs: now - start,
            targetUrl: location.href,
            timestamp: new Date().toISOString(),
          });
        }
      };
      requestAnimationFrame(loop);
    });
  }, MEASURE_MS);

  // eslint-disable-next-line no-console
  console.log(
    `[bench] avg=${stats.avgFps.toFixed(1)} p50=${stats.p50Fps.toFixed(1)} p95=${stats.p95Fps.toFixed(1)} p99=${stats.p99Fps.toFixed(1)} frames=${stats.frameCount}`,
  );
  if (consoleErrors.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[bench] ${consoleErrors.length} console error(s):`, consoleErrors.slice(0, 5));
  }

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify({ ...stats, consoleErrors: consoleErrors.slice(0, 20) }, null, 2),
  );
  // eslint-disable-next-line no-console
  console.log(`[bench] results written to ${RESULTS_PATH}`);

  await context.close();
});
