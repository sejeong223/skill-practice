import * as Phaser from "phaser";
import type { ActorAction } from "./types";
import type { IntroHomeLayout } from "./introLayout";

const CORGI_FRAME = {
  idle: 0,
  eager: 1,
  surprised: 4,
  determined: 7,
} as const;

const CORGI_FLIP_X = {
  ownerArrival: true,
  idle: false,
  eager: true,
  surprised: false,
  determined: false,
  slipperCarry: true,
} as const;

const CORGI_SURPRISE_BASELINE_OFFSET = 18;

const CAT_FRAME = {
  crouch: 0,
  jump: 2,
  withRib: 3,
  taunt: 5,
  retreat: 6,
} as const;

const OWNER_FRAME = {
  point: 1,
  retreat: 2,
  enter: 0,
} as const;

const OWNER_POINT_Y_OFFSET = -75;

export class IntroActorRig {
  private readonly scene: Phaser.Scene;
  private readonly layout: IntroHomeLayout;
  private readonly corgi: Phaser.GameObjects.Sprite;
  private readonly cat: Phaser.GameObjects.Sprite;
  private readonly owner: Phaser.GameObjects.Sprite;
  private readonly rib: Phaser.GameObjects.Image;
  private readonly slipper: Phaser.GameObjects.Image;
  private readonly corgiCarry: Phaser.GameObjects.Image;
  private readonly delayedCalls: Phaser.Time.TimerEvent[] = [];
  private corgiBaseY: number;
  private catBaseY: number;
  private slipperAttached = false;

  public constructor(scene: Phaser.Scene, layout: IntroHomeLayout) {
    this.scene = scene;
    this.layout = layout;

    const background = scene.add
      .image(layout.background.x, layout.background.y, "intro-home")
      .setDisplaySize(layout.worldSize.width, layout.worldSize.height)
      .setDepth(layout.background.depth);
    background.setName("intro-home-background");

    this.corgi = scene.add
      .sprite(layout.corgiWait.x, layout.corgiWait.y, "intro-corgi-actions", CORGI_FRAME.idle)
      .setOrigin(0.5, 0.92)
      .setScale(0.54)
      .setFlipX(CORGI_FLIP_X.ownerArrival)
      .setDepth(layout.corgiWait.depth);
    this.corgiBaseY = layout.corgiWait.y;

    this.corgiCarry = scene.add
      .image(layout.corgiWait.x, layout.corgiWait.y, "intro-corgi-carry-slipper")
      .setOrigin(0.5, 0.92)
      .setDisplaySize(370, 246)
      .setFlipX(false)
      .setDepth(layout.corgiWait.depth)
      .setVisible(false);

    this.cat = scene.add
      .sprite(layout.balcony.x, layout.balcony.y, "intro-tuxedo-actions", CAT_FRAME.crouch)
      .setOrigin(0.5, 0.92)
      .setScale(0.48)
      .setFlipX(false)
      .setDepth(layout.balcony.depth)
      .setVisible(false);
    this.catBaseY = layout.balcony.y;

    this.owner = scene.add
      .sprite(layout.ownerEntry.x, layout.ownerEntry.y, "intro-owner-hands", OWNER_FRAME.enter)
      .setOrigin(0.5, 0.5)
      .setScale(0.38)
      .setDepth(layout.ownerEntry.depth)
      .setVisible(false)
      .setAlpha(0);

    this.rib = scene.add
      .image(layout.rib.x, layout.rib.y, "intro-rib")
      .setDisplaySize(170, 170)
      .setDepth(layout.rib.depth)
      .setVisible(false)
      .setAlpha(0);

    this.slipper = scene.add
      .image(layout.slipper.x, layout.slipper.y, "intro-slipper")
      .setDisplaySize(145, 145)
      .setDepth(layout.slipper.depth)
      .setVisible(false)
      .setAlpha(0);

  }

  public playAction(action: ActorAction): void {
    switch (action.actor) {
      case "corgi":
        this.playCorgiAction(action);
        break;
      case "owner":
        this.playOwnerAction(action);
        break;
      case "tuxedo-cat":
        this.playCatAction(action);
        break;
      case "rib":
        this.playRibAction(action);
        break;
      case "slipper":
        this.playSlipperAction(action);
        break;
    }
  }

