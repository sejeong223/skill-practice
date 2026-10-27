import * as Phaser from "phaser";
import type { InputSnapshot, KeybindMap } from "./inputTypes";

export const DEFAULT_KEYBINDS: KeybindMap = {
  left: ["A", "LEFT"],
  right: ["D", "RIGHT"],
  up: ["UP"],
  down: ["S", "DOWN"],
  jump: ["SPACE"],
  attack: ["Q"],
  dash: ["K"],
  bark: ["W"],
  bite: ["E"],
  pause: ["ESC"],
};

export function toKeybindMap(keybinds: Readonly<Record<string, string>>): KeybindMap {
  const normalize = (key: string): string => {
    const named = ({
      ArrowLeft: "LEFT", ArrowRight: "RIGHT", ArrowUp: "UP", ArrowDown: "DOWN",
      Space: "SPACE", Escape: "ESC",
    } as Record<string, string>)[key];
    if (named) return named;
    if (/^Key[A-Z]$/.test(key)) return key.slice(3);
    if (/^Digit[0-9]$/.test(key)) return key.slice(5);
    return key;
  };
  const get = (action: keyof KeybindMap, fallback: string): string[] => [normalize(keybinds[action] ?? fallback)];
  return {
    left: get("left", "A"), right: get("right", "D"), up: get("up", "UP"), down: get("down", "S"),
    jump: get("jump", "SPACE"), attack: get("attack", "Q"), dash: get("dash", "K"), bark: get("bark", "W"), bite: get("bite", "E"), pause: get("pause", "ESC"),
  };
}

export class InputManager {
  private readonly scene: Phaser.Scene;
  private keybinds: KeybindMap;
  private keys = new Map<string, Phaser.Input.Keyboard.Key[]>();
  private snapshotFrame = -1;
  private cachedSnapshot?: InputSnapshot;

  public constructor(scene: Phaser.Scene, keybinds: KeybindMap) {
    this.scene = scene;
    this.keybinds = keybinds;
    this.bindKeys();
  }

  public setKeybinds(keybinds: KeybindMap): void {
    this.destroyKeys();
    this.keybinds = keybinds;
    this.snapshotFrame = -1;
    this.cachedSnapshot = undefined;
    this.bindKeys();
  }

  public getSnapshot(): InputSnapshot {
    const frame = this.scene.game.loop.frame;

    if (frame === this.snapshotFrame && this.cachedSnapshot) {
      return this.cachedSnapshot;
    }

    this.snapshotFrame = frame;
    this.cachedSnapshot = {
      left: this.isHeld("left"),
      right: this.isHeld("right"),
      jumpPressed: this.wasPressed("jump"),
      jumpHeld: this.isHeld("jump"),
      attackPressed: this.wasPressed("attack"),
      dashPressed: this.wasPressed("dash"),
      barkPressed: this.wasPressed("bark"),
      bitePressed: this.wasPressed("bite"),
      pausePressed: this.wasPressed("pause"),
      pauseHeld: this.isHeld("pause"),
    };

    return this.cachedSnapshot;
  }

  public destroy(): void {
    this.destroyKeys();
    this.keys.clear();
  }

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      throw new Error("Keyboard input is unavailable in this Phaser scene.");
    }

    for (const action of Object.keys(this.keybinds) as Array<keyof KeybindMap>) {
      const keyCodes = this.keybinds[action];
      const keys = keyCodes.map((keyCode) => keyboard.addKey(keyCode));
      this.keys.set(action, keys);
    }
  }

  private isHeld(action: keyof KeybindMap): boolean {
    return this.keys.get(action)?.some((key) => key.isDown) ?? false;
  }

  private wasPressed(action: keyof KeybindMap): boolean {
    return (
      this.keys.get(action)?.some((key) => Phaser.Input.Keyboard.JustDown(key)) ??
      false
    );
  }

  private destroyKeys(): void {
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      return;
    }

    for (const keys of this.keys.values()) {
      for (const key of keys) {
        keyboard.removeKey(key);
      }
    }
  }
}
