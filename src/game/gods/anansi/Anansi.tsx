// Anansi minimal wrapper (T-004 AE — scope-light, full kit is T-100 CB).
//
// Thin forwarder around <Character>. Only sets the god-specific numbers
// that are locked in the design doc / ADRs:
//   - HP 320 (ADR-0008 role-tiered HP)
//   - Move speed 5 m/s (DESIGN §6.1 "ranged kiter" feel target)
//   - Signature color gold #D4A24A (DESIGN §6.1)
//
// Everything else (Silken Dart projectile, Mirror Thread clone AI,
// Eight-Strand Dome ultimate) is Phase 2 / T-100 scope. This file exists
// so the orchestrator has a concrete consumer to verify the Character
// component integrates cleanly.

import { Character, type CharacterHandle, type InputSource } from '../../entities/character';
import type { CharacterStats } from '../../entities/character';
import type { PlayerIndex } from '../../systems/input';

const ANANSI_STATS: CharacterStats = {
  maxHp: 320, // ADR-0008
  moveSpeed: 5, // DESIGN §6.1
  dashSpeed: 12, // 2.4× moveSpeed — standard brawler dodge-speed-to-walk ratio
  dashDurationMs: 300, // DESIGN §4 "dodge roll i-frames"
  dashCooldownMs: 3000, // DESIGN §4 controls table
};

export interface AnansiProps {
  position: [number, number, number];
  playerIndex: PlayerIndex;
  inputSource: InputSource;
  seed?: number;
  onHandleReady?: (handle: CharacterHandle) => void;
}

export function Anansi(props: AnansiProps) {
  return (
    <Character
      stats={ANANSI_STATS}
      position={props.position}
      playerIndex={props.playerIndex}
      inputSource={props.inputSource}
      color="#d4a24a"
      rimColor="#ffd48a"
      seed={props.seed ?? 0xa0a051}
      {...(props.onHandleReady ? { onHandleReady: props.onHandleReady } : {})}
    />
  );
}
