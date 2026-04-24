// Generic behavior tree primitives (T-105 AI).
//
// Minimalist API: every node is a tagged union; `tick(ctx)` returns
// `Success | Failure | Running`. Side-effects (setting bits on the
// in-progress InputFrame, scheduling reactions) are written to the
// shared `BTContext` — nodes don't allocate output each call.
//
// Why tagged unions over OO / functions-with-closures?
//   - ADR-0006 determinism: each node's runtime state is a small
//     indexable record (`_state`) tracked by the tree. We can serialize a
//     tree's state to a replay log if Phase 3 / networking needs it.
//   - Zero allocation on the hot path — one BT instance per bot per match,
//     no closures constructed each tick.
//
// Nodes supported:
//   - Composites: Sequence, Selector, Parallel
//   - Leaves:     Condition, Action
//   - Decorators: Inverter, Cooldown (N ticks), OnceEvery (N ticks)
//
// API surface is deliberately tight — ~150 LOC. If Phase 3 needs blackboard
// reads across subtrees, extend `BTContext` rather than adding new node
// kinds.

import type { InputFrame, PlayerIndex } from '../input';
import { createEmptyFrame } from '../input';
import type { BotWorldSnapshot, DifficultyProfile } from './types';

export type BTStatus = 'success' | 'failure' | 'running';

/**
 * Per-bot persistent state — carried across ticks. Tree leaves read/write
 * fields on it to track reactions, strafe phase, telegraph timers, etc.
 * Kept as a loose record (string-keyed numbers) so new leaves can add
 * fields without a type explosion; the god-specific bot module owns the
 * canonical shape at creation time.
 */
export interface BotRuntime {
  /** Tick index at which the current telegraph pause began. -Infinity = none. */
  telegraphStartTick: number;
  /** Tick index at which the most recent cast-reaction delay began. */
  lastReactCastTick: number;
  /** +1 or -1; flipped every strafe-flip interval. */
  strafeSign: 1 | -1;
  /** Tick index of the last strafe-sign flip. */
  lastStrafeFlipTick: number;
  /** Tick index when the last basic-attack fire was emitted. */
  lastBasicFireTick: number;
  /** Tick index when the last ability press was emitted. */
  lastAbilityFireTick: number;
  /** Tick index when the last ultimate press was emitted. */
  lastUltimateFireTick: number;
}

/**
 * The per-tick evaluation context. Nodes read snapshot + profile, write
 * bits of the output `frame`. Only one frame object exists per tree tick;
 * leaves mutate fields (moveX, basicAttack, etc.) in place.
 */
export interface BTContext {
  snapshot: BotWorldSnapshot;
  profile: DifficultyProfile;
  frame: InputFrame;
  /** Seed root for rng draws this tick. */
  rngSeed: number;
  /** Per-bot persistent state, mutated by tree leaves. */
  bot: BotRuntime;
}

export function createBotRuntime(): BotRuntime {
  return {
    telegraphStartTick: -Infinity,
    lastReactCastTick: -Infinity,
    strafeSign: 1,
    lastStrafeFlipTick: 0,
    lastBasicFireTick: -Infinity,
    lastAbilityFireTick: -Infinity,
    lastUltimateFireTick: -Infinity,
  };
}

export interface BTNodeBase {
  /** Optional debug label — not load-bearing, useful for test assertions. */
  label?: string;
}

export interface ConditionNode extends BTNodeBase {
  kind: 'condition';
  check: (ctx: BTContext) => boolean;
}

export interface ActionNode extends BTNodeBase {
  kind: 'action';
  /** Mutates ctx.frame; returns the status of the action. */
  act: (ctx: BTContext) => BTStatus;
}

export interface SequenceNode extends BTNodeBase {
  kind: 'sequence';
  children: readonly BTNode[];
}

export interface SelectorNode extends BTNodeBase {
  kind: 'selector';
  children: readonly BTNode[];
}

export interface ParallelNode extends BTNodeBase {
  kind: 'parallel';
  children: readonly BTNode[];
  /** Succeeds when this many children succeed. Default = all. */
  minSuccess?: number;
}

export interface InverterNode extends BTNodeBase {
  kind: 'inverter';
  child: BTNode;
}

export interface CooldownNode extends BTNodeBase {
  kind: 'cooldown';
  cooldownTicks: number;
  child: BTNode;
}

export interface OnceEveryNode extends BTNodeBase {
  kind: 'onceEvery';
  intervalTicks: number;
  child: BTNode;
}

export type BTNode =
  | ConditionNode
  | ActionNode
  | SequenceNode
  | SelectorNode
  | ParallelNode
  | InverterNode
  | CooldownNode
  | OnceEveryNode;

