import * as Phaser from "phaser";
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
  "bowl-clang": [880, 660],
  "stray-dog-rush": [220, 330, 440],
  coin: [784, 988],
  checkpoint: [523, 659],
  "death-cartoon": [220, 147],
  "stage-clear": [523, 659, 784],
};

const CUTSCENE_MUSIC: Readonly<Partial<Record<MusicKey, readonly number[]>>> = {
  "birthday-warm": [523, 659, 784, 659, 587, 698, 880, 784],
  "world-01-alley": [392, 440, 392, 330, 294, 330, 392, 247],
};

export class AudioManager {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribers: Array<() => void> = [];
  private readonly activeSources = new Set<AudioScheduledSourceNode>();
  private readonly musicSources = new Set<AudioScheduledSourceNode>();
  private audioContext?: AudioContext;
  private musicKey: string | null = null;
  private musicTimer: ReturnType<typeof setInterval> | undefined;
  private musicStep = 0;

  public constructor(scene: Phaser.Scene, gameplayBus?: GameplayEventBus, gameBus?: GameEventBus) {
    this.scene = scene;
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
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!this.audioContext && Context) this.audioContext = new Context();
    void this.audioContext?.resume();
  }

  public playSfx(key: string): void {
    if (!SOUND_KEYS.includes(key as SoundKey) || this.scene.sound.locked) return;
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key);
      return;
    }
    if (!this.isAudioReady()) return;
    if (key === "bag-rustle") {
      this.playRustle();
      return;
    }
    const pattern = SOUND_PATTERNS[key as SoundKey] ?? [420];
    pattern.forEach((frequency, index) => {
      this.playTone(frequency, 0.085, 0.032, "square", false, index * 0.105);
    });
  }

  public playMusic(key: string): void {
    if (!MUSIC_KEYS.includes(key as MusicKey) || this.musicKey === key) return;
    this.stopMusic();
    this.musicKey = key;
    if (this.scene.cache.audio.exists(key)) {
      if (!this.scene.sound.locked) this.scene.sound.play(key, { loop: true, volume: 0.22 });
      return;
    }

    this.musicStep = 0;
    const pattern = CUTSCENE_MUSIC[key as MusicKey];
    if (pattern) {
      this.playMusicStep(pattern);
      this.musicTimer = setInterval(() => this.playMusicStep(pattern), 210);
      return;
    }

    // Preserve the existing ambient drone for the other worlds.
    this.musicTimer = setInterval(
      () => this.playTone(180, 0.28, 0.018, "triangle", true),
      2200,
    );
  }

  public stopMusic(): void {
    if (this.musicKey && this.scene.cache.audio.exists(this.musicKey)) {
      this.scene.sound.stopByKey(this.musicKey);
    }
    if (this.musicTimer !== undefined) clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.stopSources(this.musicSources);
    this.musicKey = null;
    this.musicStep = 0;
  }

  public stopAllSounds(): void {
    this.scene.sound.stopAll();
    this.stopSources(this.activeSources);
    this.musicSources.clear();
  }

  public destroy(): void {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.stopMusic();
    this.stopAllSounds();
    if (this.audioContext && this.audioContext.state !== "closed") {
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

  private playMusicStep(pattern: readonly number[]): void {
    if (!this.isAudioReady()) return;
    const frequency = pattern[this.musicStep % pattern.length];
    this.musicStep += 1;
    this.playTone(frequency, 0.17, 0.022, "square", true);
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    volume: number,
    waveform: OscillatorType,
    music: boolean,
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
    this.trackSource(oscillator, music);
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
    this.trackSource(source, false);
    source.start();
    source.stop(context.currentTime + 0.16);
  }

  private trackSource(source: AudioScheduledSourceNode, music: boolean): void {
    this.activeSources.add(source);
    if (music) this.musicSources.add(source);
    source.addEventListener("ended", () => {
      this.activeSources.delete(source);
      this.musicSources.delete(source);
    }, { once: true });
  }

  private stopSources(sources: Set<AudioScheduledSourceNode>): void {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // A source that already ended cannot be stopped again.
      }
      this.activeSources.delete(source);
    }
    sources.clear();
  }

  private isAudioReady(): boolean {
    return Boolean(this.audioContext && this.audioContext.state === "running");
  }

  private musicForStage(stageId: string): MusicKey {
    if (stageId.startsWith("world-01")) return "world-01-alley";
    if (stageId.startsWith("world-02")) return "world-02-amusement";
    if (stageId.startsWith("world-03")) return "world-03-factory";
    if (stageId.startsWith("world-04")) return "world-04-rooftop";
    return stageId.startsWith("world-05") ? "world-05-kingdom" : "boss";
  }
}
