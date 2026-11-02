export function shouldActivateWorld04Checkpoint(input: {
  previousCenterX: number; currentCenterX: number; checkpointX: number; alreadyActive: boolean;
}): boolean {
  return !input.alreadyActive && [input.previousCenterX, input.currentCenterX, input.checkpointX].every(Number.isFinite) &&
    input.previousCenterX < input.checkpointX && input.currentCenterX >= input.checkpointX;
}
