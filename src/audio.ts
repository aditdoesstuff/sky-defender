/** All sound is synthesised with Web Audio. No asset files. */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Must be called from a user gesture (required by iOS). */
  unlock(): void {
    if (!this.ctx) {
      const C =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, to = 0, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to > 0) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  ping(): void {
    this.tone(1320, 0.9, 'sine', 0.06, 1100);
  }
  shot(): void {
    this.tone(880, 0.12, 'square', 0.04, 180);
  }
  hit(): void {
    this.tone(240, 0.14, 'triangle', 0.07, 170);
  }
  kill(): void {
    this.tone(320, 0.2, 'triangle', 0.08, 100);
    this.tone(640, 0.1, 'sine', 0.03, 0, 0.03);
  }
  damage(): void {
    this.tone(100, 0.4, 'sawtooth', 0.08, 50);
    this.buzz([120]);
  }
  alarm(): void {
    this.tone(170, 0.4, 'sawtooth', 0.05, 120);
  }
  buzz(pattern: number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* haptics unsupported */
    }
  }
}
