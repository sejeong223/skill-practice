import * as Phaser from "phaser";
import type { InputSnapshot, KeybindMap } from "./inputTypes";

export const DEFAULT_KEYBINDS: KeybindMap = {
  left: ["A", "LEFT"],
  right: ["D", "RIGHT"],
  up: ["W", "UP"],
  down: ["S", "DOWN"],
  jump: ["SPACE"],
  attack: ["J"],
  dash: ["K"],
  bark: ["L"],
  pause: ["ESC"],
};

export class InputManager {
  private readonly scene: Phaser.Scene;
  private keybinds: KeybindMap;
  private keys = new Map<string, Phaser.Input.Keyboard.Key[]>();

  public constructor(scene: Phaser.Scene, keybinds: KeybindMap) {
    this.scene = scene;
    this.keybinds = keybinds;
    this.bindKeys();
  }

  public setKeybinds(keybinds: KeybindMap): void {
    this.destroyKeys();
    this.keybinds = keybinds;
    this.bindKeys();
  }

  public getSnapshot(): InputSnapshot {
    return {
      left: this.isHeld("left"),
      right: this.isHeld("right"),
      jumpPressed: this.wasPressed("jump"),
      jumpHeld: this.isHeld("jump"),
      attackPressed: this.wasPressed("attack"),
      dashPressed: this.wasPressed("dash"),
      barkPressed: this.wasPressed("bark"),
      pausePressed: this.wasPressed("pause"),
    };
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
