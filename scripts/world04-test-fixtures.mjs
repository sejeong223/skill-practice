import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
export const requireTS = createRequire(import.meta.url);
requireTS.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
export function world04Harness(x = 96, y = 504) {
  const objects = [], colliders = [];
  const display = (x, y, width = 1, height = 1, texture) => {
    const d = { x, y, width, height, texture, visible: true, alpha: 1, destroyed: false, frame: 0,
      setOrigin() { return this; }, setDepth() { return this; }, setTint(v) { this.tint = v; return this; }, clearTint() { return this; },
      setVisible(v) { this.visible = v; return this; }, setAlpha(v) { this.alpha = v; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; }, setY(y) { this.y = y; return this; },
      setSize(w, h) { this.width = w; this.height = h; return this; }, setDisplaySize(w, h) { return this.setSize(w, h); },
      setFrame(v) { this.frame = v; return this; }, setFlipX(v) { this.flipX = v; return this; }, setRotation(v) { this.rotation = v; return this; },
      setAngle(v) { this.angle = v; return this; }, destroy() { this.destroyed = true; },
    }; objects.push(d); return d;
  };
  const scene = { add: { zone: display, tileSprite: display,
    image(x, y, texture) { return display(x, y, 1, 1, texture); }, sprite(x, y, texture) { return display(x, y, 1, 1, texture); },
    graphics() { const g = display(0, 0); for (const n of ['clear', 'lineStyle', 'lineBetween', 'strokeLineShape', 'fillStyle', 'fillCircle']) g[n] = () => g; return g; },
  }, physics: { add: {
    existing(d) { d.body = { enable: true, x: d.x, y: d.y, width: d.width, height: d.height,
      setSize(w, h) { this.width = w; this.height = h; }, updateFromGameObject() { this.x = d.x; this.y = d.y; this.width = d.width; this.height = d.height; } }; },
    collider(a, b, callback) { const c = { a, b, callback, destroyed: false, destroy() { this.destroyed = true; } }; colliders.push(c); return c; },
  } } };
  const player = { x, y, flipX: false, events: [],
    setVelocityX(v) { this.body.velocity.x = v; }, setVelocityY(v) { this.body.velocity.y = v; },
    emit(...args) { this.events.push(args); }, getControlOverride() { return null; }, isControlLocked() { return false; },
    setAnimationState() {}, setFlipX(v) { this.flipX = v; },
  };
  player.body = { x: x - 36, y: y - 40, width: 72, height: 40, blocked: { down: true }, touching: { down: true },
    velocity: { x: 240, y: 0 }, position: {}, prev: { copy() {} }, prevFrame: { copy() {} },
    updateFromGameObject() { this.x = player.x - 36; this.y = player.y - 40; }, setGravityY() {},
  };
  const move = (x, y = 504) => { player.x = x; player.y = y; player.body.updateFromGameObject(); };
  let active = true, dashing = false; const deaths = [];
  const port = { isActive: () => active, isDashing: () => dashing, kill(id, risk) { deaths.push({ id, risk }); return true; } };
  return { scene, player, objects, colliders, move, port, deaths, setActive(v) { active = v; }, setDashing(v) { dashing = v; } };
}
