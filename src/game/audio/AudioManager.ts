import * as Phaser from "phaser";
import * as Tone from "tone";
import type { GameEventBus } from "../bridge/GameEventBus";
import type { GameplayEventBus } from "../core/events";
import { MUSIC_KEYS, SOUND_KEYS, type MusicKey, type SoundKey } from "./audioManifest";

const SOUND_PATTERNS: Readonly<Partial<Record<SoundKey, readonly number[]>>> = {
  "rib-reveal": [523, 659, 784],
  bark: [262, 196],
  whine: [494, 440, 370],
  "cat-land": [196],
  "cat-taunt": [587, 494, 392],
  "slipper-scrape": [330, 247],
  "escape-door": [392, 523, 659],
  "slipper-hit": [392, 262],
  sneeze: [494, 622, 330],
  coin: [784, 988],
  checkpoint: [523, 659],
  "death-cartoon": [220, 147],
  "stage-clear": [523, 659, 784],
};

interface MusicArrangement {
  readonly bpm: number;
  readonly melody: readonly (string | null)[];
  readonly chords: readonly string[];
  readonly bass: readonly string[];
}

const CHORD_VOICINGS: Readonly<Record<string, readonly string[]>> = {
  C: ["C4", "E4", "G4"], G: ["G3", "B3", "D4"], Am: ["A3", "C4", "E4"], F: ["F3", "A3", "C4"],
  D: ["D4", "F#4", "A4"], Em: ["E3", "G3", "B3"], Bm: ["B3", "D4", "F#4"], A: ["A3", "C#4", "E4"],
  Fsm: ["F#3", "A3", "C#4"], E: ["E3", "G#3", "B3"], B: ["B3", "D#4", "F#4"], Csm: ["C#4", "E4", "G#4"],
  Dm: ["D4", "F4", "A4"], Bb: ["Bb3", "D4", "F4"],
};

const MUSIC_ARRANGEMENTS: Readonly<Record<MusicKey, MusicArrangement>> = {
  "birthday-warm": {
    bpm: 108,
    melody: ["E5", "G5", "C6", "G5", "E5", "D5", "C5", null, "E5", "G5", "A5", "G5", "F5", "E5", "D5", "C5"],
    chords: ["C", "G", "Am", "F"],
    bass: ["C2", "G2", "A2", "E2", "F2", "C2", "G2", "G2"],
  },
  "world-01-alley": {
    bpm: 116,
    melody: ["D5", "G5", "B5", "A5", "G5", "D5", "E5", null, "D5", "B4", "A4", "B4", "D5", "E5", "D5", "G4"],
    chords: ["G", "D", "Em", "C"],
    bass: ["G2", "D3", "E2", "B2", "C3", "G2", "D3", "D3"],
  },
  "world-02-amusement": {
    bpm: 120,
    melody: ["A5", "C6", "A5", "G5", "F5", "G5", "A5", null, "C6", "A5", "G5", "F5", "A5", "C6", "D6", "C6"],
    chords: ["F", "C", "Dm", "Bb"],
    bass: ["F2", "C3", "D2", "A2", "Bb2", "F2", "C3", "C3"],
  },
  "world-03-factory": {
    bpm: 112,
    melody: ["F#5", "A5", "D6", "A5", "F#5", "E5", "D5", null, "A4", "D5", "F#5", "A5", "B5", "A5", "F#5", "E5"],
    chords: ["D", "A", "Bm", "G"],
    bass: ["D2", "A2", "B2", "F#2", "G2", "D2", "A2", "A2"],
  },
  "world-04-rooftop": {
    bpm: 118,
    melody: ["C#5", "E5", "A5", "E5", "C#5", "B4", "A4", null, "E5", "A5", "B5", "C#6", "B5", "A5", "E5", "D5"],
    chords: ["A", "E", "Fsm", "D"],
    bass: ["A2", "E2", "F#2", "C#3", "D2", "A2", "E2", "E2"],
  },
  "world-05-kingdom": {
    bpm: 124,
    melody: ["G#5", "B5", "E6", "B5", "G#5", "F#5", "E5", null, "B4", "E5", "G#5", "B5", "C#6", "B5", "G#5", "F#5"],
    chords: ["E", "B", "Csm", "A"],
    bass: ["E2", "B2", "C#3", "G#2", "A2", "E2", "B2", "B2"],
  },
  boss: {
    bpm: 132,
    melody: ["G5", "B5", "D6", "B5", "A5", "G5", "D5", null, "B5", "D6", "G6", "D6", "C6", "B5", "A5", "G5"],
    chords: ["G", "D", "C", "D"],
    bass: ["G2", "D2", "G3", "D2", "C3", "G2", "D3", "D3"],
  },
  "ending-credits": {
    bpm: 96,
    melody: ["A5", "C6", "F6", "C6", "A5", "G5", "F5", null, "G5", "A5", "C6", "A5", "F5", "E5", "F5", "C5"],
    chords: ["F", "C", "Dm", "Bb"],
    bass: ["F2", "C3", "D2", "A2", "Bb2", "F2", "C3", "F2"],
  },
};

interface DisposableToneNode {
  dispose(): unknown;
}

