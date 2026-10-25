import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { PlayerAnimator } = require("../src/game/entities/PlayerAnimator.ts");
function harness() {
  const player = {
    scene: { time: { now: 0 }, textures: { exists: () => true }, anims: { exists: () => true } },
    texture: { key: "corgi-run" }, frame: { name: 0 }, flipX: true,
    body: { velocity: { x: 100, y: -200 }, width: 48, height: 40 }, state: "idle",
    appearance: { run: "corgi-run", bark: "corgi-bark" },
    getAppearanceTextures() { return this.appearance; },
    anims: { timeScale: 1, stop() {}, play() {} },
    on() {}, off() {}, setTexture(key, frame = 0) { this.texture.key = key; this.frame.name = frame; },
    alignFeetToFrame(y) { this.foot = y; }, getAnimationState() { return this.state; },
  };
  return { player, animator: new PlayerAnimator(player) };
}
test("이동 상태가 덮어써져도 짖기는 450ms 유지되고 현재 동작으로 돌아온다", () => {
  const {player:p, animator:a} = harness(); const body = structuredClone(p.body);
  a.triggerBark(); p.state = "run"; a.update(100, 449);
  assert.equal(p.texture.key, "corgi-bark"); assert.equal(p.foot,99);
  a.update(10000, 0); assert.equal(p.texture.key, "corgi-bark");
  a.update(10001, 1); assert.equal(p.texture.key, "corgi-run");
  assert.deepEqual(p.body,body); assert.equal(p.flipX,true);
});
test("옷을 입고 짖어도 옷 입은 짖기 이미지에서 옷 입은 달리기 이미지로 돌아온다", () => {
  const { player: p, animator: a } = harness();
  p.appearance = { run: "wear-bee-bodysuit-run", bark: "wear-bee-bodysuit-bark" };
  p.setTexture(p.appearance.run);
  a.triggerBark();
  assert.equal(p.texture.key, p.appearance.bark);
  a.update(500, 450);
  assert.equal(p.texture.key, p.appearance.run);
});
test("재시도·destroy는 입을 닫고 idle로 복원하며 누락된 texture는 무시한다", () => {
  const {player:p, animator:a} = harness();
  a.triggerBark(); a.stopBark(); assert.equal(p.texture.key,"corgi-run");
  a.triggerBark(); a.update(500,450); assert.equal(p.texture.key,"corgi-run");
  a.triggerBark(); a.destroy(); assert.equal(p.texture.key,"corgi-run");
  p.scene.textures.exists = () => false;
  a.triggerBark(); assert.equal(p.texture.key,"corgi-run");
});

test("every outfit stays equipped through strides, jumps, attacks, and barking", () => {
  for (const id of [
    "pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit",
    "hotdog-outfit", "diamond-armor", "custom-outfit-1",
  ]) {
    const { player, animator } = harness();
    player.appearance = { run: `wear-${id}-run`, bark: `wear-${id}-bark` };
    player.setTexture(player.appearance.run);
    player.state = "run";
    animator.update(0, 16);
    assert.equal(player.texture.key, player.appearance.run, `${id}: running`);
    player.frame.name = 3;
    animator.update(16, 16);
    assert.equal(player.frame.name, 3, `${id}: fourth stride`);
    for (const state of ["jump", "double-jump", "fall", "dash", "attack-bite", "attack-slipper", "hurt", "idle"]) {
      player.state = state;
      animator.update(32, 16);
      assert.equal(player.texture.key, player.appearance.run, `${id}: ${state}`);
    }
    animator.triggerBark();
    assert.equal(player.texture.key, player.appearance.bark, `${id}: bark`);
    animator.update(500, 450);
    assert.equal(player.texture.key, player.appearance.run, `${id}: after bark`);
    animator.destroy();
  }
});
