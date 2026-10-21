import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { getOwnedCatalogEntries } = require("../src/game/data/ownedItemCatalog.ts");
const { createDefaultProgressState } = require("../src/game/core/constants.ts");

test("보유 목록은 기본 장비와 옛 장비도 분류 순서대로 보여준다", () => {
  const progress = createDefaultProgressState();
  progress.ownedToolIds = ["cardboard-box", "rabbit-slipper", "cardboard-tube", "upside-down-bowl", "squeaky-ball", "rabbit-slipper"];
  progress.ownedCosmeticIds = ["prince-crown", "bee-bodysuit", "bee-bodysuit"];
  const entries = getOwnedCatalogEntries(progress);
  assert.deepEqual(entries.map(entry => entry.id), [
    "rabbit-slipper", "squeaky-ball", "cardboard-tube", "upside-down-bowl", "cardboard-box", "bee-bodysuit", "prince-crown",
  ]);
  assert.deepEqual(entries.map(entry => entry.category), ["weapon", "weapon", "weapon", "shield", "shield", "outfit", "accessory"]);
  assert.equal(entries[0].iconUrl, null);
  assert.equal(entries[1].iconUrl, "/assets/pixel/shop/items/squeaky-ball.png");
  assert.equal(entries[4].nameKo, "종이 상자");
  assert.ok(!entries.some(entry => entry.descriptionKo.includes("재채기 반동")));
});

test("미보유·알 수 없는 ID는 빠지고 빈 카테고리도 허용한다", () => {
  assert.deepEqual(getOwnedCatalogEntries({ ownedToolIds: [], ownedCosmeticIds: [] }), []);
  const entries = getOwnedCatalogEntries({ ownedToolIds: ["unknown"], ownedCosmeticIds: ["unknown", "birthday-party-hat"] });
  assert.deepEqual(entries.map(entry => entry.id), ["birthday-party-hat"]);
  assert.equal(entries[0].category, "accessory");
});
