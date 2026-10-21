import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { createDefaultProgressState } = require(path.join(root, 'src/game/core/constants.ts'));
const { PROGRESS_STORAGE_KEY } = require(path.join(root, 'src/game/persistence/saveTypes.ts'));
const serverUrl = 'http://127.0.0.1:3100';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const imagePath = path.join(root, '.memory/reviews/2026-10-21-cheese-tabby-in-game.png');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(read, predicate, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await read();
      if (predicate(last)) return last;
    } catch (error) {
      last = error.message;
    }
    await sleep(100);
  }
  throw new Error(`${label}: ${JSON.stringify(last)}`);
}

async function ensureServer() {
  try {
    if ((await fetch(serverUrl, { signal: AbortSignal.timeout(1500) })).ok) return null;
  } catch { /* Start the test server below. */ }
  const nextBinary = path.join(root, 'node_modules/next/dist/bin/next');
  const server = spawn(process.execPath, [nextBinary, 'start', '-p', '3100'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true,
  });
  await until(async () => {
    if (server.exitCode !== null) throw new Error(`Next dev exited: ${server.exitCode}`);
    return (await fetch(serverUrl, { signal: AbortSignal.timeout(1500) })).ok;
  }, Boolean, 'Next production server');
  return server;
}

function findGameExpression() {
  return `(() => {
    const mount = document.querySelector('canvas')?.parentElement;
    const key = mount && Object.keys(mount).find(name => name.startsWith('__reactFiber$'));
    let fiber = key ? mount[key] : null;
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const game = hook.memoizedState?.current;
        if (game?.scene?.getScene) return game;
      }
      fiber = fiber.return;
    }
    return null;
  })()`;
}

const gameExpression = findGameExpression();
const stateExpression = `(() => {
  const game = ${gameExpression};
  const scene = game?.scene?.getScene('StageScene');
  const cat = scene?.cheeseTabbySprite;
  const matches = scene?.children.list.filter(child => child.texture?.key === 'world-02-cheese-tabby-boss');
  return {
    url: location.href,
    body: document.body?.innerText?.slice(0, 300),
    loaded: !!game?.textures?.exists('world-02-cheese-tabby-boss'),
    active: !!scene?.scene?.isActive(),
    stage: scene?.stageId,
    canvas: { width: document.querySelector('canvas')?.width, height: document.querySelector('canvas')?.height },
    cat: cat && { active: cat.active, visible: cat.visible, x: cat.x, y: cat.y,
      flipX: cat.flipX, frame: cat.frame.name, texture: cat.texture.key, depth: cat.depth },
    count: matches?.length,
    calico: !!scene?.calicoSprite?.active,
    introOverlay: !!document.querySelector('.cutscene-overlay, .intro-title-card, .intro-name-card'),
    camera: scene?.cameras?.main && { scrollX: scene.cameras.main.scrollX, width: scene.cameras.main.width },
  };
})()`;

async function main() {
  const server = await ensureServer();
  const profile = await mkdtemp(path.join(os.tmpdir(), 'cheese-tabby-browser-'));
  let chrome;
  let ws;

  try {
    chrome = spawn(chromePath, [
      '--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--hide-scrollbars', '--window-size=1280,720',
      '--force-device-scale-factor=1', '--remote-debugging-port=0',
      `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore', windowsHide: true });
    const port = await until(
      async () => Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]),
      port => Number.isInteger(port) && port > 0,
      'Chrome DevTools port',
    );
    const page = await until(
      async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
        .find(target => target.type === 'page'),
      Boolean,
      'Chrome page',
    );
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let serial = 0;
    const pending = new Map();
    const errors = [];
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') {
        errors.push(message.params?.exceptionDetails?.text ?? 'runtime exception');
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
        errors.push(message.params.args?.map(arg => arg.value ?? arg.description).join(' ') ?? 'console error');
      }
      if (message.method === 'Network.responseReceived' && message.params?.response?.status === 404 &&
          message.params.response.url.includes('/assets/')) {
        errors.push(`missing asset: ${message.params.response.url}`);
      }
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      if (message.error) waiting.reject(new Error(JSON.stringify(message.error)));
      else waiting.resolve(message.result);
    };
    function call(method, params = {}) {
      const id = ++serial;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result?.value;
    }
    async function state() { return evaluate(stateExpression); }

    await call('Page.enable');
    await call('Runtime.enable');
    await call('Network.enable');
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
    });
    const progress = createDefaultProgressState('테스트 코기');
    progress.onboardingCompleted = true;
    progress.selectedWorldId = 'world-02';
    progress.clearedStages = ['world-01-stage-boss'];
    progress.seenCutsceneIds = ['intro-home', 'world-02-intro'];
    const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
    const injection = await call('Page.addScriptToEvaluateOnNewDocument', {
      source: `if (location.hostname === '127.0.0.1') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
    });
    await call('Page.navigate', { url: serverUrl });
    await until(state, value => value?.loaded, `cheese tabby texture loaded; errors=${JSON.stringify(errors)}`, 30000);
    await until(state, value => value?.active && value.stage === 'world-02-stage-1',
      'initial world 2 stage', 30000);
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });

    for (let attempt = 0; attempt < 2; attempt++) {
      await evaluate(`(() => { const game = ${gameExpression}; game.scene.stop('StageScene');
        game.scene.start('StageScene', {
        stageId: 'world-02-stage-boss', seed: 1, playerName: '테스트 코기'
      }); })()`);
      await until(state, value => value?.stage === 'world-02-stage-boss' && value.active && value.cat?.active,
        `boss scene attempt ${attempt + 1}`);
      await evaluate(`(() => { const scene = ${gameExpression}.scene.getScene('StageScene');
        scene.player.resetTo({ x: 1000, y: 460 }); scene.player.setVelocity(0, 0);
      })()`);
      await sleep(350);
      const snapshot = await state();
      assert.deepEqual(snapshot.canvas, { width: 1280, height: 720 });
      assert.deepEqual(snapshot.cat, {
        active: true, visible: true, x: 1280, y: 446,
        flipX: true, frame: 0, texture: 'world-02-cheese-tabby-boss', depth: 10,
      }, JSON.stringify(snapshot));
      assert.equal(snapshot.count, 1, 'one boss sprite after scene restart');
      assert.equal(snapshot.calico, false, 'world 1 boss should not appear');
      assert.equal(snapshot.introOverlay, false, 'intro UI should not cover the boss');
      assert.ok(snapshot.camera.scrollX <= 1280 && snapshot.camera.scrollX + snapshot.camera.width >= 1280,
        'the cat must be inside the visible camera');
    }

    assert.deepEqual(errors, [], 'browser errors and missing assets');
    const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(imagePath, Buffer.from(screenshot.data, 'base64'));
    console.log('월드 2 보스 맵 브라우저 검증 통과: 왼쪽을 보는 치즈 태비 1마리, 1280×720, 에셋 오류 없음');
  } finally {
    ws?.close();
    chrome?.kill();
    server?.kill();
    // Only remove the uniquely named browser profile created in the OS temp directory above.
    const resolved = path.resolve(profile);
    const tempRoot = path.resolve(os.tmpdir());
    if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('cheese-tabby-browser-')) {
      await rm(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    }
  }
}

await main();
