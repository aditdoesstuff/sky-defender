import { KINDS, SPAWN_RADIUS } from './logic';

export interface HudStats {
  integrity: number;
  score: number;
  streak: number;
  mult: number;
  wave: number;
  best: number;
}

export interface Blip {
  bearing: number;
  dist: number;
}

const SAND = '#c9b98a';
const OLIVE = '#8a9a5b';
const AMBER = '#ffb000';

const $ = <T extends HTMLElement>(root: ParentNode, sel: string): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

export class Hud {
  private root: HTMLElement;
  private menu: HTMLElement;
  private compass: HTMLCanvasElement;
  private radar: HTMLCanvasElement;
  private sweep = 0;
  private chatterTimer = 0;

  constructor(root: HTMLElement, menu: HTMLElement) {
    this.root = root;
    this.menu = menu;
    root.innerHTML = `
      <i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br bb"></i>
      <canvas id="compass"></canvas>
      <div id="reticle"><b></b></div>
      <div id="stats">
        <div class="row"><span>Base Integrity</span><span id="integ">100%</span></div>
        <div id="bar"><div id="fill"></div></div>
        <div class="row big"><span>Neutralised</span><span id="score">0</span></div>
        <div class="row"><span id="sector">Sector 1</span><span id="mult"></span></div>
      </div>
      <canvas id="radar" width="200" height="200"></canvas>
      <div id="chatter"></div>
      <div id="vignette"></div>`;
    this.compass = $(root, '#compass');
    this.radar = $(root, '#radar');
    root.classList.add('hidden');
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  update(s: HudStats): void {
    const pct = Math.max(0, Math.round(s.integrity));
    $(this.root, '#integ').textContent = `${pct}%`;
    const fill = $(this.root, '#fill');
    fill.style.width = `${pct}%`;
    this.root.classList.toggle('low', pct < 30);
    $(this.root, '#score').textContent = s.score.toLocaleString();
    $(this.root, '#sector').textContent = `Sector ${s.wave}`;
    $(this.root, '#mult').textContent = s.mult > 1 ? `x${s.mult} streak ${s.streak}` : '';
  }

  setLocked(on: boolean): void {
    $(this.root, '#reticle').classList.toggle('lock', on);
  }

  flashDamage(): void {
    const v = $(this.root, '#vignette');
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
  }

  chatter(text: string): void {
    const el = $(this.root, '#chatter');
    el.textContent = text;
    el.classList.add('on');
    this.chatterTimer = 3;
  }

  /** Redraw compass strip and radar. Called every frame. */
  frame(dt: number, heading: number, blips: Blip[]): void {
    this.sweep = (this.sweep + dt * 1.6) % (Math.PI * 2);
    if (this.chatterTimer > 0 && (this.chatterTimer -= dt) <= 0) {
      $(this.root, '#chatter').classList.remove('on');
    }
    this.drawCompass(heading);
    this.drawRadar(heading, blips);
  }

  private drawCompass(heading: number): void {
    const c = this.compass;
    const w = (c.width = c.clientWidth || 300);
    const h = (c.height = 34);
    const g = c.getContext('2d');
    if (!g) return;
    const span = 100;
    const px = w / span;
    g.font = '12px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.fillStyle = SAND;
    g.strokeStyle = SAND;
    for (let a = Math.floor((heading - span / 2) / 5) * 5; a <= heading + span / 2; a += 5) {
      const x = w / 2 + (a - heading) * px;
      const d = ((a % 360) + 360) % 360;
      const major = d % 15 === 0;
      g.globalAlpha = major ? 0.9 : 0.4;
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x, h - (major ? 12 : 6));
      g.stroke();
      if (d % 45 === 0) {
        g.globalAlpha = 1;
        g.fillText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][d / 45] ?? '', x, h - 17);
      }
    }
    g.globalAlpha = 1;
    g.fillText(String(Math.round(heading) % 360).padStart(3, '0'), w / 2, 11);
  }

  private drawRadar(heading: number, blips: Blip[]): void {
    const g = this.radar.getContext('2d');
    if (!g) return;
    const s = this.radar.width;
    const r = s / 2 - 4;
    g.clearRect(0, 0, s, s);
    g.fillStyle = 'rgba(27,29,26,0.6)';
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = OLIVE;
    g.lineWidth = 1.5;
    for (const k of [1, 0.66, 0.33]) {
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(s / 2, s / 2, r * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(s / 2, s / 2);
    g.lineTo(s / 2 + Math.cos(this.sweep) * r, s / 2 + Math.sin(this.sweep) * r);
    g.stroke();
    for (const b of blips) {
      const ang = ((b.bearing - heading) * Math.PI) / 180 - Math.PI / 2;
      const d = Math.min(1, b.dist / SPAWN_RADIUS) * r;
      g.fillStyle = b.dist < 10 ? AMBER : SAND;
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(s / 2 + Math.cos(ang) * d, s / 2 + Math.sin(ang) * d, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = OLIVE;
    g.fillRect(s / 2 - 3, s / 2 - 3, 6, 6);
  }

  /** Full-screen card: start, briefing, pause and game over all use this. */
  card(title: string, lines: string[], button: string, onClick: () => void, note = ''): void {
    this.menu.innerHTML = `
      <div class="card">
        <h1>${title}</h1>
        ${lines.map((l) => `<p>${l}</p>`).join('')}
        ${note ? `<p class="warn">${note}</p>` : ''}
        <button type="button">${button}</button>
      </div>`;
    this.menu.classList.add('on');
    $(this.menu, 'button').addEventListener('click', () => {
      this.hideCard();
      onClick();
    });
  }

  hideCard(): void {
    this.menu.classList.remove('on');
    this.menu.innerHTML = '';
  }
}

export const droneName = (k: keyof typeof KINDS): string =>
  k === 'scout' ? 'fast mover' : k === 'heavy' ? 'heavy contact' : 'contact';
