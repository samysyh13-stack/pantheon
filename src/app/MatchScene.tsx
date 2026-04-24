// Match scene — Phase 2 orchestrator integration.
//
// Assembles the full vertical slice: player Anansi (driven by the human
// InputManager), bot Anansi (driven by T-105's createAnansiBot), Sacred
// Grove arena, and a tracking camera following the player.
//
// Lifecycle:
//   - Creates InputManager + AnansiBot on mount; disposes manager on
//     unmount so its rAF loop doesn't leak across match sessions.
//   - Each frame: compute BotWorldSnapshot from both Anansi handles'
//     positions (with simple finite-difference velocity for opponent
//     lead-prediction on Hard), feed bot.update(snap). The bot's
//     snapshot(playerIndex) is consumed by the bot Anansi's Character
//     component on its own useFrame tick.
//
// Deferred to Phase 3:
//   - Difficulty selection UI (hardcoded 'normal' in Phase 2 per default)
//   - Real HP + ult-charge propagation from combat layer (placeholder 320
//     and 0 used here). The bot's HP-ratio kite/disengage gates behave as
//     if both sides are full HP until combat lands — acceptable for the
//     Phase 2 gate because movement + positioning dominate behavior at
//     full HP.
//   - Score + match state machine driving timerMs, scoreP0, scoreP1.

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

import { Anansi } from '../game/gods/anansi/Anansi';
import { SacredGrove, SPAWN_POINTS } from '../game/arenas/sacredGrove';
import { TrackingCamera } from '../game/entities/character/Camera';
import type { CharacterHandle } from '../game/entities/character/Character';
import {
  create as createInputManager,
  type InputManager,
} from '../game/systems/input/manager';
import { createAnansiBot } from '../game/systems/ai/gods/anansiBot';
import type { BotInputSource, BotWorldSnapshot } from '../game/systems/ai/types';
import { TICK_DT } from '../game/engine/loop';

// Constant per-bot tuning for Phase 2. Difficulty selector is T-106+ in Phase 3.
const BOT_DIFFICULTY = 'normal' as const;
const BOT_SEED = 0xa0a051; // Anansi trickster seed (arbitrary); deterministic replay key

function BotTicker({
  bot,
  playerRef,
  botRef,
}: {
  bot: BotInputSource;
  playerRef: React.RefObject<CharacterHandle | null>;
  botRef: React.RefObject<CharacterHandle | null>;
}) {
  const tickRef = useRef(0);
  const prevPlayerPos = useRef(new Vector3());
  const prevBotPos = useRef(new Vector3());
  const playerVel = useRef(new Vector3());

  useFrame((_state, dt) => {
    const pHandle = playerRef.current;
    const bHandle = botRef.current;
    if (!pHandle || !bHandle) return;

    const pPos = pHandle.getWorldPosition();
    const bPos = bHandle.getWorldPosition();

    // Finite-difference player velocity for Hard's prediction lead. Clamp
    // dt to avoid spike-velocity on first frame when prev is (0,0,0).
    const safeDt = dt > 1e-4 ? dt : TICK_DT;
    if (tickRef.current > 0) {
      playerVel.current.copy(pPos).sub(prevPlayerPos.current).divideScalar(safeDt);
    }
    prevPlayerPos.current.copy(pPos);
    prevBotPos.current.copy(bPos);

    tickRef.current += 1;

    // BotWorldSnapshot uses Vec2 aliasing XZ as { x, y }: x → world X,
    // y → world Z (per types.ts doc comment).
    const snap: BotWorldSnapshot = {
      self: {
        pos: { x: bPos.x, y: bPos.z },
        hp: 320, // TODO(Phase 3): real HP from combat layer
        maxHp: 320,
        abilityCdMs: 0, // TODO(Phase 3): real cooldown tracking
        ultCharge: 0,
        isDodging: bHandle.getState() === 'dodging',
      },
      opponent: {
        pos: { x: pPos.x, y: pPos.z },
        hp: 320,
        maxHp: 320,
        lastKnownVelocity: { x: playerVel.current.x, y: playerVel.current.z },
      },
      tick: tickRef.current,
      dt: safeDt,
    };
    bot.update(snap);
  });

  return null;
}

export function MatchScene() {
  const playerHandleRef = useRef<CharacterHandle | null>(null);
  const botHandleRef = useRef<CharacterHandle | null>(null);

  // Input manager + bot created in an effect (React 19 Strict Mode double-
  // invokes useMemo callbacks; effect cleanup is the safe idiom for
  // side-effectful resources like the manager's rAF loop).
  const [inputMgr, setInputMgr] = useState<InputManager | null>(null);
  const [bot, setBot] = useState<BotInputSource | null>(null);

  useEffect(() => {
    const mgr = createInputManager({ playerCount: 1 });
    const b = createAnansiBot({
      difficulty: BOT_DIFFICULTY,
      seed: BOT_SEED,
      playerIndex: 1,
      god: 'anansi',
    });
    setInputMgr(mgr);
    setBot(b);
    return () => {
      mgr.dispose();
    };
  }, []);

  if (!inputMgr || !bot) return null;

  return (
    <>
      <SacredGrove />
      <Anansi
        position={[SPAWN_POINTS.p0.x, SPAWN_POINTS.p0.y, SPAWN_POINTS.p0.z]}
        playerIndex={0}
        inputSource={inputMgr}
        onHandleReady={(h) => {
          playerHandleRef.current = h;
        }}
      />
      <Anansi
        position={[SPAWN_POINTS.p1.x, SPAWN_POINTS.p1.y, SPAWN_POINTS.p1.z]}
        playerIndex={1}
        inputSource={bot}
        seed={0xb07707} // mirror seed so cosmetic rng (if any) diverges from player
        onHandleReady={(h) => {
          botHandleRef.current = h;
        }}
      />
      <BotTicker bot={bot} playerRef={playerHandleRef} botRef={botHandleRef} />
      <TrackingCamera target={playerHandleRef} />
    </>
  );
}
