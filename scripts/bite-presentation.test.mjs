import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerAnimator, BITE_PRESENTATION_MS } = require("../src/game/entities/PlayerAnimator.ts");

function harness() {
  const image = { visible: false, frame: -1, destroyed: false };
  for (const method of ["setFrame", "setVisible", "setPosition", "setOrigin", "setScale", "setAngle", "setFlipX", "setFlipY", "setAlpha", "setDepth"]) {
    image[method] = function (...values) {
      if (method === "setFrame") this.frame = values[0];
      if (method === "setVisible") this.visible = values[0];
      if (method === "setPosition") [this.x, this.y] = values;
      if (method === "setFlipX") this.flipX = values[0];
      return this;
    };
  }
  image.destroy = () => { image.destroyed = true; };
  const player = {
    scene: { time: { now: 0 }, textures: { exists: () => true }, anims: { exists: () => true },
      add: { sprite: (_x, _y, key) => { image.textureKey = key; return image; } } },
    x: 100, y: 120, originX: 0.5, originY: 99 / 128, scaleX: 1, scaleY: 1,
    angle: 0, alpha: 1, depth: 10, flipX: false, flipY: false,
    texture: { key: "corgi-run" }, frame: { name: 0 },
    body: { velocity: { x: 0, y: 0 }, width: 48, height: 40 }, state: "idle",
    appearance: { run: "corgi-run", bark: "corgi-bark" },
    getAppearanceTextures() { return this.appearance; }, getAnimationState() { return this.state; },
    anims: { timeScale: 1, stop() {}, play() {} },
    on() {}, off() {}, setTexture(key, frame = 0) { this.texture.key = key; this.frame.name = frame; },
    alignFeetToFrame() {},
  };
  return { image, player, animator: new PlayerAnimator(player) };
}

test("E 물기 오버레이가 80ms 간격 네 프레임 뒤 정확히 320ms에 종료된다", () => {
  const { image, player, animator } = harness();
  assert.equal(BITE_PRESENTATION_MS, 320);
  animator.triggerBite(1000);
  assert.equal(image.textureKey, "corgi-bite");
  for (const [elapsed, frame] of [[0, 0], [79, 0], [80, 1], [159, 1], [160, 2], [239, 2], [240, 3], [319, 3]]) {
    player.x += 1;
    player.flipX = elapsed >= 160;
    animator.update(1000 + elapsed, 0);
    assert.equal(image.frame, frame);
    assert.equal(image.x, player.x);
    assert.equal(image.flipX, player.flipX);
    assert.equal(image.visible, true);
    assert.equal(player.texture.key, "corgi-run");
  }
  animator.update(1320, 0);
  assert.equal(image.visible, false);
});

test("의상, 짖기, 사망 및 장면 종료가 물기 표시를 안전하게 전환한다", () => {
  const { image, player, animator } = harness();
  player.appearance = { run: "wear-bee-bodysuit-run", bark: "wear-bee-bodysuit-bark" };
  player.setTexture(player.appearance.run);
  animator.triggerBite(0);
  assert.equal(player.texture.key, player.appearance.run);
  animator.triggerBark();
  assert.equal(image.visible, false);
  assert.equal(player.texture.key, player.appearance.bark);
  animator.triggerBite(100);
  assert.equal(player.texture.key, player.appearance.run);
  animator.stopBite();
  assert.equal(image.visible, false);
  animator.triggerBite(200);
  animator.destroy();
  assert.equal(image.visible, false);
  assert.equal(image.destroyed, true);
});