let activeToneMusicOwner: symbol | null = null;
let activeToneMusicNodes: DisposableToneNode[] = [];

function stopToneMusic(owner?: symbol): void {
  if (activeToneMusicOwner === null || (owner && owner !== activeToneMusicOwner)) return;
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  transport.position = 0;
  activeToneMusicNodes.forEach((node) => node.dispose());
  activeToneMusicNodes = [];
  activeToneMusicOwner = null;
}

export class AudioManager {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribers: Array<() => void> = [];
  private readonly activeSources = new Set<AudioScheduledSourceNode>();
  private readonly sourceCleanups = new Map<AudioScheduledSourceNode, () => void>();
  private readonly toneMusicOwner = Symbol("audio-manager");
  private audioContext?: AudioContext;
  private ownsAudioContext = false;
  private destroyed = false;
  private musicKey: string | null = null;

  public constructor(scene: Phaser.Scene, gameplayBus?: GameplayEventBus, gameBus?: GameEventBus) {
    this.scene = scene;
    if (scene.sound instanceof Phaser.Sound.WebAudioSoundManager) {
      this.audioContext = scene.sound.context as AudioContext;
    }
    this.bindUnlockGesture();
    if (gameplayBus) {
      this.unsubscribers.push(gameplayBus.on("slipper-hit", () => this.playSfx("slipper-hit")));
      this.unsubscribers.push(gameplayBus.on("slipper-sneeze", () => this.playSfx("sneeze")));
      this.unsubscribers.push(gameplayBus.on("bite-hit", () => this.playSfx("bark")));
      this.unsubscribers.push(gameplayBus.on("clang", () => this.playSfx("bowl-clang")));
      this.unsubscribers.push(gameplayBus.on("stray-dog-surge", () => this.playSfx("stray-dog-rush")));
      this.unsubscribers.push(gameplayBus.on("death", () => this.playSfx("death-cartoon")));
      this.unsubscribers.push(gameplayBus.on("checkpoint-reached", () => this.playSfx("checkpoint")));
    }
    if (gameBus) {
      this.unsubscribers.push(gameBus.on("stage-started", (payload) => this.playMusic(this.musicForStage(payload.stageId))));
      this.unsubscribers.push(gameBus.on("stage-completed", () => this.playSfx("stage-clear")));
      this.unsubscribers.push(gameBus.on("cutscene-beat", (payload) => {
        if (payload.beat.soundCue) this.playSfx(payload.beat.soundCue);
        if (payload.beat.musicKey) this.playMusic(payload.beat.musicKey);
      }));
    }
  }

