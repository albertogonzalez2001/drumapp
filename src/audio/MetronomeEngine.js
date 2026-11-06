// Motor del metrónomo: JavaScript puro, sin React.
// Usa el reloj de Web Audio (ctx.currentTime), que es mucho más preciso que setTimeout.
// Patrón: un temporizador corto revisa qué sonidos caen en los próximos ~100 ms
// y los programa con antelación exacta.

const LOOKAHEAD_MS = 25; // cada cuánto revisa el scheduler
const SCHEDULE_AHEAD_S = 0.1; // cuánto futuro programa

// Sonidos sintetizados (no hacen falta archivos). Frecuencias altas para oírse sobre una batería.
const SOUNDS = {
  click: { type: "square", accent: 2400, beat: 1800, sub: 1300, length: 0.03 },
  wood: { type: "triangle", accent: 1500, beat: 1100, sub: 800, length: 0.06 },
  beep: { type: "sine", accent: 1760, beat: 1320, sub: 990, length: 0.08 },
};

export const DEFAULT_SETTINGS = {
  bpm: 100,
  beatsPerBar: 4,
  subdivision: 1, // 1 negra, 2 corcheas, 3 tresillo, 4 semicorcheas, 5 cinquillo
  sound: "wood",
  volume: 0.9,
  ramp: { enabled: false, increment: 2, everyBars: 4, maxBpm: 160 },
  gap: { enabled: false, probability: 0.3 }, // probabilidad de silenciar cada compás
};

export class MetronomeEngine {
  constructor(settings = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.ctx = null;
    this.timer = null;
    this.isPlaying = false;
    this.nextTime = 0;
    this.step = 0; // paso global dentro del compás
    this.barCount = 0;
    this.barMuted = false;
    this.onTick = null; // ({ beat, sub, bar, muted }) => void  (para la interfaz)
    this.onBpmChange = null; // (bpm) => void
  }

  update(partial) {
    this.settings = { ...this.settings, ...partial };
  }

  start() {
    //Solción de audio para dispositivos de Apple, tratarlo como reproduccion de medios
    if ("audioSession" in navigator) {
      navigator.audioSession.type = "playback";
    }
    // Debe llamarse desde un gesto del usuario (clic/tap): lo exige iOS y Chrome.
    if (!this.ctx)
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.isPlaying = true;
    this.step = 0;
    this.barCount = 0;
    this.barMuted = false;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.#scheduler(), LOOKAHEAD_MS);
  }

  stop() {
    this.isPlaying = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  //Funciones privadas
  #scheduler() {
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.#scheduleStep(this.nextTime);
      this.nextTime += this.#stepDuration();
    }
  }

  #stepDuration() {
    return 60 / this.settings.bpm / this.settings.subdivision;
  }

  #scheduleStep(time) {
    const { subdivision, beatsPerBar, ramp, gap } = this.settings;
    const stepsPerBar = subdivision * beatsPerBar;
    const posInBar = this.step % stepsPerBar;
    const beat = Math.floor(posInBar / subdivision);
    const sub = posInBar % subdivision;

    // Inicio de compás: aquí se decide la rampa de tempo y el gap click.
    if (posInBar === 0) {
      if (this.step > 0) this.barCount++;
      if (
        ramp.enabled &&
        this.barCount > 0 &&
        this.barCount % ramp.everyBars === 0
      ) {
        const next = Math.min(this.settings.bpm + ramp.increment, ramp.maxBpm);
        if (next !== this.settings.bpm) {
          this.settings.bpm = next;
          this.onBpmChange?.(next);
        }
      }
      // El primer compás siempre suena, para fijar el pulso.
      this.barMuted =
        gap.enabled && this.barCount > 0 && Math.random() < gap.probability;
    }

    if (!this.barMuted)
      this.#playClick(
        time,
        beat === 0 && sub === 0 ? "accent" : sub === 0 ? "beat" : "sub",
      );

    // Avisa a la interfaz en el momento exacto en que suena el paso.
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    const info = { beat, sub, bar: this.barCount, muted: this.barMuted };
    setTimeout(() => this.isPlaying && this.onTick?.(info), delayMs);

    this.step++;
  }

  #playClick(time, kind) {
    const s = SOUNDS[this.settings.sound] ?? SOUNDS.wood;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = s.type;
    osc.frequency.value = s[kind];
    const peak = (kind === "sub" ? 0.5 : 1) * this.settings.volume;
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + s.length);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + s.length + 0.01);
  }
}
