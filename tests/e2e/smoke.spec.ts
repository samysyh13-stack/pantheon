// End-to-end smoke test — Phase 2 T-107 (orchestrator-written).
//
// Exercises the full menu → match → pause → menu loop against a local
// preview build. Verifies:
//   - Main menu title + Play button render
//   - Play → GodSelect → Start Match flow advances screen state
//   - Match-scene HUD elements mount (HPBar, MatchTimer, ability radials)
//   - Escape key toggles the Pause menu overlay
//   - Pause menu Resume dismisses without losing match state
//   - Zero console errors across the whole flow
//
// This is a "smoke" level QA — it does NOT validate combat feel, balance,
// or the bot AI in a match-realistic way. Those require human playtest or
// a dedicated simulated-match harness (deferred to Phase 3 polish).

import { test, expect } from '@playwright/test';

test.describe('Phase 2 smoke — menu → match loop', () => {
  test('full flow: menu → god select → match → pause → resume', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });
    // First-visit tutorial overlay (Phase 3 UX polish); dismiss before
    // exercising the menu flow. Safe no-op on subsequent runs if the
    // Dexie-persisted hasSeenTutorial survived (Playwright contexts start
    // fresh by default, so the overlay is shown every test run).
    const gotIt = page.getByRole('button', { name: /Got it/i });
    if (await gotIt.isVisible({ timeout: 1500 }).catch(() => false)) {
      await gotIt.click();
    }

    // Main menu: title + buttons
    await expect(page.getByRole('heading', { name: 'PANTHÉON' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

    // Play → GodSelect
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: /Start Match/i })).toBeVisible({
      timeout: 5_000,
    });

    // Start Match → Loading → auto-advance to 'match' (400 ms per App.tsx)
    await page.getByRole('button', { name: /Start Match/i }).click();

    // Wait for HUD to mount
    await expect(page.getByRole('progressbar', { name: 'Player health' })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('timer', { name: 'Match timer' })).toBeVisible();

    // Escape → PauseMenu overlay
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible({ timeout: 2_000 });

    // Resume → back to match (HUD still visible)
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('progressbar', { name: 'Player health' })).toBeVisible();

    // Ignore known-benign warnings (none expected yet, but keeps the assertion
    // stable against non-fatal drei / WebGL chatter).
    const fatalErrors = consoleErrors.filter(
      (msg) =>
        !/WebGL deprecated/i.test(msg) &&
        !/deprecated API/i.test(msg) &&
        !/DevTools/i.test(msg),
    );
    expect(
      fatalErrors,
      `console errors during menu→match loop:\n${fatalErrors.join('\n')}`,
    ).toEqual([]);
  });

  test('HUD elements all present during match', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });
    // First-visit tutorial overlay (Phase 3 UX polish); dismiss before
    // exercising the menu flow. Safe no-op on subsequent runs if the
    // Dexie-persisted hasSeenTutorial survived (Playwright contexts start
    // fresh by default, so the overlay is shown every test run).
    const gotIt = page.getByRole('button', { name: /Got it/i });
    if (await gotIt.isVisible({ timeout: 1500 }).catch(() => false)) {
      await gotIt.click();
    }
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: /Start Match/i }).click();
    await page.waitForTimeout(1_500); // auto-advance + HUD mount

    // HP bar
    await expect(page.getByRole('progressbar', { name: 'Player health' })).toBeVisible();
    // Match timer
    await expect(page.getByRole('timer', { name: 'Match timer' })).toBeVisible();
    // Ability + ultimate radials (aria-label "Ability ready" OR "Ability cooldown …")
    await expect(
      page.locator('[aria-label^="Ability"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[aria-label^="Ultimate"]').first(),
    ).toBeVisible();
  });

  test('settings overlay opens from main menu and graphics preset select is interactive', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });
    // First-visit tutorial overlay (Phase 3 UX polish); dismiss before
    // exercising the menu flow. Safe no-op on subsequent runs if the
    // Dexie-persisted hasSeenTutorial survived (Playwright contexts start
    // fresh by default, so the overlay is shown every test run).
    const gotIt = page.getByRole('button', { name: /Got it/i });
    if (await gotIt.isVisible({ timeout: 1500 }).catch(() => false)) {
      await gotIt.click();
    }
    await page.getByRole('button', { name: 'Settings' }).click();
    // Graphics tab is default
    await expect(page.getByRole('tab', { name: 'Graphics' })).toBeVisible();
    // Preset select (T-005 Select primitive renders a native <select>)
    const presetSelect = page.locator('select').first();
    await expect(presetSelect).toBeVisible();
    await presetSelect.selectOption('medium');
    // Reloading would persist; we just verify the change landed without error.
    await expect(presetSelect).toHaveValue('medium');
  });
});
