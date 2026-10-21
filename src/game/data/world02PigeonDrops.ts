export interface World02PigeonPassDefinition {
  readonly id: string;
  readonly triggerX: number;
  readonly dropX: number;
  readonly flightY: number;
  readonly birdSpeedX: number;
  readonly droppingSpeedY: number;
}

export const WORLD02_STAGE1_PIGEON_PASSES: readonly World02PigeonPassDefinition[] = [
  { id: "world-02-stage-1-pigeon-1", triggerX: 830, dropX: 1280, flightY: 160, birdSpeedX: 160, droppingSpeedY: 850 },
  { id: "world-02-stage-1-pigeon-2", triggerX: 1530, dropX: 1980, flightY: 160, birdSpeedX: 160, droppingSpeedY: 850 },
  { id: "world-02-stage-1-pigeon-3", triggerX: 2590, dropX: 3040, flightY: 160, birdSpeedX: 160, droppingSpeedY: 850 },
];
