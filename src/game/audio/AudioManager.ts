import * as Phaser from "phaser";
import * as Tone from "tone";
import type { GameEventBus } from "../bridge/GameEventBus";
import type { GameplayEventBus } from "../core/events";
import { CHORD_VOICINGS, MUSIC_ARRANGEMENTS } from "./musicArrangements";
import { getStageMusicKey } from "./stageMusic";
import { FEEDBACK_AUDIO, MUSIC_KEYS, SOUND_KEYS, type FeedbackSoundKey, type MusicKey, type SoundKey } from "./audioManifest";

const SOUND_PATTERNS: Readonly<Partial<Record<SoundKey, readonly number[]>>> = {
  "rib-reveal": [523, 659, 784],
  whine: [494, 440, 370],
  "cat-land": [196],
  "cat-taunt": [587, 494, 392],
  "slipper-scrape": [330, 247],
  "escape-door": [392, 523, 659],
  "slipper-hit": [392, 262],
  sneeze: [494, 622, 330],
  "death-cartoon": [220, 147],
  "stage-clear": [523, 659, 784],
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
  private readonly cachedEffects = new Set<Phaser.Sound.BaseSound>();
  private readonly toneMusicOwner = Symbol("audio-manager");
  private audioContext?: AudioContext;
  private destroyed = false;
  private musicKey: string | null = null;
  private paused = false;
  private musicGain?: Tone.Gain;
  private musicSound?: Phaser.Sound.BaseSound;
  private musicStartedAt = 0;
  private toneMusicPaused = false;
  private readonly feedbackBuffers = new Map<FeedbackSoundKey, Promise<AudioBuffer | null>>();
  private effectsGeneration = 0;
  private feedbackVoices = 0;

  public constructor(scene: Phaser.Scene, gameplayBus?: GameplayEventBus, gameBus?: GameEventBus) {
    this.scene = scene;
    if (!(scene.sound instanceof Phaser.Sound.NoAudioSoundManager)) {
      // Synthesized effects must share the music context: Phaser can be suspended
      // independently while Tone's background music is still playing.
      this.audioContext = Tone.getContext().rawContext as AudioContext;
      this.prepareFeedbackSound("coin");
      this.prepareFeedbackSound("checkpoint");
      this.prepareFeedbackSound("bark");
      this.prepareFeedbackSound("cat-hiss");
    }
    this.bindUnlockGesture();
    if (gameplayBus) {
      this.unsubscribers.push(gameplayBus.on("skill-used", ({ skillId }) => {
        if (skillId === "bark") this.playSfx("bark");
      }));
      this.unsubscribers.push(gameplayBus.on("slipper-hit", () => this.playSfx("slipper-hit")));
      this.unsubscribers.push(gameplayBus.on("slipper-sneeze", () => this.playSfx("sneeze")));
      this.unsubscribers.push(gameplayBus.on("bite-hit", () => this.playSfx("bark")));
      this.unsubscribers.push(gameplayBus.on("clang", () => this.playSfx("bowl-clang")));
      this.unsubscribers.push(gameplayBus.on("stray-dog-surge", () => this.playSfx("stray-dog-rush")));
      this.unsubscribers.push(gameplayBus.on("death", () => this.playSfx("death-cartoon")));
      this.unsubscribers.push(gameplayBus.on("checkpoint-reached", () => this.playSfx("checkpoint")));
      this.unsubscribers.push(gameplayBus.on("world02-cat-scratch", () => this.playSfx("cat-hiss")));
    }
    if (gameBus) {
      this.unsubscribers.push(gameBus.on("coin-collected", () => this.playSfx("coin")));
      this.unsubscribers.push(gameBus.on("stage-started", (payload) => this.playMusic(getStageMusicKey(payload.stageId))));
      this.unsubscribers.push(gameBus.on("stage-completed", () => this.playSfx("stage-clear")));
      this.unsubscribers.push(gameBus.on("cutscene-beat", (payload) => {
        if (payload.beat.soundCue) this.playSfx(payload.beat.soundCue);
        if (payload.beat.musicKey) this.playMusic(payload.beat.musicKey);
      }));
    }
  }

  public unlock(): void {
    if (this.destroyed || typeof window === "undefined" || this.scene.sound instanceof Phaser.Sound.NoAudioSoundManager) return;
    void Tone.start().then(() => {
      this.resumeMusic();
    }).catch(() => undefined);
  }

  public playSfx(key: string): void {
    if (this.destroyed || this.paused || !SOUND_KEYS.includes(key as SoundKey)) return;
    if (key === "coin" || key === "checkpoint" || key === "bark" || key === "cat-hiss") {
      void this.playFeedbackSound(key);
      return;
    }
    if (this.scene.cache.audio.exists(key)) {
      if (!this.scene.sound.locked) {
        const sound = this.scene.sound.add(key);
        this.cachedEffects.add(sound);
        sound.once(Phaser.Sound.Events.COMPLETE, () => {
          this.cachedEffects.delete(sound);
          sound.destroy();
        });
        sound.play();
      }
      return;
    }
    if (!this.isAudioReady()) return;
    if (key === "bowl-clang") {
      this.playBowlClang();
      return;
    }
    if (key === "boss-whistle") {
      this.playWhistle();
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
    this.resumeMusic();
  }

  public stopMusic(): void {
    this.musicSound?.stop();
    this.musicSound?.destroy();
    this.musicSound = undefined;
    stopToneMusic(this.toneMusicOwner);
    this.musicGain = undefined;
    this.toneMusicPaused = false;
    this.musicKey = null;
  }

  public stopAllSounds(): void {
    this.stopEffects();
    this.stopMusic();
  }

  public setPaused(paused: boolean): void {
    if (this.destroyed || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stopEffects();
      this.musicSound?.pause();
      if (activeToneMusicOwner === this.toneMusicOwner) {
        // A newly scheduled start can still be inside Tone's look-ahead window.
        Tone.getTransport().pause(Math.max(Tone.immediate(), this.musicStartedAt));
        this.toneMusicPaused = true;
        this.setMusicGain(0);
      }
    } else {
      this.resumeMusic();
      if (!this.isAudioReady()) this.unlock();
    }
  }

  private stopEffects(): void {
    this.effectsGeneration += 1;
    this.cachedEffects.forEach(sound => {
      sound.stop();
      sound.destroy();
    });
    this.cachedEffects.clear();
    this.stopSources(this.activeSources);
  }

  private setMusicGain(value: number): void {
    if (!this.musicGain || this.musicGain.disposed) return;
    const now = Tone.immediate();
    this.musicGain.gain.cancelAndHoldAtTime(now);
    this.musicGain.gain.linearRampToValueAtTime(value, now + 0.01);
  }

  private resumeMusic(): void {
    if (this.destroyed || this.paused || !this.musicKey || !this.audioContext) return;
    if (this.scene.cache.audio.exists(this.musicKey)) {
      if (this.scene.sound.locked) return;
      if (!this.musicSound) {
        this.musicSound = this.scene.sound.add(this.musicKey, { loop: true, volume: 0.22 });
        this.musicSound.play();
      } else if (this.musicSound.isPaused) {
        this.musicSound.resume();
      }
      return;
    }
    if (Tone.getContext().state !== "running") return;
    // A newer scene may already have replaced and disposed this manager's song.
    if (this.musicGain && activeToneMusicOwner !== this.toneMusicOwner) return;
    if (activeToneMusicOwner === this.toneMusicOwner) {
      if (this.toneMusicPaused) {
        this.toneMusicPaused = false;
        this.musicStartedAt = Tone.now();
        this.setMusicGain(1);
        Tone.getTransport().start(this.musicStartedAt);
      }
    } else {
      this.startToneMusic(this.musicKey as MusicKey);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.stopAllSounds();
    // Tone's context belongs to the game and is reused by the next scene.
    this.audioContext = undefined;
  }

  private bindUnlockGesture(): void {
    if (typeof window === "undefined") return;

    const unlock = (): void => {
      if (this.paused) return;
      if (!this.isAudioReady() || (this.musicKey && activeToneMusicOwner !== this.toneMusicOwner)) {
        this.unlock();
      }
    };
    // Keep gestures available after a tab/device suspends audio again.
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    this.unsubscribers.push(
      () => window.removeEventListener("pointerdown", unlock, true),
      () => window.removeEventListener("keydown", unlock, true),
    );
  }

  private startToneMusic(key: MusicKey): void {
    if (this.destroyed || this.paused || !this.audioContext || Tone.getContext().state !== "running") return;
    const arrangement = MUSIC_ARRANGEMENTS[key];
    stopToneMusic();
    const musicGain = new Tone.Gain(1).toDestination();
    this.musicGain = musicGain;
    this.toneMusicPaused = false;

    const melody = new Tone.Synth({
      oscillator: { type: arrangement.leadWave ?? "triangle" },
      envelope: { attack: 0.015, decay: 0.12, sustain: 0.08, release: 0.18 },
      volume: arrangement.leadVolumeDb ?? -10,
    }).connect(musicGain);
    const harmony = new Tone.PolySynth({
      maxPolyphony: 4,
      voice: Tone.Synth,
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.04, decay: 0.18, sustain: 0.16, release: 0.28 },
      },
      volume: arrangement.harmonyVolumeDb ?? -17,
    }).connect(musicGain);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.015, decay: 0.16, sustain: 0.1, release: 0.12 },
      volume: arrangement.bassVolumeDb ?? -19,
    }).connect(musicGain);

    const canPlayAt = (time: number, previousTime: number): boolean => {
      // After a busy frame, Tone can deliver several overdue notes together.
      // Skip them rather than clamp multiple oscillator starts to the same time.
      return !this.destroyed && !this.paused && activeToneMusicOwner === this.toneMusicOwner
        && time > previousTime && time >= Tone.immediate() + 0.005;
    };
    let lastMelodyAt = -Infinity;
    let lastChordAt = -Infinity;
    let lastBassAt = -Infinity;

    const melodySequence = new Tone.Sequence<string | null>(
      (time, note) => {
        if (note && canPlayAt(time, lastMelodyAt)) {
          lastMelodyAt = time;
          melody.triggerAttackRelease(note, arrangement.leadGate ?? "8n", time, 0.55);
        }
      },
      [...arrangement.melody],
      "8n",
    );
    const chordSequence = new Tone.Sequence<string | null>(
      (time, chord) => {
        const notes = chord ? CHORD_VOICINGS[chord] : undefined;
        if (notes && canPlayAt(time, lastChordAt)) {
          lastChordAt = time;
          harmony.triggerAttackRelease([...notes], "2n", time, 0.28);
        }
      },
      [...arrangement.chords],
      "2n",
    );
    const bassSequence = new Tone.Sequence<string>(
      (time, note) => {
        if (canPlayAt(time, lastBassAt)) {
          lastBassAt = time;
          bass.triggerAttackRelease(note, "4n", time, 0.48);
        }
      },
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
    activeToneMusicNodes = [melody, harmony, bass, melodySequence, chordSequence, bassSequence, musicGain];
    melodySequence.start(0);
    chordSequence.start(0);
    bassSequence.start(0);
    this.musicStartedAt = Tone.now();
    transport.start(this.musicStartedAt);
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

  private prepareFeedbackSound(key: FeedbackSoundKey): Promise<AudioBuffer | null> {
    const cached = this.feedbackBuffers.get(key);
    if (cached) return cached;
    const bytes = this.scene.cache.binary?.get(FEEDBACK_AUDIO[key].cacheKey) as ArrayBuffer | undefined;
    if (!this.audioContext || !bytes) return Promise.resolve(null);
    const decoded = this.audioContext.decodeAudioData(bytes.slice(0)).catch((error: unknown) => {
      console.error("효과음 해독 실패: " + FEEDBACK_AUDIO[key].url, error);
      return null;
    });
    this.feedbackBuffers.set(key, decoded);
    return decoded;
  }

  private async playFeedbackSound(key: FeedbackSoundKey): Promise<void> {
    const generation = this.effectsGeneration;
    const requestedAt = performance.now();
    const buffer = await this.prepareFeedbackSound(key);
    const isCurrent = (): boolean => !this.destroyed && !this.paused &&
      generation === this.effectsGeneration && performance.now() - requestedAt < 1000;
    if (!buffer || !isCurrent()) return;
    if (!this.isAudioReady()) {
      try {
        await Tone.start();
        if (!isCurrent()) return;
        this.resumeMusic();
      } catch { return; }
    }
    if (!isCurrent() || !this.isAudioReady()) return;
    const context = this.audioContext!;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(FEEDBACK_AUDIO[key].gain, context.currentTime);
    source.connect(gain).connect(context.destination);
    this.feedbackVoices += 1;
    this.setMusicGain(0.38);
    this.trackSource(source, [gain], () => {
      this.feedbackVoices = Math.max(0, this.feedbackVoices - 1);
      if (!this.paused && !this.destroyed) this.setMusicGain(this.feedbackVoices ? 0.38 : 1);
    });
    source.start();
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
      { frequency: 720, peak: 0.075, decay: 0.24 },
      { frequency: 1190, peak: 0.026, decay: 0.16 },
      { frequency: 1820, peak: 0.010, decay: 0.09 },
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
      oscillator.stop(startsAt + 0.28);
    }
  }

  private playWhistle(): void {
    if (!this.isAudioReady()) return;
    const context = this.audioContext!;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(950, now);
    oscillator.frequency.linearRampToValueAtTime(1600, now + 0.09);
    oscillator.frequency.linearRampToValueAtTime(1380, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
    oscillator.connect(gain).connect(context.destination);
    this.trackSource(oscillator, [gain]);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
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

}
