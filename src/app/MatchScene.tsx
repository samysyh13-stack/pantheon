// Match scene — Phase 3 integration.
//
// Assembles: player Anansi + bot Anansi (T-105 AI), Sacred Grove arena,
// tracking camera, combat MVP (projectiles + hit detection + HP apply),
// match state machine (rounds / scoring / win-loss), music layer transition.
//
// Determinism preserved throughout (ADR-0006): bot.update and
// matchController.tick are both pure over (snap, tick) and (dt) inputs;
// projectile motion uses the same dt supplied by useFrame.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

import { Anansi } from '../game/gods/anansi/Anansi';
import { SacredGrove, SPAWN_POINTS } from '../game/arenas/sacredGrove';
import { TrackingCamera } from '../game/entities/character/Camera';
import type { CharacterHandle } from '../game/entities/character/Character';
import type { CharacterState } from '../game/entities/character/types';
import {
  create as createInputManager,
  type InputManager,
} from '../game/systems/input/manager';
import { createAnansiBot } from '../game/systems/ai/gods/anansiBot';
import type { BotInputSource, BotWorldSnapshot } from '../game/systems/ai/types';
import { TICK_DT } from '../game/engine/loop';
import { createMatchController, type MatchController } from '../game/match/StateMachine';
import { Projectile } from '../game/systems/combat';
import { playSfx, setMusicLayer } from '../game/systems/audio';
import { useAppStore } from '../state/store';

const BOT_DIFFICULTY = 'normal' as const;
const BOT_SEED = 0xa0a051;

const SILKEN_DART_SPEED = 25; // m/s per DESIGN §6.1
const SILKEN_DART_LIFETIME = 0.4; // s — range 10 m / speed 25 = 0.4
const SILKEN_DART_DAMAGE = 80;

interface ProjectileRec {
  id: number;
  origin: [number, number, number];
  direction: [number, number, number];
  ownerIndex: 0 | 1;
}

function BotTicker({
  bot,
  playerRef,
  botRef,
  matchCtl,
  spawnProjectile,
}: {
  bot: BotInputSource;
  playerRef: React.RefObject<CharacterHandle | null>;
  botRef: React.RefObject<CharacterHandle | null>;
  matchCtl: MatchController;
  spawnProjectile: (owner: 0 | 1, origin: [number, number, number], dir: [number, number, number]) => void;
}) {
  const tickRef = useRef(0);
  const prevPlayerPos = useRef(new Vector3());
  const playerVel = useRef(new Vector3());
  const prevPlayerState = useRef<CharacterState>('idle');
  const prevBotState = useRef<CharacterState>('idle');

  useFrame((_state, dt) => {
    const pHandle = playerRef.current;
    const bHandle = botRef.current;
    if (!pHandle || !bHandle) return;

    const pPos = pHandle.getWorldPosition();
    const bPos = bHandle.getWorldPosition();

    const safeDt = dt > 1e-4 ? dt : TICK_DT;
    if (tickRef.current > 0) {
      playerVel.current.copy(pPos).sub(prevPlayerPos.current).divideScalar(safeDt);
    }
    prevPlayerPos.current.copy(pPos);

    tickRef.current += 1;

    // Bot world snapshot with real-ish HP fed from the match controller.
    const playerHp = matchCtl.getHp(0);
    const botHp = matchCtl.getHp(1);
    const snap: BotWorldSnapshot = {
      self: {
        pos: { x: bPos.x, y: bPos.z },
        hp: botHp,
        maxHp: 320,
        abilityCdMs: 0,
        ultCharge: 0,
        isDodging: bHandle.getState() === 'dodging',
      },
      opponent: {
        pos: { x: pPos.x, y: pPos.z },
        hp: playerHp,
        maxHp: 320,
        lastKnownVelocity: { x: playerVel.current.x, y: playerVel.current.z },
      },
      tick: tickRef.current,
      dt: safeDt,
    };
    bot.update(snap);

    // Match state machine tick — owns round timer + win/loss.
    matchCtl.tick(safeDt);

    // Projectile spawn: detect FSM transition into 'attacking' for each side.
    const pState = pHandle.getState();
    const bState = bHandle.getState();
    if (pState === 'attacking' && prevPlayerState.current !== 'attacking') {
      const dir = directionTo(pPos, bPos);
      spawnProjectile(0, [pPos.x, 1.2, pPos.z], dir);
    }
    if (bState === 'attacking' && prevBotState.current !== 'attacking') {
      const dir = directionTo(bPos, pPos);
      spawnProjectile(1, [bPos.x, 1.2, bPos.z], dir);
    }
    prevPlayerState.current = pState;
    prevBotState.current = bState;
  });

  return null;
}

