import { useEffect, useRef, useState } from "react";
import { MetronomeEngine, DEFAULT_SETTINGS } from "./audio/MetronomeEngine.js";

const SUBDIVISIONS = [
  { value: 1, label: "Negras" },
  { value: 2, label: "Corcheas" },
  { value: 3, label: "Tresillos" },
  { value: 4, label: "Semicorcheas" },
  { value: 5, label: "Cinquillos" },
];

//Componente App
export default function App() {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new MetronomeEngine();
  const engine = engineRef.current;

  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(DEFAULT_SETTINGS.bpm);
  const [beatsPerBar, setBeatsPerBar] = useState(DEFAULT_SETTINGS.beatsPerBar);
  const [subdivision, setSubdivision] = useState(DEFAULT_SETTINGS.subdivision);
  const [sound, setSound] = useState(DEFAULT_SETTINGS.sound);
  const [ramp, setRamp] = useState(DEFAULT_SETTINGS.ramp);
  const [gap, setGap] = useState(DEFAULT_SETTINGS.gap);
  const [tick, setTick] = useState({ beat: -1, sub: 0, muted: false });
  const wakeLock = useRef(null);

  // Sincroniza los ajustes de la interfaz con el motor.
  useEffect(() => {
    engine.update({ bpm, beatsPerBar, subdivision, sound, ramp, gap });
  }, [engine, bpm, beatsPerBar, subdivision, sound, ramp, gap]);

  useEffect(() => {
    engine.onTick = setTick;
    engine.onBpmChange = setBpm;
    return () => engine.stop();
  }, [engine]);

  async function toggle() {
    if (playing) {
      engine.stop();
      setPlaying(false);
      setTick({ beat: -1, sub: 0, muted: false });
      wakeLock.current?.release?.();
    } else {
      engine.start();
      setPlaying(true);
      try {
        wakeLock.current = await navigator.wakeLock?.request("screen");
      } catch {
        /* opcional */
      }
    }
  }

  //Renderizado
  return (
    <main className="app">
      <h1>Metrónomo</h1>

      <section className="display" aria-live="polite">
        <output className="bpm">{bpm}</output>
        <span className="unit">BPM</span>
      </section>

      <div className="beats" aria-hidden="true">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={`beat ${i === 0 ? "first" : ""} ${tick.beat === i ? "on" : ""} ${tick.muted ? "muted" : ""}`}
          />
        ))}
      </div>

      <input
        type="range"
        min="30"
        max="260"
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        aria-label="Tempo en BPM"
      />

      <button className="play" onClick={toggle}>
        {playing ? "Parar" : "Empezar"}
      </button>

      <section className="grid">
        <label>
          Pulsos por compás
          <select
            value={beatsPerBar}
            onChange={(e) => setBeatsPerBar(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subdivisión
          <select
            value={subdivision}
            onChange={(e) => setSubdivision(Number(e.target.value))}
          >
            {SUBDIVISIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sonido
          <select value={sound} onChange={(e) => setSound(e.target.value)}>
            <option value="wood">Madera</option>
            <option value="click">Clic agudo</option>
            <option value="beep">Pitido</option>
          </select>
        </label>
      </section>

      <fieldset>
        <legend>Subir tempo automáticamente</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={ramp.enabled}
            onChange={(e) => setRamp({ ...ramp, enabled: e.target.checked })}
          />
          Activar
        </label>
        <div className="grid">
          <label>
            Subir (BPM)
            <input
              type="number"
              min="1"
              max="20"
              value={ramp.increment}
              onChange={(e) =>
                setRamp({ ...ramp, increment: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Cada (compases)
            <input
              type="number"
              min="1"
              max="32"
              value={ramp.everyBars}
              onChange={(e) =>
                setRamp({ ...ramp, everyBars: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Hasta (BPM)
            <input
              type="number"
              min="40"
              max="300"
              value={ramp.maxBpm}
              onChange={(e) =>
                setRamp({ ...ramp, maxBpm: Number(e.target.value) })
              }
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Gap click: compases en silencio</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={gap.enabled}
            onChange={(e) => setGap({ ...gap, enabled: e.target.checked })}
          />
          Activar
        </label>
        <label>
          Probabilidad de silencio: {Math.round(gap.probability * 100)} %
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.05"
            value={gap.probability}
            onChange={(e) =>
              setGap({ ...gap, probability: Number(e.target.value) })
            }
          />
        </label>
      </fieldset>
    </main>
  );
}
