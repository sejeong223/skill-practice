import type { AttackBounds, AttackContact } from "./WeaponAttack";

export class WeaponHitTracker {
  private readonly processed = new Set<string>();

  public accept(contact: AttackContact, target: AttackBounds): boolean {
    const bounds = contact.bounds;
    if (this.processed.has(contact.attackId) || bounds.x >= target.x + target.width ||
        bounds.x + bounds.width <= target.x || bounds.y >= target.y + target.height ||
        bounds.y + bounds.height <= target.y) return false;
    this.processed.add(contact.attackId);
    return true;
  }

  public reset(): void { this.processed.clear(); }
}
