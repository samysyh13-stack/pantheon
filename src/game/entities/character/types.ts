// Character entity types (T-004 AE).
//
// These are the shared type primitives consumed by the controller, animation
// FSM, and the <Character> R3F component. Everything here is pure type
// information — no runtime behaviour, no side effects, no three.js imports.
// Keeping the types quarantined from the render and simulation layers means
// tests (notably /tests/unit/characterFSM.test.ts) can import them without
// pulling in the @react-three/rapier WASM boot path.

/**
 * Discrete animation + simulation states for a character. Transitions are
 * driven by `animationFSM.ts` (which also owns the time-in-state budget for
 * each state) and consumed by `controller.ts` (for gating things like
 * dodge invulnerability and movement suppression during attacks).
 */
export type CharacterState =
  | 'idle'
  | 'running'
  | 'attacking'
  | 'dodging'
  | 'hit'
  | 'dead';

/**
 * Numeric stat block for a god. All values are in SI-ish units (metres /
 * second, metres / second^2) except `dashDurationMs` and `dashCooldownMs`
 * which are milliseconds. The 14-day god roster in DESIGN_DOCUMENT §6 keeps
 * this small — no armour, no shield, no elemental res (per ADR-0004's
 * determinism commitment and ADR-0008's "HP + active defences only"
 * principle).
 *
 * Phase 2 combat (T-100 CB + hit-confirm pipeline in DESIGN §8) will read
 * `maxHp` as the starting HP value; the controller does not track HP here
 * (HP lives in the match slice / entity runtime record).
 */
export interface CharacterStats {
  /** Starting / cap hit points. Anansi 320, Brigid 380, Susanoo 420. */
  maxHp: number;
  /** Ground move speed cap (m/s). Anansi ~5 m/s baseline. */
  moveSpeed: number;
  /** Peak speed during a dodge roll (m/s). Typically 2.5-3× moveSpeed. */
  dashSpeed: number;
  /** Duration of the dodge roll (ms). DESIGN §4 pegs i-frame window = 300 ms. */
  dashDurationMs: number;
  /** Minimum time between dodge roll activations (ms). DESIGN §4 = 3 s. */
  dashCooldownMs: number;
}

/**
 * Configuration bundle passed into the controller at construction time.
 * Separates the tuning numbers (`stats`) from the runtime context (starting
 * position, seed for deterministic RNG draws in Phase 2 features like
 * footstep pickers).
 */
export interface CharacterConfig {
  stats: CharacterStats;
  /**
   * Deterministic RNG seed (ADR-0006). The controller itself doesn't need
   * randomness today, but the seed is threaded through so Phase 2 features
   * (footstep surface picks, hit-flash variation) can branch from a
   * per-character seed and the replay log stays reproducible.
   */
  seed: number;
}
