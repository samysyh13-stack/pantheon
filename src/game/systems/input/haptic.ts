// Vibration API wrapper. Android browsers expose `navigator.vibrate`; iOS
// Safari does not (R-02 in /docs/DESIGN_DOCUMENT.md §15). When unavailable we
// log a single console.info on first call so devs see why combat hit-confirms
// are silent on that platform. Combat systems call pulse() in Phase 2.

import { logger } from '../../../utils/logger';

// lib.dom types `vibrate` as a required method returning boolean; on iOS
// Safari the method is physically absent. We reshape it as optional at the
// runtime layer and feature-detect before any call.
type VibrateFn = (pattern: number | readonly number[]) => boolean;

interface MaybeVibrateNavigator {
  vibrate?: VibrateFn;
}

let iosNoticeLogged = false;

function getVibrate(): VibrateFn | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as unknown as MaybeVibrateNavigator;
  return typeof nav.vibrate === 'function' ? nav.vibrate.bind(navigator) : null;
}

function logIosOnce() {
  if (iosNoticeLogged) return;
  iosNoticeLogged = true;
  logger.info(
    'input/haptic',
    'navigator.vibrate unavailable — haptic feedback is a no-op. This is expected on iOS Safari (R-02).',
  );
}

export function pulse(ms: number): boolean {
  if (ms <= 0) return false;
  const vibrate = getVibrate();
  if (!vibrate) {
    logIosOnce();
    return false;
  }
  return vibrate(ms);
}

// Pattern variant for rhythmic feedback (e.g., a combo-confirm double-tap).
// Same fallback semantics as `pulse()`.
export function pulsePattern(pattern: readonly number[]): boolean {
  if (pattern.length === 0) return false;
  const vibrate = getVibrate();
  if (!vibrate) {
    logIosOnce();
    return false;
  }
  return vibrate(pattern);
}

export function stopHaptic(): void {
  const vibrate = getVibrate();
  if (!vibrate) return;
  vibrate(0);
}

// Test-only hook: lets unit tests reset the "already-warned" flag between cases.
export function __resetHapticForTests(): void {
  iosNoticeLogged = false;
}
