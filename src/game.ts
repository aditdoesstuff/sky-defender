import * as THREE from 'three';
import type { Sound } from './audio';
import { droneName, type Hud } from './hud';
import {
  CLEAN_WAVE_BONUS,
  HIT_RADIUS,
  KINDS,
  SPAWN_RADIUS,
  bearingOf,
  hitTest,
  pickKind,
  spawnPosition,
  streakMultiplier,
  waveConfig,
} from './logic';
import type { Drone, World } from './scene';

export type State = 'menu' | 'briefing' | 'playing' | 'paused' | 'over';

const MAX_ACTIVE = 18;
const SPEED_SCALE = 1.5;
const REACH = 1.6;
const FIRE_COOLDOWN = 0.18;
const KEY = 'sky-defender-best';

const BRIEFINGS = [
  'Radar shows light activity. Stay sharp.',
  'Fast movers inbound. Lead with the reticle.',
  'Heavy airframes confirmed. Expect to stack hits.',
  'Contacts from all quarters. Keep turning.',
  'Dense traffic. Hold the line.',
];

function loadBest(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* storage blocked */
  }
}

export class Game {
  state: State = 'menu';
  best = loadBest();
  private integrity = 100;
  private score = 0;
  private streak = 0;
  private wave = 1;
  private toSpawn = 0;
  private spawnTimer = 0;
  private cooldown = 0;
  private damaged = false;
  private alarmTimer = 0;
  private pingTimer = 0;
  private chatterGap = 0;
  private active: Drone[] = [];

  constructor(
    private world: World,
    private hud: Hud,
    private sound: Sound,
  ) {}

  /** Fresh run, then show the first briefing. */
  begin(): void {
    for (const d of this.active) this.world.release(d);
    this.active = [];
    this.integrity = 100;
    this.score = 0;
    this.streak = 0;
    this.wave = 1;
    this.briefing('Mission start. Defend the base. Tap to fire, turn to aim.');
  }

  private briefing(lead: string): void {
    this.state = 'briefing';
    const cfg = waveConfig(this.wave);
    const flavor = BRIEFINGS[Math.min(this.wave - 1, BRIEFINGS.length - 1)] ?? '';
    this.hud.card(
      `Sector ${this.wave} briefing`,
      [lead, flavor, `Expected contacts: ${cfg.count}`],
      'Engage',
      () => this.startWave(),
    );
    this.refresh();
  }

  private startWave(): void {
    const cfg = waveConfig(this.wave);
    this.state = 'playing';
    this.toSpawn = cfg.count;
    this.spawnTimer = 1;
    this.damaged = false;
    this.sound.ping();
    this.hud.chatter(`Sentry One, Sector ${this.wave} is live`);
    this.refresh();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.card('Paused', ['Standing by.'], 'Resume', () => {
      this.state = 'playing';
    });
  }

  private refresh(): void {
    this.hud.update({
      integrity: this.integrity,
      score: this.score,
      streak: this.streak,
      mult: streakMultiplier(this.streak),
      wave: this.wave,
      best: this.best,
    });
  }

  /** True when the given aim direction is over a drone. Drives the reticle. */
  isLocked(dir: THREE.Vector3): boolean {
    return this.active.some(
      (d) => hitTest(dir, d.obj.position, KINDS[d.kind].radius, HIT_RADIUS * 0.3) !== null,
    );
  }

  blips(): { bearing: number; dist: number }[] {
    return this.active.map((d) => ({
      bearing: bearingOf(d.obj.position),
      dist: d.obj.position.length(),
    }));
  }

