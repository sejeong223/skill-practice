import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixture, setup, run, writes, web } from "./azure-game-test-support.mjs";
const prepared=()=>{const s=fixture();s.swa=s.newSwa;return s;};
test("Finalize merges required redirects, preserves existing URI/allowlist and repeats without writes",t=>{
 const s=prepared();s.web.spa.redirectUris=["https://previous.example/"];s.settings.testIds=JSON.stringify([web]);s.settings.tenant=null;const dir=setup(t,s);
 const evidence=readFileSync(join(dir,".git/azure-game-apps.json"));const r=run(dir,s,"Finalize","apps");assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(writes(r).length,2);assert.equal(r.fixture.web.spa.redirectUris.length,5);assert.ok(r.fixture.web.spa.redirectUris.includes("https://previous.example/"));assert.equal(r.fixture.settings.testIds,JSON.stringify([web]));
 assert.deepEqual(readFileSync(join(dir,".git/azure-game-apps.json")),evidence);const again=run(dir,r.fixture,"Finalize","apps");assert.equal(again.status,0,again.stderr);assert.equal(writes(again).length,0);
});
test("missing allowlist is initialized to [] while credentials remain outside read/write projections",t=>{
 const s=prepared();s.settings.testIds=null;const r=run(setup(t,s),s,"Finalize","apps");assert.equal(r.status,0,r.stderr);assert.equal(r.fixture.settings.testIds,"[]");assert.equal(r.fixture.settings.secretPresent,true);
 for(const a of r.trace)assert.ok(!a.join(" ").includes("GAME_COSMOS_CLIENT_SECRET"));assert.ok(!(r.stdout+r.stderr).includes("SECRET_SHOULD_NOT_PRINT"));
});
test("wrong tenant/app/SP/scope, Free SKU and invalid host/allowlist perform zero writes",t=>{
 for(const mutate of [s=>s.login.tenantId="bad",s=>s.api.api.requestedAccessTokenVersion=1,s=>s.api.signInAudience="AzureADMultipleOrgs",s=>s.web.web.implicitGrantSettings.enableAccessTokenIssuance=true,s=>s.principal.appId=web,s=>s.swa.sku.name="Free",s=>s.swa.defaultHostname="game.azurestaticapps.net.evil.example",s=>s.settings.testIds='{}',s=>s.settings.testIds='["bad"]']){
  const s=prepared(),dir=setup(t,s);mutate(s);const r=run(dir,s,"Finalize","apps");assert.notEqual(r.status,0);assert.equal(writes(r).length,0);
 }
});
test("missing or foreign evidence and legacy Create never recreate apps",t=>{
 for(const kind of ["missing","foreign","create"]){const s=prepared(),dir=setup(t,s);const file=join(dir,".git/azure-game-resources.json");if(kind==="missing")rmSync(file);if(kind==="foreign"){const e=JSON.parse(readFileSync(file));e.subscription="other";writeFileSync(file,JSON.stringify(e));}const r=run(dir,s,kind==="create"?"Create":"Finalize","apps");assert.notEqual(r.status,0);assert.equal(writes(r).length,0);}
});
test("Azure failures suppress raw response and never fall back to real CLI",t=>{
 const s=prepared();s.web.spa.redirectUris=[];s.failWrite=true;const r=run(setup(t,s),s,"Finalize","apps");assert.notEqual(r.status,0);assert.ok(!(r.stdout+r.stderr).includes("SECRET_SHOULD_NOT_PRINT"));assert.equal(writes(r).length,1);
});
