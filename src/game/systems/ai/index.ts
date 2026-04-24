// Public surface for the AI bot system (T-105). Consumers should import
// from here. Internal cross-file imports within the folder use relative
// filename paths directly.

export type {
  BotConfig,
  BotDifficulty,
  BotGod,
  BotInputSource,
  BotOpponentState,
  BotSelfState,
  BotWorldSnapshot,
  DifficultyProfile,
  Vec2,
} from './types';
export { DIFFICULTY_PROFILES, resolveDifficultyProfile } from './types';

export type { BTContext, BTNode, BTStatus, BotRuntime } from './behaviorTree';
export {
  Action,
  Condition,
  Cooldown,
  Inverter,
  OnceEvery,
  Parallel,
  Selector,
  Sequence,
  createBotRuntime,
  newFrame,
  tickNode,
} from './behaviorTree';

export { computeAim, distance } from './aim';
export type { AimResult } from './aim';

export { approach, disengage, kite, strafe } from './movement';
export type { MoveMode } from './movement';

export { createEasyTree } from './difficulties/easy';
export { createNormalTree } from './difficulties/normal';
export { createHardTree } from './difficulties/hard';

export { createAnansiBot, BOT_TICK_HZ } from './gods/anansiBot';