function directionTo(
  from: Vector3,
  to: Vector3,
): [number, number, number] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const mag = Math.hypot(dx, dz);
  if (mag < 1e-4) return [0, 0, 1];
  return [dx / mag, 0, dz / mag];
}

export function MatchScene() {
  const playerHandleRef = useRef<CharacterHandle | null>(null);
  const botHandleRef = useRef<CharacterHandle | null>(null);

  const [inputMgr, setInputMgr] = useState<InputManager | null>(null);
  const [bot, setBot] = useState<BotInputSource | null>(null);
  const matchCtl = useMemo(() => createMatchController(), []);
  const nextProjectileId = useRef(1);
  const [projectiles, setProjectiles] = useState<ProjectileRec[]>([]);
  const setScreen = useAppStore((s) => s.setScreen);

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
    matchCtl.start();
    // Music: flip to combat layer on match mount; restored to menu on unmount.
    try {
      void setMusicLayer('combat', 500);
    } catch {
      /* audio may be blocked until user gesture — harmless */
    }
    return () => {
      mgr.dispose();
      matchCtl.reset();
      try {
        void setMusicLayer('menu', 500);
      } catch {
        /* ignore */
      }
    };
  }, [matchCtl]);

  // When the match state machine transitions to match-end, flip to results.
  useEffect(() => {
    const check = window.setInterval(() => {
      if (matchCtl.getPhase() === 'match-end') {
        setScreen('results');
      }
    }, 500);
    return () => window.clearInterval(check);
  }, [matchCtl, setScreen]);

  const spawnProjectile = (
    owner: 0 | 1,
    origin: [number, number, number],
    direction: [number, number, number],
  ) => {
    const id = nextProjectileId.current++;
    setProjectiles((cur) => [...cur, { id, origin, direction, ownerIndex: owner }]);
    try {
      void playSfx('whoosh', { volume: 0.9 });
    } catch {
      /* ignore */
    }
  };

  const expireProjectile = (id: number) => {
    setProjectiles((cur) => cur.filter((p) => p.id !== id));
  };

  const hitProjectile = (rec: ProjectileRec) => {
    expireProjectile(rec.id);
    const targetIndex: 0 | 1 = rec.ownerIndex === 0 ? 1 : 0;
    const targetRef = targetIndex === 0 ? playerHandleRef : botHandleRef;
    const target = targetRef.current;
    if (!target) return;
    const landed = target.applyHit(SILKEN_DART_DAMAGE);
    if (!landed) return; // dodge i-frames ate it
    matchCtl.applyDamage(targetIndex, SILKEN_DART_DAMAGE);
    try {
      void playSfx('hit', { volume: 1.0 });
    } catch {
      /* ignore */
    }
  };

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
        seed={0xb07707}
        onHandleReady={(h) => {
          botHandleRef.current = h;
        }}
      />
      <BotTicker
        bot={bot}
        playerRef={playerHandleRef}
        botRef={botHandleRef}
        matchCtl={matchCtl}
        spawnProjectile={spawnProjectile}
      />
      <TrackingCamera target={playerHandleRef} />
      {projectiles.map((p) => (
        <Projectile
          key={p.id}
          origin={p.origin}
          direction={p.direction}
          speed={SILKEN_DART_SPEED}
          lifetimeSec={SILKEN_DART_LIFETIME}
          color="#d4a24a"
          emissiveColor="#ffd48a"
          targetRef={p.ownerIndex === 0 ? botHandleRef : playerHandleRef}
          onExpire={() => expireProjectile(p.id)}
          onHit={() => hitProjectile(p)}
        />
      ))}
    </>
  );
}
