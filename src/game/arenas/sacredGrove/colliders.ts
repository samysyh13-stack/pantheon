// Sacred Grove layout data (Phase 1 gray-box).
// v1 locked design per /docs/DESIGN_DOCUMENT.md §7 and ADR-0012 (neutral overcast).
// Detailed polish + pickup spawners + breakable integration land in Phase 2 T-104.

export const ARENA_LAYOUT = {
  diameter: 40,
  groundSize: 60, // buffer beyond the playable area to catch stray physics
  daisRadius: 5,
  daisHeight: 0.5,
  innerRingRadius: 10, // shrines at N/E/S/W
  outerRingRadius: 15, // standing stones at 45° offsets
  stormRadius: 20, // visible boundary; beyond = damage + pushback
} as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoxDimensions {
  width: number; // along X
  height: number; // along Y
  depth: number; // along Z
}

export interface ColliderDef {
  position: Vec3; // base (foot) position; visual mesh is raised by height/2
  dimensions: BoxDimensions;
  hp?: number; // if set, the prop is breakable
  name: string;
}

// Four shrines at cardinal compass points, 10 m from center.
// Breakable (300 HP) per /docs/DESIGN_DOCUMENT.md §7.
export const SHRINES: ColliderDef[] = [
  {
    name: 'shrine-north',
    position: { x: 0, y: 0, z: -ARENA_LAYOUT.innerRingRadius },
    dimensions: { width: 1.5, height: 2, depth: 1.5 },
    hp: 300,
  },
  {
    name: 'shrine-east',
    position: { x: ARENA_LAYOUT.innerRingRadius, y: 0, z: 0 },
    dimensions: { width: 1.5, height: 2, depth: 1.5 },
    hp: 300,
  },
  {
    name: 'shrine-south',
    position: { x: 0, y: 0, z: ARENA_LAYOUT.innerRingRadius },
    dimensions: { width: 1.5, height: 2, depth: 1.5 },
    hp: 300,
  },
  {
    name: 'shrine-west',
    position: { x: -ARENA_LAYOUT.innerRingRadius, y: 0, z: 0 },
    dimensions: { width: 1.5, height: 2, depth: 1.5 },
    hp: 300,
  },
];

// Standing stones at 45° offsets, 15 m from center, unbreakable.
const SQRT1_2 = Math.SQRT1_2; // = 1/sqrt(2) ≈ 0.7071
const R = ARENA_LAYOUT.outerRingRadius;

export const STANDING_STONES: ColliderDef[] = [
  {
    name: 'stone-NE',
    position: { x: R * SQRT1_2, y: 0, z: -R * SQRT1_2 },
    dimensions: { width: 1, height: 2.5, depth: 1 },
  },
  {
    name: 'stone-SE',
    position: { x: R * SQRT1_2, y: 0, z: R * SQRT1_2 },
    dimensions: { width: 1, height: 2.5, depth: 1 },
  },
  {
    name: 'stone-SW',
    position: { x: -R * SQRT1_2, y: 0, z: R * SQRT1_2 },
    dimensions: { width: 1, height: 2.5, depth: 1 },
  },
  {
    name: 'stone-NW',
    position: { x: -R * SQRT1_2, y: 0, z: -R * SQRT1_2 },
    dimensions: { width: 1, height: 2.5, depth: 1 },
  },
];

// Pickup spawn positions (activated in Phase 2 T-104).
export const PICKUP_SPAWN_POSITIONS: readonly Vec3[] = [
  { x: 0, y: 0.5, z: -6 }, // inner N
  { x: 0, y: 0.5, z: 6 }, // inner S
  { x: 6, y: 0.5, z: 0 }, // inner E
  { x: -6, y: 0.5, z: 0 }, // inner W
] as const;

export const SPAWN_POINTS: Readonly<Record<'p0' | 'p1', Vec3>> = {
  p0: { x: 0, y: 1, z: -14 },
  p1: { x: 0, y: 1, z: 14 },
};