  public reset(): void {
    this.stop();
    this.slipperAttached = false;
    this.corgiBaseY = this.layout.corgiWait.y;
    this.catBaseY = this.layout.balcony.y;
    this.corgi
      .setPosition(this.layout.corgiWait.x, this.corgiBaseY)
      .setFrame(CORGI_FRAME.idle)
      .setFlipX(CORGI_FLIP_X.ownerArrival)
      .setVisible(true)
      .setAlpha(1);
    this.corgiCarry
      .setPosition(this.layout.corgiWait.x, this.corgiBaseY)
      .setFlipX(false)
      .setVisible(false)
      .setAlpha(1);
    this.cat
      .setPosition(this.layout.balcony.x, this.catBaseY)
      .setFrame(CAT_FRAME.crouch)
      .setVisible(false)
      .setAlpha(1);
    this.owner
      .setPosition(this.layout.ownerEntry.x, this.layout.ownerEntry.y)
      .setFrame(OWNER_FRAME.enter)
      .setVisible(false)
      .setAlpha(0);
    this.rib
      .setPosition(this.layout.rib.x, this.layout.rib.y)
      .setDisplaySize(170, 170)
      .setRotation(0)
      .setDepth(this.layout.rib.depth)
      .setVisible(false)
      .setAlpha(0);
    this.slipper
      .setPosition(this.layout.slipper.x, this.layout.slipper.y)
      .setVisible(false)
      .setAlpha(0);
  }

  public stop(): void {
    this.scene.tweens.killTweensOf(this.corgi);
    this.scene.tweens.killTweensOf(this.corgiCarry);
    this.scene.tweens.killTweensOf(this.cat);
    this.scene.tweens.killTweensOf(this.owner);
    this.scene.tweens.killTweensOf(this.rib);
    this.scene.tweens.killTweensOf(this.slipper);
    this.delayedCalls.splice(0).forEach((event) => event.remove(false));
  }

  public destroy(): void {
    this.stop();
    this.corgi.destroy();
    this.corgiCarry.destroy();
    this.cat.destroy();
    this.owner.destroy();
    this.rib.destroy();
    this.slipper.destroy();
  }

  public hideOwnerAndBag(): void {
    this.scene.tweens.killTweensOf(this.owner);
    this.owner.setVisible(false).setAlpha(0);
  }

  private playCorgiAction(action: ActorAction): void {
    this.scene.tweens.killTweensOf(this.corgi);
    this.scene.tweens.killTweensOf(this.corgiCarry);
    if (action.action !== "surprise") this.corgi.setY(this.corgiBaseY);

    switch (action.action) {
      case "enter":
      case "hold":
        this.corgi
          .setFrame(CORGI_FRAME.eager)
          .setFlipX(CORGI_FLIP_X.eager)
          .setVisible(true)
          .setAlpha(1);
        this.corgiCarry.setVisible(false);
        break;
      case "surprise":
        this.corgi
          .setY(this.corgiBaseY + CORGI_SURPRISE_BASELINE_OFFSET)
          .setFrame(CORGI_FRAME.surprised)
          .setFlipX(CORGI_FLIP_X.surprised)
          .setVisible(true);
        this.corgiCarry.setVisible(false);
        break;
      case "leap":
        this.playCorgiLeap(action.x, action.y);
        break;
      case "retreat":
        if (this.slipperAttached) {
          this.corgiCarry.setFlipX(CORGI_FLIP_X.slipperCarry).setVisible(true);
        }
        else {
          this.corgi
            .setFrame(CORGI_FRAME.determined)
            .setFlipX(CORGI_FLIP_X.determined)
            .setVisible(true);
        }
        this.scene.tweens.add({
          targets: this.slipperAttached ? this.corgiCarry : this.corgi,
          x: action.x ?? this.layout.dogDoor.x - 90,
          alpha: 0,
          duration: 750,
          ease: "Sine.easeIn",
        });
        break;
      case "point":
      case "reveal":
      case "steal":
      case "taunt":
      case "throw":
        this.corgi.setFrame(CORGI_FRAME.idle).setFlipX(CORGI_FLIP_X.idle);
        break;
    }
  }

