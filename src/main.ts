import './style.css';
import { Sound } from './audio';
import { Game } from './game';
import { Hud } from './hud';
import { World } from './scene';
import { Look, startCamera } from './sensors';
import * as THREE from 'three';

const el = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} missing`);
  return e as T;
};

const world = new World(el<HTMLCanvasElement>('gl'));
const hud = new Hud(el('hud'), el('menu'));
const sound = new Sound();
const look = new Look();
const game = new Game(world, hud, sound);
const video = el<HTMLVideoElement>('cam');
const aim = new THREE.Vector3();

function showStart(note = ''): void {
  const best = game.best ? `High score: ${game.best.toLocaleString()}` : 'No record yet.';
  hud.card(
    'Sky Defender',
    [
      'Hostile drones are closing in from every direction.',
      'Turn your phone to aim. Tap to fire.',
      best,
    ],
    'Tap to deploy',
    () => void deploy(),
    note,
  );
}

async function deploy(): Promise<void> {
  sound.unlock();
  // Permission must be requested first, straight from the tap.
  const perm = await look.requestPermission();
  look.start();
  const cam = await startCamera(video);
  hud.show(true);
  game.begin();
  const notes: string[] = [];
  if (perm === 'denied') notes.push('Motion access denied. Drag the screen to look around.');
  if (!cam) notes.push('No camera. Using a dark backdrop.');
  if (notes.length) hud.chatter(notes.join(' '));
}

// Input: tap to fire on sensor devices, drag to look (click to fire) otherwise.
let down: { x: number; y: number; moved: number } | null = null;
document.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  down = { x: e.clientX, y: e.clientY, moved: 0 };
  if (look.hasSensor) game.fire(look.forward(aim));
});
document.addEventListener('pointermove', (e) => {
  if (!down) return;
  look.drag(e.clientX - down.x, e.clientY - down.y);
  down.moved += Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
  down.x = e.clientX;
  down.y = e.clientY;
});
document.addEventListener('pointerup', () => {
  if (down && !look.hasSensor && down.moved < 8) game.fire(look.forward(aim));
  down = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.camera.quaternion.copy(look.quaternion);
  game.update(dt);
  world.update(dt, now / 1000);
  world.render();
  hud.frame(dt, look.heading(), game.blips());
  hud.setLocked(game.state === 'playing' && game.isLocked(look.forward(aim)));
  requestAnimationFrame(loop);
}

showStart();
requestAnimationFrame(loop);
