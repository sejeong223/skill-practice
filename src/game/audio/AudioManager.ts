import * as Phaser from "phaser";
import type { GameEventBus } from "../bridge/GameEventBus";
import type { GameplayEventBus } from "../core/events";
import { MUSIC_KEYS, SOUND_KEYS, type MusicKey, type SoundKey } from "./audioManifest";

export class AudioManager {
  private readonly scene: Phaser.Scene;
  private readonly unsubscribers: Array<() => void> = [];
  private audioContext?: AudioContext;
  private musicKey: string | null = null;
  private musicTimer: ReturnType<typeof setInterval> | undefined;

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
      this.unsubscribers.push(gameBus.on("cutscene-beat", (payload) => { if (payload.beat.soundCue) this.playSfx(payload.beat.soundCue); if (payload.beat.musicKey) this.playMusic(payload.beat.musicKey); }));
    }
  }

  public unlock(): void {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!this.audioContext && Context) this.audioContext = new Context();
    void this.audioContext?.resume();
  }

  public playSfx(key: string): void {
    if (!SOUND_KEYS.includes(key as SoundKey)) return;
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key);
      return;
    }
    this.playTone(key);
  }

  public playMusic(key: string): void {
    if (!MUSIC_KEYS.includes(key as MusicKey)) return;
    if (this.musicKey === key) return;
    this.stopMusic();
    this.musicKey = key;
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key, { loop: true, volume: 0.22 });
      return;
    }
    this.musicTimer = setInterval(() => this.playTone(key, true), 2200);
  }

  public stopMusic(): void {
    if (this.musicKey && this.scene.cache.audio.exists(this.musicKey)) this.scene.sound.stopByKey(this.musicKey);
    if (this.musicTimer !== undefined) clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.musicKey = null;
  }

  public destroy(): void {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.stopMusic();
  }

  private bindUnlockGesture(): void {
    this.scene.input.once("pointerdown", () => this.unlock());
    this.scene.input.keyboard?.once("keydown", () => this.unlock());
  }

  private playTone(key: string, music = false): void {
    if (!this.audioContext || this.audioContext.state !== "running") return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const frequency = key.includes("death") ? 120 : key.includes("bark") || key.includes("whine") ? 260 : music ? 180 : 420;
    oscillator.frequency.value = frequency;
    oscillator.type = music ? "triangle" : "square";
    gain.gain.setValueAtTime(music ? 0.018 : 0.035, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + (music ? 0.28 : 0.12));
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + (music ? 0.28 : 0.12));
  }

  private musicForStage(stageId: string): MusicKey {
    if (stageId.startsWith("world-01")) return "world-01-alley";
    if (stageId.startsWith("world-02")) return "world-02-amusement";
    if (stageId.startsWith("world-03")) return "world-03-factory";
    if (stageId.startsWith("world-04")) return "world-04-rooftop";
    return stageId.startsWith("world-05") ? "world-05-kingdom" : "boss";
  }
}
