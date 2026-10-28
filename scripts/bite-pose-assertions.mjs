import assert from "node:assert/strict";

const width = 448;

function assertNoEyeCatchlight(bite, frame, label) {
  const dark = (x, y) => {
    if (x < 80 || x > 101 || y < 30 || y > 69) return false;
    const at = (y * width + frame * 112 + x) * 4;
    return bite.data[at + 3] >= 128 &&
      Math.max(bite.data[at], bite.data[at + 1], bite.data[at + 2]) < 100;
  };
  const visited = new Set();
  const eyes = [];
  for (let y = 30; y <= 69; y++) for (let x = 80; x <= 101; x++) {
    const key = y * 112 + x;
    if (visited.has(key) || !dark(x, y)) continue;
    const queue = [[x, y]];
    visited.add(key);
    let left = x, right = x, top = y, bottom = y;
    for (let index = 0; index < queue.length; index++) {
      const [cx, cy] = queue[index];
      left = Math.min(left, cx); right = Math.max(right, cx);
      top = Math.min(top, cy); bottom = Math.max(bottom, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextX = cx + dx, nextY = cy + dy, next = nextY * 112 + nextX;
        if (!visited.has(next) && dark(nextX, nextY)) { visited.add(next); queue.push([nextX, nextY]); }
      }
    }
    if (queue.length >= 18 && queue.length <= 40 && left >= 84 && right <= 99 &&
        right - left <= 6 && bottom - top <= 8) eyes.push({ left, right, top, bottom, area: queue.length });
  }
  assert.ok(eyes.length > 0, `${label} ${frame}: 코기의 검은 눈이 보여야 한다`);
  const eye = eyes.sort((a, b) => b.area - a.area)[0];
  for (let y = eye.top + 1; y < eye.bottom; y++) for (let x = eye.left + 1; x < eye.right; x++) {
    const at = (y * width + frame * 112 + x) * 4;
    assert.ok(bite.data[at + 3] < 128 ||
      Math.min(bite.data[at], bite.data[at + 1], bite.data[at + 2]) < 180,
    `${label} ${frame}: 눈 내부에 흰 안광이 없어야 한다 (${x}, ${y})`);
  }
}

export function assertFullBodyBitePoses(bite, run, label) {
  assert.deepEqual([bite.info.width, bite.info.height, bite.info.channels], [width, 128, 4]);
  assert.deepEqual([run.info.width, run.info.height, run.info.channels], [width, 128, 4]);
  const bodySilhouettes = new Set();
  const frontPaws = [];

  for (let frame = 0; frame < 4; frame++) {
    let opaque = 0, bottom = -1, bodyShapeChanged = 0;
    let hasTail = false, hasMuzzle = false, hasPaws = false;
    let bodyHash = 2166136261;
    let pawSum = 0, pawCount = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
      const at = (y * width + frame * 112 + x) * 4;
      const alpha = bite.data[at + 3];
      const runAlpha = run.data[at + 3];
      if (x >= 10 && x < 80 && y >= 40 && y < 95) {
        if ((alpha >= 128) !== (runAlpha >= 128)) bodyShapeChanged++;
        bodyHash ^= alpha >= 128 ? 1 : 0;
        bodyHash = Math.imul(bodyHash, 16777619) >>> 0;
      }
      if (alpha < 128) continue;
      opaque++;
      bottom = y;
      if (x <= 25) hasTail = true;
      if (x >= 92 && y < 75) hasMuzzle = true;
      if (y >= 95) hasPaws = true;
      if (x >= 70 && y >= 82 && y <= 102) {
        pawSum += x;
        pawCount++;
      }
    }
    assert.ok(opaque >= 3_500, `${label} ${frame}: 코기 전신이 보여야 한다`);
    assert.ok(bodyShapeChanged >= 150, `${label} ${frame}: 머리뿐 아니라 몸통 실루엣도 새로 그려야 한다`);
    if (frame === 1) assert.ok(bodyShapeChanged >= 400, `${label}: 돌진에서 몸통 자세 변화가 뚜렷해야 한다`);
    assert.ok(hasTail && hasMuzzle && hasPaws, `${label} ${frame}: 꼬리·주둥이·발이 모두 보여야 한다`);
    assert.ok(bottom >= 99 && bottom <= 102, `${label} ${frame}: 발 높이가 프레임 밖으로 튀지 않아야 한다`);
    assertNoEyeCatchlight(bite, frame, label);
    bodySilhouettes.add(bodyHash);
    frontPaws.push(pawSum / pawCount);
  }
  assert.equal(bodySilhouettes.size, 4, `${label}: 네 프레임의 몸통·다리 자세가 서로 달라야 한다`);
  assert.ok(frontPaws[1] > frontPaws[0] + 4, `${label}: 두 번째 프레임에서 앞다리가 실제로 돌진해야 한다`);
  for (const [x, y] of [[0, 0], [111, 127], [336, 0], [447, 127]]) {
    assert.equal(bite.data[(y * width + x) * 4 + 3], 0, `${label}: 프레임 가장자리는 투명해야 한다`);
  }
}
