import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
export const subscription="b7af62a9-9a10-4deb-95fa-1690f7bbd33d",tenant="69c1e470-4528-435a-a1ae-de98e0aac738",api="a2e3f4fa-56e5-4ab5-ba41-43cb974b8722",web="e467e8bc-c900-4d08-88be-7f0a5fce2474",principal="f02b1a27-859d-4872-8549-99ad95927132",scopeId="d36060b6-6582-45d3-a95f-5b1b8b742883";
export const base=`/subscriptions/${subscription}/resourceGroups/grill-me-edu/providers/Microsoft.DocumentDB/databaseAccounts/maze-rescue-ms-b7af62a9`,db=base+"/sqlDatabases/legendary-rib-corgi",container=db+"/containers/game-data",swa=`/subscriptions/${subscription}/resourceGroups/grill-me-edu/providers/Microsoft.Web/staticSites/legendary-rib-corgi`;
const index=JSON.parse(readFileSync("scripts/game-cosmos-index.json","utf8"));
export function fixture(){return {login:{id:subscription,tenantId:tenant,state:"Enabled"},account:{id:base,kind:"GlobalDocumentDB",enableFreeTier:true,locations:[{locationName:"Korea Central"}],capabilities:[],publicNetworkAccess:"Enabled",capacity:{totalThroughputLimit:-1},ipRules:[],virtualNetworkRules:[],isVirtualNetworkFilterEnabled:false},
 regions:[["East Asia","Southeast Asia","Central US"]],db:{id:db,name:"legendary-rib-corgi",resource:{id:"legendary-rib-corgi"}},container:{id:container,name:"game-data",resource:{id:"game-data",partitionKey:{paths:["/playerId"],kind:"Hash"},defaultTtl:-1,indexingPolicy:structuredClone(index)}},swa:null,
 roles:[{principalId:principal,scope:base+"/dbs/legendary-rib-corgi",roleDefinitionId:base+"/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"}],others:[{name:"someone-elses-game",id:base+"/sqlDatabases/someone-elses-game",resource:{id:"someone-elses-game"}}],
 otherContainers:[{name:"scores",id:base+"/sqlDatabases/someone-elses-game/containers/scores",resource:{partitionKey:{paths:["/owner"],kind:"Hash"},defaultTtl:-1,indexingPolicy:{indexingMode:"consistent",automatic:true,includedPaths:[{path:"/*"}],excludedPaths:[]}}}],
 api:{id:"bd092a7c-ad3c-4fe4-8475-7ec70769be73",appId:api,displayName:"legendary-rib-corgi-api",signInAudience:"AzureADMyOrg",identifierUris:[`api://${api}`],api:{requestedAccessTokenVersion:2,oauth2PermissionScopes:[{id:scopeId,value:"access_as_user",isEnabled:true}]},passwordCredentials:[{keyId:scopeId,endDateTime:"2035-01-01T00:00:00Z"}]},
 web:{id:"aacb102c-4dbb-4cbc-b056-58b4fed0e674",appId:web,displayName:"legendary-rib-corgi-web",signInAudience:"AzureADMyOrg",web:{implicitGrantSettings:{enableAccessTokenIssuance:false,enableIdTokenIssuance:false}},spa:{redirectUris:["http://localhost:3000/","http://localhost:3000/auth/redirect/","https://game-test.azurestaticapps.net/","https://game-test.azurestaticapps.net/auth/redirect/"]},requiredResourceAccess:[{resourceAppId:api,resourceAccess:[{id:scopeId,type:"Scope"}]}]},
 principal:{id:principal,appId:api,appOwnerOrganizationId:tenant,accountEnabled:true},settings:{tenant,api,web,endpoint:"https://maze-rescue-ms-b7af62a9.documents.azure.com:443/",client:api,testIds:"[]",secretPresent:true},
 newSwa:{id:swa,sku:{name:"Standard"},location:"eastasia",defaultHostname:"game-test.azurestaticapps.net",repositoryUrl:null},dbThroughput:null,failSwa:false,failWrite:false,
 sites:[...Array.from({length:10},(_,i)=>({id:"free-"+i,name:"free-"+i,sku:"Free",location:"eastasia"})),...Array.from({length:2},(_,i)=>({id:"standard-"+i,name:"standard-"+i,sku:"Standard",location:"eastasia"}))]};}
export function setup(t,state=fixture()){
 const dir=mkdtempSync(join(tmpdir(),"corgi-azure-test-"));mkdirSync(join(dir,"scripts"));mkdirSync(join(dir,".git"));
 for(const f of ["azure-game-resources.ps1","azure-game-apps.ps1","game-cosmos-index.json"])copyFileSync(join("scripts",f),join(dir,"scripts",f));
 const otherDatabasesBefore=state.others.map(d=>({name:d.name,id:d.id,throughput:null,containers:state.otherContainers.map(c=>({name:c.name,id:c.id,partitionKey:c.resource.partitionKey,defaultTtl:c.resource.defaultTtl,indexingPolicy:c.resource.indexingPolicy,uniqueKeyPolicy:null,throughput:{throughput:3400,autoscaleSettings:null}}))}));
 const evidence={plan:"2026-11-04-entra-login-cloud-save-leaderboard",subscription,tenantId:tenant,startedAt:"2026-11-04T00:00:00Z",accountBefore:state.account,otherDatabasesBefore,databaseId:db,containerId:container,swaId:state.swa?swa:null};
 writeFileSync(join(dir,".git/azure-game-resources.json"),JSON.stringify(evidence));
 writeFileSync(join(dir,".git/azure-game-apps.json"),JSON.stringify({tenantId:tenant,subscription,scopeId,api:{id:state.api.id,appId:api},web:{id:state.web.id,appId:web},apiPrincipal:{id:principal,appId:api},webPrincipal:{id:"11223344-1122-4122-8122-112233445566",appId:web}}));
 t.after(()=>{assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&dir.includes("corgi-azure-test-"));rmSync(dir,{recursive:true,force:true});});return dir;
}
export function run(dir,state,mode="Create",kind="resources",location="eastasia"){
 const f=join(dir,"fixture.json");writeFileSync(f,JSON.stringify(state));
 const args=["-NoProfile","-ExecutionPolicy","Bypass","-File",resolve(`scripts/azure-game-${kind}.mock.ps1`),"-FixturePath",f,"-ScriptPath",join(dir,`scripts/azure-game-${kind}.ps1`),"-Mode",mode];
 if(kind==="resources")args.push("-Tenant",tenant,"-Principal",principal,"-Location",location);
 const result=spawnSync("powershell.exe",args,{encoding:"utf8",timeout:30000,windowsHide:true});
 const data=JSON.parse(readFileSync(f+".result","utf8"));return {...result,...data};
}
export const writes=r=>r.trace.filter(a=>a.some(x=>["create","update","delete","patch","post","set"].includes(x)));
