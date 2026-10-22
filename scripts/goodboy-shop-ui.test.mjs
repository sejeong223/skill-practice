import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { MARKET_PRODUCTS, MARKET_CATEGORIES } = require("../src/game/data/marketCatalog.ts");
const { SHOP_CATEGORY_LABELS, SHOP_DIALOGUE, pickShopDialogue, wrapShopIndex } = require("../src/game/data/shopDialogue.ts");
const { canOpenSharedMenu } = require("../src/game/systems/gameMenuAvailability.ts");

test("상점 네 분류에서 19개 상품을 좌우 순환하며 첫 상품으로 돌아온다", () => {
  assert.deepEqual(MARKET_CATEGORIES.map(category => SHOP_CATEGORY_LABELS[category]), ["무기류", "방패류", "의상류", "장신구류"]);
  assert.deepEqual(MARKET_CATEGORIES.map(category => MARKET_PRODUCTS.filter(product => product.category === category).length), [5, 4, 5, 5]);
  for (const category of MARKET_CATEGORIES) {
    const count = MARKET_PRODUCTS.filter(product => product.category === category).length;
    assert.equal(wrapShopIndex(0, -1, count), count - 1);
    assert.equal(wrapShopIndex(count - 1, 1, count), 0);
    assert.equal(wrapShopIndex(0, count, count), 0);
  }
});

test("주인 대사는 진입·선택·구매 때 각 두 후보 중 독립 추첨하고 부족 문구는 고정된다", () => {
  assert.deepEqual(SHOP_DIALOGUE.entry, [
    "어서 오개, 손님! 천사 같은 미소와 신상 장비로 모신다개~!",
    "냥아치 잡으러 가냐개? 내 장비면 15cm 다리로도 문제없다개!",
  ]);
  assert.deepEqual(SHOP_DIALOGUE.selection, [
    "오~ 손님 안목 미쳤다개! 그거 가성비 대박 상품이다개!",
    "이거 끼면 동네 강아지들이 다 부러워할 걸개!",
  ]);
  assert.deepEqual(SHOP_DIALOGUE.purchase, [
    "탁월한 선택이라개! 살아서 꼭 왕갈비뼈를 찾아오라개~!",
    "감사하다개! 영수증은 갈비뼈 찾고 챙겨주겠다개!",
  ]);
  assert.equal(SHOP_DIALOGUE.insufficient, "손님, 자본주의는 냉정한 법이라개~");
  for (const kind of ["entry", "selection", "purchase"]) {
    assert.equal(pickShopDialogue(kind, () => 0), SHOP_DIALOGUE[kind][0]);
    assert.equal(pickShopDialogue(kind, () => 0.999), SHOP_DIALOGUE[kind][1]);
  }
});

test("상점·카탈로그·그림판은 모든 월드의 플레이 중 열리고 메뉴가 열리면 서로 막는다", () => {
  const state = {
    stageId: "world-01-stage-1", mode: "play", introReady: true, paused: false,
    shopOpen: false, catalogOpen: false, paintOpen: false,
    worldSelectOpen: false, resetProgressDialogOpen: false,
  };
  for (let world = 1; world <= 5; world++) {
    assert.equal(canOpenSharedMenu({ ...state, stageId: `world-0${world}-stage-boss` }), true);
  }
  for (const blocked of ["shopOpen", "catalogOpen", "paintOpen", "worldSelectOpen", "resetProgressDialogOpen", "paused"]) {
    assert.equal(canOpenSharedMenu({ ...state, [blocked]: true }), false, blocked);
  }
  for (const mode of ["safe", "cutscene", "dead", "stage-clear"]) {
    assert.equal(canOpenSharedMenu({ ...state, mode }), false, mode);
  }
  assert.equal(canOpenSharedMenu({ ...state, introReady: false }), false);
});
