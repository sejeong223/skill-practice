import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createAccessTokenVerifier } from "../api/src/auth.ts";
import { loadServerConfig } from "../api/src/config.ts";
import { errorResponse, readJsonBody, withIdentity } from "../api/src/http.ts";
import { createGameHandlers, GAME_ROUTES } from "../api/src/functions/game.ts";
const require=createRequire(new URL("../api/package.json",import.meta.url));
const {SignJWT,generateKeyPair,exportJWK,createLocalJWKSet}=await import(pathToFileURL(require.resolve("jose")).href);
const {HttpRequest}=require("@azure/functions");
const ids={tenant:"11111111-1111-4111-8111-111111111111",api:"22222222-2222-4222-8222-222222222222",web:"33333333-3333-4333-8333-333333333333",oid:"44444444-4444-4444-8444-444444444444"};
const env={GAME_TENANT_ID:ids.tenant,GAME_API_CLIENT_ID:ids.api,GAME_WEB_CLIENT_ID:ids.web,GAME_COSMOS_CLIENT_ID:ids.api,GAME_COSMOS_ENDPOINT:"https://maze-rescue-ms-b7af62a9.documents.azure.com:443/",GAME_COSMOS_CLIENT_SECRET:"test-only-not-a-credential"};
const config=loadServerConfig(env);
const pair=await generateKeyPair("RS256");
const jwk={...await exportJWK(pair.publicKey),kid:"unit-test",alg:"RS256"};
const keys=createLocalJWKSet({keys:[jwk]});
const verify=createAccessTokenVerifier(config,keys);
const now=Math.floor(Date.now()/1000);
async function token(patch={},key=pair.privateKey) {
  return new SignJWT({ver:"2.0",tid:ids.tenant,oid:ids.oid,azp:ids.web,scp:"access_as_user",
    iss:"https://login.microsoftonline.com/"+ids.tenant+"/v2.0",aud:ids.api,nbf:now-5,exp:now+3600,...patch})
    .setProtectedHeader({alg:"RS256",kid:"unit-test"}).sign(key);
}
const req=(method="GET",body,authorization)=>new HttpRequest({method,url:"https://game.example/api/game/bootstrap",
  headers:{"content-type":"application/json",...(authorization?{authorization}:{})},
  ...(body===undefined?{}:{body:{string:typeof body==="string"?body:JSON.stringify(body)}})});