  public unlock(): void {
    if (this.destroyed || typeof window === "undefined" || this.scene.sound instanceof Phaser.Sound.NoAudioSoundManager) return;
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!this.audioContext && Context) {
      this.audioContext = new Context();
      this.ownsAudioContext = true;
    }
    if (this.audioContext?.state !== "closed") void this.audioContext?.resume().catch(() => undefined);
    void Tone.start().then(() => {
      if (this.destroyed) return;
      const key = this.musicKey;
      if (key && !this.scene.cache.audio.exists(key) && activeToneMusicOwner !== this.toneMusicOwner) {
        this.startToneMusic(key as MusicKey);
      }
    }).catch(() => undefined);
  }

  public playSfx(key: string): void {
    if (this.destroyed || !SOUND_KEYS.includes(key as SoundKey)) return;
    if (this.scene.cache.audio.exists(key)) {
      if (!this.scene.sound.locked) this.scene.sound.play(key);
      return;
    }
    if (!this.isAudioReady()) return;
    if (key === "bowl-clang") {
      this.playBowlClang();
      return;
    }
    if (key === "stray-dog-rush") {
      [220, 330, 440].forEach((frequency, index) => {
        this.playTone(frequency, 0.07, 0.009, "sine", 0.12 + index * 0.065);
      });
      return;
    }
    if (key === "bag-rustle") {
      this.playRustle();
      return;
    }
    const pattern = SOUND_PATTERNS[key as SoundKey] ?? [420];
    pattern.forEach((frequency, index) => {
      this.playTone(frequency, 0.085, 0.032, "square", index * 0.105);
    });
  }

  public playMusic(key: string): void {
    if (this.destroyed || !MUSIC_KEYS.includes(key as MusicKey) || this.musicKey === key) return;
    this.stopMusic();
    this.musicKey = key;
    if (this.scene.cache.audio.exists(key)) {
      if (!this.scene.sound.locked) this.scene.sound.play(key, { loop: true, volume: 0.22 });
      return;
    }

    if (Tone.getContext().state === "running") this.startToneMusic(key as MusicKey);
  }

  public stopMusic(): void {
    if (this.musicKey && this.scene.cache.audio.exists(this.musicKey)) {
      this.scene.sound.stopByKey(this.musicKey);
    }
    stopToneMusic(this.toneMusicOwner);
    this.musicKey = null;
  }

  public stopAllSounds(): void {
    this.scene.sound.stopAll();
    this.stopSources(this.activeSources);
    this.stopMusic();
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.stopMusic();
    this.stopAllSounds();
    if (this.ownsAudioContext && this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = undefined;
  }

  private bindUnlockGesture(): void {
    if (typeof window === "undefined") return;

    const unlock = (): void => this.unlock();
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    this.unsubscribers.push(
      () => window.removeEventListener("pointerdown", unlock, true),
      () => window.removeEventListener("keydown", unlock, true),
    );
  }

  private startToneMusic(key: MusicKey): void {
    if (this.destroyed || Tone.getContext().state !== "running") return;
    const arrangement = MUSIC_ARRANGEMENTS[key];
    stopToneMusic();

    const melody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.015, decay: 0.12, sustain: 0.08, release: 0.18 },
      volume: -10,
    }).toDestination();
    const harmony = new Tone.PolySynth({
      maxPolyphony: 4,
      voice: Tone.Synth,
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.04, decay: 0.18, sustain: 0.16, release: 0.28 },
      },
      volume: -17,
    }).toDestination();
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.015, decay: 0.16, sustain: 0.1, release: 0.12 },
      volume: -19,
    }).toDestination();

    const melodySequence = new Tone.Sequence<string | null>(
      (time, note) => {
        if (note) melody.triggerAttackRelease(note, "8n", time, 0.55);
      },
      [...arrangement.melody],
      "8n",
    );
    const chordSequence = new Tone.Sequence<string | null>(
      (time, chord) => {
        const notes = chord ? CHORD_VOICINGS[chord] : undefined;
        if (notes) harmony.triggerAttackRelease([...notes], "2n", time, 0.28);
      },
      [...arrangement.chords],
      "2n",
    );
    const bassSequence = new Tone.Sequence<string>(
      (time, note) => bass.triggerAttackRelease(note, "4n", time, 0.48),
      [...arrangement.bass],
      "4n",
    );
    melodySequence.loop = true;
    chordSequence.loop = true;
    bassSequence.loop = true;

    const transport = Tone.getTransport();
    transport.bpm.value = arrangement.bpm;
    transport.position = 0;
    activeToneMusicOwner = this.toneMusicOwner;
    activeToneMusicNodes = [melody, harmony, bass, melodySequence, chordSequence, bassSequence];
    melodySequence.start(0);
    chordSequence.start(0);
    bassSequence.start(0);
    transport.start("+0.05");
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    volume: number,
    waveform: OscillatorType,
    delaySeconds = 0,
  ): void {
    if (!this.isAudioReady()) return;
    const context = this.audioContext!;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startsAt = context.currentTime + delaySeconds;
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(volume, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + durationSeconds);
    oscillator.connect(gain).connect(context.destination);
    this.trackSource(oscillator, [gain]);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + durationSeconds);
  }

  private playRustle(): void {
    if (!this.isAudioReady()) return;
    const context = this.audioContext!;
    const frameCount = Math.floor(context.sampleRate * 0.16);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, context.currentTime);
    gain.gain.setValueAtTime(0.018, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    source.connect(filter).connect(gain).connect(context.destination);
    this.trackSource(source, [filter, gain]);
    source.start();
    source.stop(context.currentTime + 0.16);
  }

  private playBowlClang(): void {
    if (!this.isAudioReady()) return;
    const context = this.audioContext!;
    const startsAt = context.currentTime;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, startsAt);
    filter.connect(context.destination);
    const partials = [
      { frequency: 720, peak: 0.023, decay: 0.18 },
      { frequency: 1190, peak: 0.009, decay: 0.13 },
      { frequency: 1820, peak: 0.004, decay: 0.07 },
    ];
    let remaining = partials.length;
    for (const { frequency, peak, decay } of partials) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.linearRampToValueAtTime(peak, startsAt + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + decay);
      oscillator.connect(gain).connect(filter);
      this.trackSource(oscillator, [gain], () => {
        remaining -= 1;
        if (remaining === 0) filter.disconnect();
      });
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.22);
    }
  }

  private trackSource(source: AudioScheduledSourceNode, nodes: readonly AudioNode[] = [], afterCleanup?: () => void): void {
    this.activeSources.add(source);
    const cleanup = (): void => {
      if (!this.sourceCleanups.delete(source)) return;
      this.activeSources.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      afterCleanup?.();
    };
    this.sourceCleanups.set(source, cleanup);
    source.addEventListener("ended", cleanup, { once: true });
  }

  private stopSources(sources: Set<AudioScheduledSourceNode>): void {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // A source that already ended cannot be stopped again.
      }
      this.sourceCleanups.get(source)?.();
    }
    sources.clear();
  }

  private isAudioReady(): boolean {
    return !this.destroyed && Boolean(this.audioContext && this.audioContext.state === "running");
  }

  private musicForStage(stageId: string): MusicKey {
    if (stageId.endsWith("-boss")) return "boss";
    if (stageId.startsWith("world-01")) return "world-01-alley";
    if (stageId.startsWith("world-02")) return "world-02-amusement";
    if (stageId.startsWith("world-03")) return "world-03-factory";
    if (stageId.startsWith("world-04")) return "world-04-rooftop";
    return stageId.startsWith("world-05") ? "world-05-kingdom" : "boss";
  }
}
