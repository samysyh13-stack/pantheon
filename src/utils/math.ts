export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const vec2Length = (x: number, y: number): number => Math.hypot(x, y);

export const normalize2 = (x: number, y: number): [number, number] => {
  const m = Math.hypot(x, y);
  return m > 1e-6 ? [x / m, y / m] : [0, 0];
};

export const deadzone = (v: number, dz: number): number => {
  const abs = Math.abs(v);
  if (abs < dz) return 0;
  const sign = Math.sign(v);
  return sign * ((abs - dz) / (1 - dz));
};
