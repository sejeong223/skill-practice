import { StageRandom } from "../random/StageRandom.ts";

export type MackerelAttackKind = "brick" | "cement-wave" | "cement-lump";

const ATTACKS: readonly MackerelAttackKind[] = ["brick", "cement-wave", "cement-lump"];

export class MackerelAttackSchedule {
  private readonly stageId: "world-03-stage-boss";
  private random!: StageRandom;
  private firstBag: MackerelAttackKind[] = [];
  private nextIndex = 0;
  private lastAttack: MackerelAttackKind | null = null;
  private reservedAttack: MackerelAttackKind | null = null;
  private retryAttack: MackerelAttackKind | null = null;

  public constructor(stageId: "world-03-stage-boss", attempt: number) {
    this.stageId = stageId;
    this.reset(attempt);
  }

  public reserve(): MackerelAttackKind {
    if (this.reservedAttack) return this.reservedAttack;
    if (this.nextIndex < this.firstBag.length) {
      this.reservedAttack = this.firstBag[this.nextIndex];
    } else if (this.retryAttack) {
      this.reservedAttack = this.retryAttack;
    } else {
      this.reservedAttack = this.random.pick(ATTACKS.filter(kind => kind !== this.lastAttack));
    }
    return this.reservedAttack;
  }

  public commit(): MackerelAttackKind {
    if (!this.reservedAttack) throw new Error("Mackerel attack must be reserved before launch.");
    const attack = this.reservedAttack;
    if (this.nextIndex < this.firstBag.length) this.nextIndex += 1;
    this.lastAttack = attack;
    this.reservedAttack = null;
    this.retryAttack = null;
    return attack;
  }

  public cancel(): void {
    if (this.reservedAttack && this.nextIndex >= this.firstBag.length) {
      this.retryAttack = this.reservedAttack;
    }
    this.reservedAttack = null;
  }

  public reset(attempt: number): void {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new Error("Mackerel attack attempt must be a positive integer.");
    }
    this.random = StageRandom.fromStage(this.stageId, attempt);
    this.firstBag = [...ATTACKS];
    for (let index = this.firstBag.length - 1; index > 0; index -= 1) {
      const other = Math.floor(this.random.next() * (index + 1));
      [this.firstBag[index], this.firstBag[other]] = [this.firstBag[other], this.firstBag[index]];
    }
    this.nextIndex = 0;
    this.lastAttack = null;
    this.reservedAttack = null;
    this.retryAttack = null;
  }

  public getLastAttack(): MackerelAttackKind | null {
    return this.lastAttack;
  }
}