/**
 * Decorator state keyed by node identity (reference equality). WeakMap
 * keeps it GC-safe if a subtree is replaced mid-session (not used in v1
 * but cheap to support).
 */
interface DecoratorState {
  lastFireTick: number;
}
const DECORATOR_STATE: WeakMap<BTNode, DecoratorState> = new WeakMap();

function stateOf(node: BTNode): DecoratorState {
  let s = DECORATOR_STATE.get(node);
  if (!s) {
    s = { lastFireTick: -Infinity };
    DECORATOR_STATE.set(node, s);
  }
  return s;
}

/**
 * Evaluate a node. Pure dispatch on `kind` — monomorphic branches keep the
 * JIT predictable. Parallel evaluates every child each tick (composites
 * short-circuit; Parallel does not, by definition).
 */
export function tickNode(node: BTNode, ctx: BTContext): BTStatus {
  switch (node.kind) {
    case 'condition':
      return node.check(ctx) ? 'success' : 'failure';

    case 'action':
      return node.act(ctx);

    case 'sequence': {
      for (const child of node.children) {
        const s = tickNode(child, ctx);
        if (s !== 'success') return s;
      }
      return 'success';
    }

    case 'selector': {
      for (const child of node.children) {
        const s = tickNode(child, ctx);
        if (s !== 'failure') return s;
      }
      return 'failure';
    }

    case 'parallel': {
      const min = node.minSuccess ?? node.children.length;
      let succ = 0;
      let running = false;
      for (const child of node.children) {
        const s = tickNode(child, ctx);
        if (s === 'success') succ++;
        else if (s === 'running') running = true;
      }
      if (succ >= min) return 'success';
      if (running) return 'running';
      return 'failure';
    }

    case 'inverter': {
      const s = tickNode(node.child, ctx);
      if (s === 'success') return 'failure';
      if (s === 'failure') return 'success';
      return 'running';
    }

    case 'cooldown': {
      const st = stateOf(node);
      if (ctx.snapshot.tick - st.lastFireTick < node.cooldownTicks) return 'failure';
      const s = tickNode(node.child, ctx);
      if (s === 'success') st.lastFireTick = ctx.snapshot.tick;
      return s;
    }

    case 'onceEvery': {
      const st = stateOf(node);
      if (ctx.snapshot.tick - st.lastFireTick < node.intervalTicks) return 'failure';
      const s = tickNode(node.child, ctx);
      if (s !== 'failure') st.lastFireTick = ctx.snapshot.tick;
      return s;
    }
  }
}

// ── Thin constructor helpers (saves repetitive `kind:` literals in
//    difficulty / god modules, and enables autocompletion) ─────────────
export const Condition = (
  check: ConditionNode['check'],
  label?: string,
): ConditionNode => ({ kind: 'condition', check, ...(label ? { label } : {}) });

export const Action = (act: ActionNode['act'], label?: string): ActionNode => ({
  kind: 'action',
  act,
  ...(label ? { label } : {}),
});

export const Sequence = (
  children: readonly BTNode[],
  label?: string,
): SequenceNode => ({ kind: 'sequence', children, ...(label ? { label } : {}) });

export const Selector = (
  children: readonly BTNode[],
  label?: string,
): SelectorNode => ({ kind: 'selector', children, ...(label ? { label } : {}) });

export const Parallel = (
  children: readonly BTNode[],
  minSuccess?: number,
  label?: string,
): ParallelNode => ({
  kind: 'parallel',
  children,
  ...(minSuccess !== undefined ? { minSuccess } : {}),
  ...(label ? { label } : {}),
});

export const Inverter = (child: BTNode, label?: string): InverterNode => ({
  kind: 'inverter',
  child,
  ...(label ? { label } : {}),
});

export const Cooldown = (
  cooldownTicks: number,
  child: BTNode,
  label?: string,
): CooldownNode => ({ kind: 'cooldown', cooldownTicks, child, ...(label ? { label } : {}) });

export const OnceEvery = (
  intervalTicks: number,
  child: BTNode,
  label?: string,
): OnceEveryNode => ({ kind: 'onceEvery', intervalTicks, child, ...(label ? { label } : {}) });

/**
 * Build a starting InputFrame for the BT to mutate this tick. All bits
 * start cleared; leaves set what they want. Factored into a helper so the
 * bot factory doesn't duplicate the literal.
 */
export function newFrame(playerIndex: PlayerIndex): InputFrame {
  return createEmptyFrame(playerIndex, 'gamepad');
}
