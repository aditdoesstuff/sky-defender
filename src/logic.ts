export type DroneKind = 'scout' | 'standard' | 'heavy';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface KindSpec {
  hp: number;
  speed: number;
  points: number;
  damage: number;
  radius: number;
}

export const KINDS: Record<DroneKind, KindSpec> = {
  scout: { hp: 1, speed: 3.2, points: 100, damage: 6, radius: 0.55 },
  standard: { hp: 2, speed: 2.0, points: 150, damage: 10, radius: 0.7 },
  heavy: { hp: 4, speed: 1.2, points: 300, damage: 18, radius: 0.95 },
};

export const SPAWN_RADIUS = 28;
export const HIT_RADIUS = 2.2;

/** Point on a sphere. Azimuth 0 is north (-z), increasing clockwise. Elevation in radians. */
export function spawnPosition(az: number, el: number, r: number): Vec3 {
  const c = Math.cos(el);
  return { x: r * c * Math.sin(az), y: r * Math.sin(el), z: -r * c * Math.cos(az) };
}

/** Compass bearing in degrees, 0 to 360, for a position relative to the player. */
export function bearingOf(p: Vec3): number {
  const deg = (Math.atan2(p.x, -p.z) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Does a ray from the origin along unit vector `dir` pass within `radius + tolerance`
 * of a drone at `pos`? Returns distance along the ray, or null on miss.
 */
export function hitTest(dir: Vec3, pos: Vec3, radius: number, tolerance = 0.5): number | null {
  const t = dir.x * pos.x + dir.y * pos.y + dir.z * pos.z;
  if (t <= 0) return null;
  const cx = pos.x - dir.x * t;
  const cy = pos.y - dir.y * t;
  const cz = pos.z - dir.z * t;
  const d2 = cx * cx + cy * cy + cz * cz;
  const r = radius + tolerance;
  return d2 <= r * r ? t : null;
}

export interface WaveConfig {
  count: number;
  speedMul: number;
  interval: number;
  weights: Record<DroneKind, number>;
}

export function waveConfig(n: number): WaveConfig {
  const w = Math.max(1, Math.floor(n));
  return {
    count: 4 + Math.floor(w * 2.5),
    speedMul: Math.min(2.2, 1 + (w - 1) * 0.12),
    interval: Math.max(0.55, 2.0 - (w - 1) * 0.14),
    weights: {
      scout: 3 + w * 0.3,
      standard: 4,
      heavy: w < 3 ? 0 : Math.min(4, (w - 2) * 0.6),
    },
  };
}

export function pickKind(weights: Record<DroneKind, number>, roll: number): DroneKind {
  const total = weights.scout + weights.standard + weights.heavy;
  let x = roll * total;
  for (const k of ['scout', 'standard', 'heavy'] as const) {
    x -= weights[k];
    if (x < 0) return k;
  }
  return 'standard';
}

export function streakMultiplier(streak: number): number {
  return Math.min(5, 1 + Math.floor(streak / 3));
}

export const CLEAN_WAVE_BONUS = 500;

export function bearingLabel(deg: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8] ?? 'N';
}
