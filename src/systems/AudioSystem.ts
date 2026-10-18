/** Original procedural audio. No remote assets and no audio before a user gesture. */
export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private musicTimer = 0;
  private step = 0;
  enabled = true;
  music = true;
  volume = 0.35;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
  }
  private tone(freq: number, duration: number, type: OscillatorType, gain: number, slide = 0) {
    if (!this.enabled || !this.context || !this.master) return;
    const ctx = this.context, t = ctx.currentTime;
    const osc = ctx.createOscillator(), envelope = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(gain * this.volume, t + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(envelope); envelope.connect(this.master);
    osc.start(t); osc.stop(t + duration + 0.02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  play(sound: 'step' | 'sword' | 'hit' | 'wood' | 'stone' | 'pickup' | 'build' | 'hurt' | 'death' | 'level' | 'bow' | 'magic' | 'ui' | 'fish') {
    switch (sound) {
      case 'step': this.tone(95 + Math.random() * 25, 0.045, 'triangle', 0.08, -45); break;
      case 'sword': this.tone(280, 0.13, 'sawtooth', 0.05, -220); break;
      case 'hit': this.tone(105, 0.11, 'square', 0.08, -60); break;
      case 'wood': this.tone(170, 0.1, 'triangle', 0.15, -115); break;
      case 'stone': this.tone(930, 0.07, 'square', 0.04, -480); this.tone(1420, 0.09, 'sine', 0.1); break;
      case 'pickup': this.tone(660, 0.15, 'sine', 0.12, 220); break;
      case 'build': this.tone(160, 0.16, 'triangle', 0.2); this.tone(330, 0.22, 'sine', 0.08); break;
      case 'hurt': this.tone(190, 0.22, 'sawtooth', 0.09, -140); break;
      case 'death': this.tone(180, 0.9, 'triangle', 0.2, -145); break;
      case 'level': [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.45, 'sine', 0.14), i * 90)); break;
      case 'bow': this.tone(380, 0.15, 'triangle', 0.15, -300); break;
      case 'magic': this.tone(350, 0.3, 'sine', 0.12, 650); break;
      case 'fish': this.tone(700, 0.15, 'sine', 0.12, -500); break;
      case 'ui': this.tone(540, 0.055, 'sine', 0.06); break;
    }
  }
  update(dt: number, combat: boolean) {
    this.musicTimer -= dt;
    if (!this.music || this.musicTimer > 0) return;
    this.musicTimer = combat ? 0.48 : 1.65;
    const notes = combat ? [146.83, 146.83, 174.61, 130.81, 146.83, 196, 174.61, 130.81] : [220, 329.63, 293.66, 261.63, 196, 293.66, 261.63, 329.63];
    this.tone(notes[this.step++ % notes.length], combat ? 0.32 : 1.5, 'sine', combat ? 0.045 : 0.035);
    if (!combat) this.tone(notes[(this.step + 3) % notes.length] / 2, 1.6, 'triangle', 0.018);
  }
}
