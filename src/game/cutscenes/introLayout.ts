export interface IntroAnchor {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export interface IntroHomeLayout {
  readonly worldSize: { readonly width: 1920; readonly height: 720 };
  readonly background: IntroAnchor;
  readonly ownerEntry: IntroAnchor;
  readonly table: IntroAnchor;
  readonly corgiWait: IntroAnchor;
  readonly balcony: IntroAnchor;
  readonly dogDoor: IntroAnchor;
  readonly rib: IntroAnchor;
  readonly slipper: IntroAnchor;
}

export const INTRO_HOME_LAYOUT: IntroHomeLayout = {
  worldSize: { width: 1920, height: 720 },
  background: { x: 960, y: 360, depth: 0 },
  ownerEntry: { x: 365, y: 414, depth: 30 },
  table: { x: 890, y: 455, depth: 10 },
  corgiWait: { x: 650, y: 520, depth: 20 },
  balcony: { x: 1640, y: 510, depth: 25 },
  dogDoor: { x: 180, y: 520, depth: 20 },
  rib: { x: 920, y: 430, depth: 32 },
  slipper: { x: 650, y: 480, depth: 31 },
};
