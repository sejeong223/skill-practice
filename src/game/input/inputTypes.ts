export interface KeybindMap {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  attack: string[];
  dash: string[];
  bark: string[];
  bite: string[];
  pause: string[];
}

export interface InputSnapshot {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  attackPressed: boolean;
  dashPressed: boolean;
  barkPressed: boolean;
  bitePressed: boolean;
  pausePressed: boolean;
  pauseHeld: boolean;
}