  private playOwnerAction(action: ActorAction): void {
    this.scene.tweens.killTweensOf(this.owner);

    switch (action.action) {
      case "enter":
        this.owner
          .setFrame(OWNER_FRAME.enter)
          .setPosition(this.layout.ownerEntry.x, this.layout.ownerEntry.y)
          .setVisible(true)
          .setAlpha(0);
        this.scene.tweens.add({
          targets: this.owner,
          alpha: 1,
          duration: 900,
          ease: "Sine.easeOut",
        });
        break;
      case "point":
        this.owner
          .setFrame(OWNER_FRAME.point)
          .setPosition(this.layout.ownerEntry.x, this.layout.ownerEntry.y + OWNER_POINT_Y_OFFSET)
          .setVisible(true)
          .setAlpha(1);
        break;
      case "retreat":
        this.owner.setFrame(OWNER_FRAME.retreat);
        this.scene.tweens.add({
          targets: this.owner,
          x: this.layout.ownerEntry.x - 260,
          alpha: 0,
          duration: 850,
          ease: "Sine.easeIn",
          onComplete: () => this.hideOwnerAndBag(),
        });
        break;
      case "reveal":
      case "steal":
      case "taunt":
      case "hold":
      case "throw":
      case "leap":
        this.owner.setVisible(false);
        break;
      case "surprise":
        this.owner
          .setFrame(OWNER_FRAME.point)
          .setPosition(this.layout.ownerEntry.x, this.layout.ownerEntry.y + OWNER_POINT_Y_OFFSET)
          .setVisible(true)
          .setAlpha(1);
        break;
    }
  }

  private playCatAction(action: ActorAction): void {
    this.scene.tweens.killTweensOf(this.cat);

    switch (action.action) {
      case "enter":
        this.cat
          .setFrame(CAT_FRAME.jump)
          .setPosition(this.layout.balcony.x + 150, this.layout.balcony.y - 220)
          .setVisible(true)
          .setAlpha(1);
        this.scene.tweens.add({
          targets: this.cat,
          x: this.layout.balcony.x,
          y: this.catBaseY,
          duration: 800,
          ease: "Sine.easeInOut",
          onComplete: () => this.cat.setFrame(CAT_FRAME.crouch),
        });
        break;
      case "steal":
        this.cat.setFrame(CAT_FRAME.withRib).setVisible(true);
        break;
      case "taunt":
        this.cat.setFrame(CAT_FRAME.taunt).setVisible(true);
        break;
      case "retreat":
      case "leap":
        this.rib.setVisible(false).setDisplaySize(170, 170).setDepth(this.layout.rib.depth);
        this.cat.setFrame(CAT_FRAME.retreat).setVisible(true);
        this.scene.tweens.add({
          targets: this.cat,
          x: action.x ?? this.layout.balcony.x + 270,
          y: action.y ?? this.catBaseY - 140,
          alpha: 0,
          duration: 800,
          ease: "Sine.easeIn",
        });
        break;
      case "hold":
        this.cat.setFrame(CAT_FRAME.crouch).setVisible(true);
        break;
      case "point":
      case "reveal":
      case "throw":
      case "surprise":
        this.cat.setFrame(CAT_FRAME.crouch);
        break;
    }
  }

