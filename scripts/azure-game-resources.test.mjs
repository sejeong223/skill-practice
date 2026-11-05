import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fixture, setup, run, writes, base, db, container } from "./azure-game-test-support.mjs";
test("Inspect is read-only and Free10 does not block Standard2; existing DB adds zero RU",t=>{
 const s=fixture(),dir=setup(t,s),e=join(dir,".git/azure-game-resources.json"),before=readFileSync(e);const r=run(dir,s,"Inspect");assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(writes(r).length,0);
 const out=JSON.parse(r.stdout);assert.equal(out.otherThroughputRU,3400);assert.equal(out.additionalRU,0);assert.equal(out.sku,"Standard");assert.equal(out.freeSiteCount,10);assert.equal(out.standardSiteCount,2);assert.equal(out.standardSiteLimit,100);assert.equal(out.reusedDatabase,true);assert.deepEqual(readFileSync(e),before);
});
test("ARM default etag exclusion is accepted without changing any index",t=>{
 for(const path of ['/"_etag"/?','/_etag/?']){
  const s=fixture();s.container.resource.indexingPolicy.excludedPaths.push({path});const before=structuredClone(s.container);const dir=setup(t,s),r=run(dir,s,"Inspect");
  assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(writes(r).length,0);assert.deepEqual(r.fixture.container,before);
 }
});
test("Create only creates Standard SWA, preserves legacy evidence and retries without any write",t=>{
 const s=fixture(),dir=setup(t,s),r=run(dir,s);assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(writes(r).length,1);assert.equal(writes(r)[0].slice(0,2).join(" "),"staticwebapp create");assert.ok(writes(r)[0].includes("Standard"));
 const e=JSON.parse(readFileSync(join(dir,".git/azure-game-resources.json")));assert.equal(e.plan,"2026-11-04-entra-login-cloud-save-leaderboard");assert.equal(e.databaseId,db);assert.equal(e.containerId,container);assert.equal(e.standardRelease.sku,"Standard");
 for(const mode of ["Create","Verify"]){const again=run(dir,r.fixture,mode);assert.equal(again.status,0,again.stderr);assert.equal(writes(again).length,0);assert.equal(JSON.parse(again.stdout).sharedResourcesPreserved,true);}
});
test("wrong identity, missing existing DB/container/role, unapproved region and Standard100 reject writes",t=>{
 for(const mutate of [s=>s.login.id="wrong",s=>s.login.tenantId="wrong",s=>s.db=null,s=>s.container=null,s=>s.roles=[],s=>s.regions=[["Central US"]],s=>s.sites=Array.from({length:100},()=>({sku:"Standard"}))]){
  const s=fixture(),dir=setup(t,s);mutate(s);const r=run(dir,s);assert.notEqual(r.status,0);assert.equal(writes(r).length,0);
 }
});
test("no evidence and same-name Free/unrecorded Standard apps cannot be adopted",t=>{
 for(const kind of ["no-evidence","free","unrecorded"]){const s=fixture(),dir=setup(t,s);if(kind==="no-evidence")rmSync(join(dir,".git/azure-game-resources.json"));else{s.swa=structuredClone(s.newSwa);if(kind==="free")s.swa.sku.name="Free";}const r=run(dir,s);assert.notEqual(r.status,0);assert.equal(writes(r).length,0);}
});
test("Standard service quota failure preserves DB/role/evidence and can resume SWA creation only",t=>{
 const s=fixture(),dir=setup(t,s),e=join(dir,".git/azure-game-resources.json"),before=readFileSync(e);s.failSwa=true;const r=run(dir,s);assert.notEqual(r.status,0);assert.equal(writes(r).length,1);assert.match(r.stderr,/SWA site quota reached/);assert.ok(!(r.stdout+r.stderr).includes("SECRET_SHOULD_NOT_PRINT"));assert.deepEqual(readFileSync(e),before);
 assert.equal(r.fixture.db.id,db);assert.equal(r.fixture.container.id,container);assert.equal(r.fixture.roles.length,1);r.fixture.failSwa=false;const resumed=run(dir,r.fixture);assert.equal(resumed.status,0,resumed.stderr);assert.equal(writes(resumed).length,1);
});
test("changed shared metadata, index/partition and excessive role scope stop before writes",t=>{
 for(const mutate of [s=>s.account.capacity.totalThroughputLimit=4000,s=>s.otherContainers[0].resource.defaultTtl=60,s=>s.container.resource.partitionKey.paths=["/wrong"],s=>s.container.resource.indexingPolicy.excludedPaths.push({path:"/other/*"}),s=>s.dbThroughput=400,s=>s.roles[0].scope=base,s=>s.api.appId="wrong",s=>s.web.requiredResourceAccess=[]]){
  const s=fixture(),dir=setup(t,s);mutate(s);const r=run(dir,s);assert.notEqual(r.status,0);assert.equal(writes(r).length,0);
 }
});
test("Verify checks bridge, credential presence and allowlist JSON without leaking values",t=>{
 for(const mutate of [s=>s.web.spa.redirectUris=[],s=>s.settings.secretPresent=false,s=>s.settings.testIds='{}',s=>s.settings.testIds='["bad"]']){
  const s=fixture();s.swa=s.newSwa;const dir=setup(t,s);mutate(s);const r=run(dir,s,"Verify");assert.notEqual(r.status,0);assert.equal(writes(r).length,0);
 }
});