test("signed member and guest identity use verified tenant/oid, not email",async()=>{
  for(const patch of [{email:"changed@elsewhere.test"},{idp:"https://guest.test",preferred_username:"guest@outside.test"}]){
    const result=await verify("Bearer "+await token(patch));
    assert.deepEqual(result,{tenantId:ids.tenant,objectId:ids.oid,namespace:"prod",playerId:"prod:"+ids.tenant+":"+ids.oid});
  }
});
test("only server allowlist chooses test namespace",async()=>{
  const testVerify=createAccessTokenVerifier(loadServerConfig({...env,GAME_TEST_OBJECT_IDS:JSON.stringify([ids.oid])}),keys);
  assert.equal((await testVerify("Bearer "+await token())).namespace,"test");
  assert.equal((await verify("Bearer "+await token({namespace:"test"}))).namespace,"prod");
});
for(const [name,patch,status] of [
  ["wrong tenant",{tid:ids.api},403],["wrong issuer",{iss:"https://evil.test"},403],
  ["wrong audience",{aud:ids.web},403],["wrong authorized client",{azp:ids.api},403],
  ["missing scope",{scp:undefined},403],["wrong scope",{scp:"not_access_as_user"},403],
  ["v1 token",{ver:"1.0"},403],["expired",{exp:now-120},401],["not yet valid",{nbf:now+120},401],
  ["missing oid",{oid:undefined},401],["missing expiry",{exp:undefined},401],["malformed oid",{oid:"victim"},401],
]) test("rejects "+name,async()=>{await assert.rejects(()=>token(patch).then(t=>verify("Bearer "+t)),e=>e.status===status);});
test("ID tokens, missing auth and forged signature cannot authenticate",async()=>{
  await assert.rejects(()=>verify(),e=>e.status===401);
  await assert.rejects(()=>verify("Basic abc"),e=>e.status===401);
  await assert.rejects(()=>token({aud:ids.web,scp:undefined}).then(t=>verify("Bearer "+t)));
  const other=await generateKeyPair("RS256");
  await assert.rejects(()=>token({},other.privateKey).then(t=>verify("Bearer "+t)),e=>e.status===401);
});
test("JWKS outages are retryable and never reveal the underlying error",async()=>{
  const broken=createAccessTokenVerifier(config,async()=>{throw new TypeError("credential-like-private-message");});
  await assert.rejects(()=>token().then(t=>broken("Bearer "+t)),e=>e.status===503&&!e.message.includes("private-message"));
});
test("configuration rejects another Cosmos account and does not leak secret values",()=>{
  for(const patch of [{GAME_TENANT_ID:"bad"},{GAME_COSMOS_ENDPOINT:"https://other.documents.azure.com"},
    {GAME_COSMOS_CLIENT_SECRET:""},{GAME_TEST_OBJECT_IDS:'["bad"]'}]){
    assert.throws(()=>loadServerConfig({...env,...patch}),e=>e.status===503&&!e.message.includes(env.GAME_COSMOS_CLIENT_SECRET));
  }
});
test("every registered route authenticates before invoking the service",async()=>{
  let serviceCalls=0;
  const handlers=createGameHandlers(verify,async()=>{serviceCalls++;return {status:200,jsonBody:{ok:true}};});
  for(const [name,method] of GAME_ROUTES){
    const response=await handlers[name](req(method,method==="POST"?{}:undefined),{warn(){}});
    assert.equal(response.status,401);
    assert.equal(response.headers["Cache-Control"],"no-store");
  }
  assert.equal(serviceCalls,0);
  const valid="Bearer "+await token();
  for(const [name,method] of GAME_ROUTES){
    assert.equal((await handlers[name](req(method,method==="POST"?{}:undefined,valid),{warn(){}})).status,200);
  }
  assert.equal(serviceCalls,GAME_ROUTES.length);
});
test("unimplemented authenticated routes fail closed and wrong methods return 405",async()=>{
  const valid="Bearer "+await token();
  const handlers=createGameHandlers(verify);
  assert.equal((await handlers.bootstrap(req("GET",undefined,valid),{warn(){}})).status,503);
  assert.equal((await handlers.bootstrap(req("POST",{},valid),{warn(){}})).status,405);
});
test("platform principal header and supplied account identifiers never establish identity",async()=>{
  let owner;
  const handler=withIdentity(async(_req,id)=>{owner=id.playerId;return {status:200};},verify);
  const r=req("POST",{playerId:"victim"},"Bearer "+await token());
  r.headers.set("x-ms-client-principal",Buffer.from(JSON.stringify({userId:"victim"})).toString("base64"));
  assert.equal((await handler(r,{warn(){}})).status,200);
  assert.equal(owner,"prod:"+ids.tenant+":"+ids.oid);
});
test("body parser rejects malformed JSON, non-object, bad content type and oversize streams",async()=>{
  assert.deepEqual(await readJsonBody(req("POST",{a:1})),{a:1});
  for(const body of ["{","null","[]",JSON.stringify({data:"x".repeat(256*1024)})]){
    await assert.rejects(()=>readJsonBody(req("POST",body)));
  }
  const r=req("POST",{});r.headers.set("content-type","text/plain");
  await assert.rejects(()=>readJsonBody(r));
});
test("error response contains neither raw exception nor stack",()=>{
  const response=errorResponse(new Error("super-secret-value"));
  assert.equal(response.status,503);
  assert.ok(!JSON.stringify(response).includes("super-secret-value"));
});
