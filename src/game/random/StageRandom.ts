import type { StageId } from "../core/types";

export class StageRandom {
  private state: number;
  public readonly seed: number;

  public constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed || 0x6d2b79f5;
  }

  public static fromStage(stageId: StageId, attempt: number): StageRandom {
    return new StageRandom(StageRandom.hash(stageId + ":" + attempt));
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error("StageRandom.pick requires at least one value.");
    }

    return values[Math.floor(this.next() * values.length)];
  }

  public chance(probability: number): boolean {
    return this.next() < Math.max(0, Math.min(1, probability));
  }

  public delay(minMs: number, maxMs: number): number {
    const low = Math.min(minMs, maxMs);
    const high = Math.max(minMs, maxMs);
    return Math.round(low + (high - low) * this.next());
  }

  public offset(values: readonly number[]): number {
    return this.pick(values);
  }

  public static hash(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }
}
