import * as THREE from 'three';
import { KINDS, type DroneKind, type Vec3 } from './logic';

export interface Drone {
  kind: DroneKind;
  hp: number;
  active: boolean;
  pulse: number;
  obj: THREE.Group;
}

const POOL_CAP = 24;
const FX_COUNT = 14;

const GEO: Record<DroneKind, THREE.BufferGeometry> = {
  scout: new THREE.ConeGeometry(0.4, 1.3, 4).rotateX(Math.PI / 2),
  standard: new THREE.OctahedronGeometry(0.7, 0).scale(1.5, 0.5, 1),
  heavy: new THREE.IcosahedronGeometry(0.95, 0).scale(1.3, 0.6, 1.1),
};
const BODY: Record<DroneKind, THREE.Material> = {
  scout: new THREE.MeshLambertMaterial({ color: 0xc9b98a, emissive: 0x2a2616 }),
  standard: new THREE.MeshLambertMaterial({ color: 0x8a9a5b, emissive: 0x1c2210 }),
  heavy: new THREE.MeshLambertMaterial({ color: 0x5f6b45, emissive: 0x12160a }),
};
const GLOW = new THREE.MeshBasicMaterial({
  color: 0xc9b98a,
  transparent: true,
  opacity: 0.22,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const RING_GEO = new THREE.RingGeometry(0.85, 1, 24);
const FLASH_GEO = new THREE.SphereGeometry(1, 8, 6);

interface Fx {
  group: THREE.Group;
  ring: THREE.MeshBasicMaterial;
  flash: THREE.MeshBasicMaterial;
  t: number;
  life: number;
  size: number;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 80);
  private pools: Record<DroneKind, Drone[]> = { scout: [], standard: [], heavy: [] };
  private fx: Fx[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 5, 3);
    this.scene.add(sun);
    for (let i = 0; i < FX_COUNT; i++) this.fx.push(this.makeFx());
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private makeFx(): Fx {
    const ring = new THREE.MeshBasicMaterial({
      color: 0xc9b98a,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const flash = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(RING_GEO, ring), new THREE.Mesh(FLASH_GEO, flash));
    group.visible = false;
    this.scene.add(group);
    return { group, ring, flash, t: 0, life: 0.45, size: 1 };
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Take a drone from the pool. Returns null if the pool for that kind is exhausted. */
  spawn(kind: DroneKind, pos: Vec3): Drone | null {
    const pool = this.pools[kind];
    let d = pool.find((x) => !x.active);
    if (!d) {
      if (pool.length >= POOL_CAP) return null;
      const obj = new THREE.Group();
      obj.add(new THREE.Mesh(GEO[kind], BODY[kind]));
      const glow = new THREE.Mesh(GEO[kind], GLOW);
      glow.scale.setScalar(1.3);
      obj.add(glow);
      this.scene.add(obj);
      d = { kind, hp: 0, active: false, pulse: 0, obj };
      pool.push(d);
    }
    d.active = true;
    d.hp = KINDS[kind].hp;
    d.pulse = 0;
    d.obj.visible = true;
    d.obj.position.set(pos.x, pos.y, pos.z);
    d.obj.scale.setScalar(1);
    d.obj.lookAt(0, 0, 0);
    return d;
  }

  release(d: Drone): void {
    d.active = false;
    d.obj.visible = false;
  }

  /** Clean flash plus expanding ring. */
  burst(pos: Vec3, size: number): void {
    const fx = this.fx.find((f) => !f.group.visible) ?? this.fx[0];
    if (!fx) return;
    fx.t = 0;
    fx.size = size;
    fx.group.visible = true;
    fx.group.position.set(pos.x, pos.y, pos.z);
    fx.group.lookAt(0, 0, 0);
  }

  update(dt: number, time: number): void {
    for (const kind of ['scout', 'standard', 'heavy'] as const) {
      for (const d of this.pools[kind]) {
        if (!d.active) continue;
        d.obj.rotateZ(dt * 0.6);
        d.pulse = Math.max(0, d.pulse - dt * 4);
        d.obj.scale.setScalar(1 + d.pulse * 0.3 + Math.sin(time * 4 + d.obj.id) * 0.03);
      }
    }
    for (const f of this.fx) {
      if (!f.group.visible) continue;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) {
        f.group.visible = false;
        continue;
      }
      const flashScale = f.size * (0.3 + k * 0.5);
      const ringScale = f.size * (0.6 + k * 2);
      const [ring, flash] = f.group.children;
      ring?.scale.setScalar(ringScale);
      flash?.scale.setScalar(flashScale);
      f.ring.opacity = 1 - k;
      f.flash.opacity = (1 - k) * 0.8;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