  fire(dir: THREE.Vector3): void {
    if (this.state !== 'playing' || this.cooldown > 0) return;
    this.cooldown = FIRE_COOLDOWN;
    this.sound.shot();
    this.sound.buzz([8]);
    let best: Drone | null = null;
    let bestT = Infinity;
    for (const d of this.active) {
      const t = hitTest(dir, d.obj.position, KINDS[d.kind].radius, HIT_RADIUS * 0.3);
      if (t !== null && t < bestT) {
        best = d;
        bestT = t;
      }
    }
    if (!best) return;
    const spec = KINDS[best.kind];
    best.hp -= 1;
    if (best.hp > 0) {
      best.pulse = 1;
      this.world.burst(best.obj.position, spec.radius * 0.8);
      this.sound.hit();
      return;
    }
    this.score += spec.points * streakMultiplier(this.streak);
    this.streak += 1;
    this.world.burst(best.obj.position, spec.radius * 1.6);
    this.world.release(best);
    this.active = this.active.filter((d) => d !== best);
    this.sound.kill();
    this.sound.buzz([20]);
    this.refresh();
  }

  update(dt: number): void {
    this.cooldown -= dt;
    if (this.state !== 'playing') return;
    const cfg = waveConfig(this.wave);

    this.spawnTimer -= dt;
    if (this.toSpawn > 0 && this.spawnTimer <= 0 && this.active.length < MAX_ACTIVE) {
      this.spawnOne(cfg);
      this.spawnTimer = cfg.interval * (0.7 + Math.random() * 0.6);
    }

    for (const d of [...this.active]) {
      const p = d.obj.position;
      const spec = KINDS[d.kind];
      const dist = p.length();
      if (dist <= REACH) {
        this.hitBase(d, spec.damage);
        continue;
      }
      p.multiplyScalar(Math.max(0, dist - spec.speed * SPEED_SCALE * cfg.speedMul * dt) / dist);
    }

    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.sound.ping();
      this.pingTimer = 4;
    }
    this.chatterGap -= dt;
    if (this.integrity < 30) {
      this.alarmTimer -= dt;
      if (this.alarmTimer <= 0) {
        this.sound.alarm();
        this.alarmTimer = 1.1;
      }
    }

    if (this.state === 'playing' && this.toSpawn === 0 && this.active.length === 0)
      this.clearWave();
  }

  private spawnOne(cfg: ReturnType<typeof waveConfig>): void {
    const kind = pickKind(cfg.weights, Math.random());
    const az = Math.random() * Math.PI * 2;
    const el = Math.random() * 1.5 - 0.5;
    const pos = spawnPosition(az, el, SPAWN_RADIUS);
    const d = this.world.spawn(kind, pos);
    this.toSpawn -= 1;
    if (!d) return;
    this.active.push(d);
    if (this.chatterGap <= 0) {
      const b = Math.round(bearingOf(pos) / 5) * 5;
      this.hud.chatter(`Sentry One, ${droneName(kind)} bearing ${b % 360}`);
      this.chatterGap = 2.5;
    }
  }

  private hitBase(d: Drone, damage: number): void {
    this.world.release(d);
    this.active = this.active.filter((x) => x !== d);
    this.integrity = Math.max(0, this.integrity - damage);
    this.streak = 0;
    this.damaged = true;
    this.sound.damage();
    this.hud.flashDamage();
    this.refresh();
    if (this.integrity <= 0) this.gameOver();
  }

  private clearWave(): void {
    let lead = `Sector ${this.wave} clear.`;
    if (!this.damaged) {
      this.score += CLEAN_WAVE_BONUS;
      lead += ` Clean sweep bonus +${CLEAN_WAVE_BONUS}.`;
    }
    this.wave += 1;
    this.briefing(lead);
  }

  private gameOver(): void {
    this.state = 'over';
    for (const d of this.active) this.world.release(d);
    this.active = [];
    const record = this.score > this.best;
    if (record) {
      this.best = this.score;
      saveBest(this.best);
    }
    this.hud.card(
      'Mission ended',
      [
        `Neutralised: ${this.score.toLocaleString()}`,
        `Reached Sector ${this.wave}`,
        record ? 'New high score.' : `Best: ${this.best.toLocaleString()}`,
      ],
      'Redeploy',
      () => this.begin(),
    );
  }
}