  private playRibAction(action: ActorAction): void {
    this.scene.tweens.killTweensOf(this.rib);

    switch (action.action) {
      case "reveal":
        this.hideOwnerAndBag();
        this.corgi.setFlipX(CORGI_FLIP_X.idle);
        this.rib
          .setPosition(this.layout.rib.x, this.layout.rib.y - 45)
          .setDisplaySize(170, 170)
          .setRotation(0)
          .setDepth(this.layout.rib.depth)
          .setVisible(true)
          .setAlpha(0);
        this.scene.tweens.add({
          targets: this.rib,
          y: this.layout.rib.y,
          alpha: 1,
          duration: 650,
          ease: "Sine.easeOut",
        });
        break;
      case "steal":
        this.rib.setDisplaySize(170, 170).setRotation(0);
        this.scene.tweens.add({
          targets: this.rib,
          x: this.layout.balcony.x - 35,
          y: this.layout.balcony.y - 70,
          alpha: 0,
          duration: 520,
          ease: "Sine.easeIn",
          onComplete: () => this.rib.setVisible(false),
        });
        break;
      case "taunt":
        this.rib
          .setPosition(this.layout.balcony.x - 10, this.layout.balcony.y - 25)
          .setDisplaySize(76, 76)
          .setRotation(0)
          .setDepth(this.layout.balcony.depth + 1)
          .setVisible(true)
          .setAlpha(1);
        break;
      case "throw":
        this.rib.setVisible(true).setAlpha(1);
        this.scene.tweens.add({
          targets: this.rib,
          x: action.x ?? this.layout.balcony.x,
          y: action.y ?? this.layout.balcony.y - 120,
          duration: 700,
          ease: "Sine.easeIn",
        });
        break;
      case "hold":
        this.rib
          .setPosition(this.layout.rib.x, this.layout.rib.y)
          .setDisplaySize(170, 170)
          .setRotation(0)
          .setDepth(this.layout.rib.depth)
          .setVisible(true)
          .setAlpha(1);
        break;
      case "enter":
      case "leap":
      case "point":
      case "surprise":
        this.rib.setVisible(false);
        break;
      case "retreat":
        this.rib.setVisible(false).setDisplaySize(170, 170).setDepth(this.layout.rib.depth);
        break;
    }
  }

  private playSlipperAction(action: ActorAction): void {
    this.scene.tweens.killTweensOf(this.slipper);

    switch (action.action) {
      case "hold":
      case "reveal":
        this.slipperAttached = true;
        this.slipper.setVisible(false).setAlpha(0);
        this.corgi.setY(this.corgiBaseY).setVisible(false);
        this.corgiCarry
          .setPosition(this.corgi.x, this.corgiBaseY)
          .setFlipX(CORGI_FLIP_X.slipperCarry)
          .setVisible(true)
          .setAlpha(1);
        break;
      case "throw":
        this.slipperAttached = false;
        this.corgiCarry.setVisible(false);
        this.corgi
          .setFrame(CORGI_FRAME.determined)
          .setFlipX(CORGI_FLIP_X.determined)
          .setVisible(true)
          .setAlpha(1);
        this.slipper.setVisible(true).setAlpha(1);
        this.scene.tweens.add({
          targets: this.slipper,
          x: action.x ?? this.layout.dogDoor.x,
          y: action.y ?? this.layout.dogDoor.y,
          duration: 500,
          ease: "Sine.easeIn",
        });
        break;
      case "enter":
      case "steal":
      case "taunt":
      case "leap":
      case "point":
      case "retreat":
      case "surprise":
        this.slipperAttached = false;
        this.slipper.setVisible(false);
        this.corgiCarry.setVisible(false);
        break;
    }
  }

  private playCorgiLeap(x?: number, y?: number): void {
    const targetX = x ?? this.layout.dogDoor.x;
    const landingY = y ?? this.corgiBaseY;
    const actor = this.slipperAttached ? this.corgiCarry : this.corgi;
    actor.setFlipX(this.slipperAttached ? CORGI_FLIP_X.slipperCarry : CORGI_FLIP_X.determined);
    if (this.slipperAttached) {
      actor.setPosition(this.corgiCarry.x, this.corgiCarry.y).setVisible(true).setAlpha(1);
    } else {
      this.corgi.setFrame(CORGI_FRAME.determined).setVisible(true).setAlpha(1);
    }
    this.scene.tweens.add({
      targets: actor,
      x: targetX,
      y: landingY - 100,
      duration: 330,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.corgiBaseY = landingY;
        this.scene.tweens.add({
          targets: actor,
          y: landingY,
          duration: 230,
          ease: "Sine.easeIn",
          onComplete: () => {
            if (targetX < this.layout.dogDoor.x) {
              actor.setVisible(false);
              this.slipperAttached = false;
              this.slipper.setVisible(false);
            }
          },
        });
      },
    });
  }

}
