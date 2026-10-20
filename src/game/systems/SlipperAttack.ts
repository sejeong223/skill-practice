import { GameplayEventBus } from "../core/events";
import { Player } from "../entities/Player";

export interface SlipperAttackResult {
  accepted: boolean;
  kind:
    | "slipper-hit"
    | "slipper-sneeze"
    | "bite-hit"
    | "cooldown"
    | "bite-window-expired"
    | "tool-preview";
  comboCount: number;
  knockbackX: number;
}

const SLIPPER_HIT_COOLDOWN_MS = 150;
const SLIPPER_COMBO_WINDOW_MS = 700;
const BITE_WINDOW_MS = 500;
const SNEEZE_KNOCKBACK_X = 360;

export class SlipperAttackController {
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private nextAttackAt = 0;
  private lastHitAt = -Infinity;
  private comboCount = 0;
  private biteWindowUntil = 0;
  private sneezeUnlockAt = 0;
  private holdingSlipper = true;

  public constructor(player: Player, eventBus: GameplayEventBus) {
    this.player = player;
    this.eventBus = eventBus;
  }

  public tryAttack(now: number): SlipperAttackResult {
    if (now < this.nextAttackAt || now < this.sneezeUnlockAt) {
      return {
        accepted: false,
        kind: "cooldown",
        comboCount: this.comboCount,
        knockbackX: 0,
      };
    }

    this.nextAttackAt = now + SLIPPER_HIT_COOLDOWN_MS;

    if (!this.holdingSlipper) {
      if (now > this.biteWindowUntil) {
        this.holdingSlipper = true;
        this.comboCount = 0;
        return {
          accepted: false,
          kind: "bite-window-expired",
          comboCount: this.comboCount,
          knockbackX: 0,
        };
      }

      this.comboCount = 0;
      this.biteWindowUntil = 0;
      this.holdingSlipper = true;
      this.player.setAnimationState("attack-bite");
      this.eventBus.emit("bite-hit", { now });

      return {
        accepted: true,
        kind: "bite-hit",
        comboCount: 0,
        knockbackX: 0,
      };
    }

    this.comboCount =
      now - this.lastHitAt <= SLIPPER_COMBO_WINDOW_MS
        ? this.comboCount + 1
        : 1;
    this.lastHitAt = now;
    this.player.setAnimationState("attack-slipper");

    if (this.comboCount < 3) {
      this.eventBus.emit("slipper-hit", {
        comboCount: this.comboCount,
        now,
      });

      return {
        accepted: true,
        kind: "slipper-hit",
        comboCount: this.comboCount,
        knockbackX: 0,
      };
    }

    const knockbackX =
      (this.player.flipX ? 1 : -1) * SNEEZE_KNOCKBACK_X;

    this.holdingSlipper = false;
    this.biteWindowUntil = now + BITE_WINDOW_MS;
    this.sneezeUnlockAt = now + 350;
    this.player.lockControl("slipper-sneeze");
    this.player.setAnimationState("hurt");
    this.player.setVelocityX(knockbackX);
    this.player.setVelocityY(-120);

    this.eventBus.emit("slipper-sneeze", {
      knockbackX,
      now,
    });
    this.eventBus.emit("drawback-triggered", {
      toolId: "rabbit-slipper",
      drawbackId: "slipper-sneeze-recoil",
      now,
    });

    return {
      accepted: true,
      kind: "slipper-sneeze",
      comboCount: this.comboCount,
      knockbackX,
    };
  }

  public update(now: number): void {
    if (now >= this.sneezeUnlockAt) {
      this.player.unlockControl("slipper-sneeze");
    }
  }

  public resetForStage(): void {
    this.nextAttackAt = 0;
    this.lastHitAt = -Infinity;
    this.comboCount = 0;
    this.biteWindowUntil = 0;
    this.sneezeUnlockAt = 0;
    this.holdingSlipper = true;
    this.player.unlockControl("slipper-sneeze");
  }

  public isHoldingSlipper(): boolean {
    return this.holdingSlipper;
  }

  public getComboCount(): number {
    return this.comboCount;
  }
}
