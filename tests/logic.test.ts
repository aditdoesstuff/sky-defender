import { describe, expect, it } from 'vitest';
import { bearingOf, hitTest, spawnPosition, streakMultiplier, waveConfig } from '../src/logic';

describe('spawnPosition', () => {
  it('lands on the requested radius', () => {
    for (const [az, el] of [
      [0, 0],
      [1.2, 0.4],
      [4, -0.7],
    ] as const) {
      const p = spawnPosition(az, el, 28);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(28, 6);
    }
  });
  it('puts azimuth 0 north and 90 degrees east', () => {
    expect(bearingOf(spawnPosition(0, 0, 10))).toBeCloseTo(0, 5);
    expect(bearingOf(spawnPosition(Math.PI / 2, 0, 10))).toBeCloseTo(90, 5);
    expect(bearingOf(spawnPosition(Math.PI * 1.5, 0, 10))).toBeCloseTo(270, 5);
  });
});

describe('hitTest', () => {
  const north = { x: 0, y: 0, z: -1 };
  it('hits a drone dead ahead', () => {
    expect(hitTest(north, { x: 0, y: 0, z: -20 }, 0.7)).toBeCloseTo(20);
  });
  it('allows small tolerance and rejects wide misses', () => {
    expect(hitTest(north, { x: 1.0, y: 0, z: -20 }, 0.7, 0.5)).not.toBeNull();
    expect(hitTest(north, { x: 3, y: 0, z: -20 }, 0.7, 0.5)).toBeNull();
  });
  it('ignores drones behind the player', () => {
    expect(hitTest(north, { x: 0, y: 0, z: 20 }, 0.7)).toBeNull();
  });
});

describe('waveConfig', () => {
  it('scales count and speed and shortens spawn interval', () => {
    const a = waveConfig(1);
    const b = waveConfig(6);
    expect(b.count).toBeGreaterThan(a.count);
    expect(b.speedMul).toBeGreaterThan(a.speedMul);
    expect(b.interval).toBeLessThan(a.interval);
  });
  it('introduces heavies only from sector 3', () => {
    expect(waveConfig(2).weights.heavy).toBe(0);
    expect(waveConfig(4).weights.heavy).toBeGreaterThan(0);
  });
  it('caps the streak multiplier', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(6)).toBe(3);
    expect(streakMultiplier(999)).toBe(5);
  });
});
