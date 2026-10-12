import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { toCheckpointGimmickState } = require("../src/game/systems/checkpointGimmickState.ts");

const active = Object.freeze({
  gimmickId: "world01-stage-4-fake-bone-fire-2000", status: "triggered",
  startedAt: 2000, counterpresses: 0, snapshotSeed: 123,
});

for (const kind of ["fake-bone-green", "fake-bone-reverse", "fake-bone-fire"]) {
  test(`${kind}: 부활 상태에서만 사망 효과를 정리하고 현재 시도의 효과는 유지한다`, () => {
    const saved = toCheckpointGimmickState(kind, active);
    assert.equal(saved.status, "escaped");
    assert.equal(saved.startedAt, null);
    assert.equal(active.status, "triggered");
    assert.equal(active.startedAt, 2000);
    assert.equal(saved.gimmickId, active.gimmickId);
    assert.equal(saved.snapshotSeed, active.snapshotSeed);
    assert.notEqual(saved, active);
  });
}

test("이전 스냅샷에 남은 만료 효과도 복원 시 정리하고 반복 복원 결과가 같다", () => {
  const legacy = Object.freeze({ ...active, startedAt: -100000 });
  const restored = toCheckpointGimmickState("fake-bone-fire", legacy);
  assert.equal(restored.status, "escaped");
  assert.equal(restored.startedAt, null);
  assert.deepEqual(toCheckpointGimmickState("fake-bone-fire", restored), restored);
  assert.equal(legacy.status, "triggered");
});

test("먹지 않은 간식과 완료된 상태는 그대로 복원한다", () => {
  for (const status of ["armed", "dead", "escaped"]) {
    const original = Object.freeze({ ...active, status, startedAt: status === "armed" ? null : 2000 });
    const restored = toCheckpointGimmickState("fake-bone-fire", original);
    assert.deepEqual(restored, original);
    assert.notEqual(restored, original);
  }
});

test("무너진 바닥 등 지속되는 지형 변화와 시작 시간은 보존한다", () => {
  for (const kind of ["ground-collapse", "ground-rise", "forward-jump-wall"]) {
    assert.deepEqual(toCheckpointGimmickState(kind, active), active);
  }
});
