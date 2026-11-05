# Test-only command port. This file never calls the installed Azure CLI.
param([string]$FixturePath,[string]$ScriptPath,[string]$Mode,[string]$Tenant,[string]$Principal,[string]$Location,[switch]$AppMode)
$ErrorActionPreference='Stop'
$global:fixture=Get-Content -LiteralPath $FixturePath -Raw -Encoding UTF8 | ConvertFrom-Json
$global:trace=@()
function Option([string[]]$a,[string]$key) { $i=[Array]::IndexOf($a,$key); if($i -ge 0){return $a[$i+1]}; return '' }
function Reply($value){return ConvertTo-Json -InputObject $value -Depth 80 -Compress}
function global:az {
 $a=@($args);$global:trace+=,@($a);$global:LASTEXITCODE=0
 if((Option $a '--subscription') -ne 'b7af62a9-9a10-4deb-95fa-1690f7bbd33d'){throw 'Missing target subscription'}
 $key=($a -join ' ')
 if($key -match '^account show '){return Reply $fixture.login}
 if($key -match '^cosmosdb show '){return Reply $fixture.account}
 if($key -match '^provider show '){return Reply $fixture.regions}
 if($key -match '^staticwebapp list '){return Reply @($fixture.sites)}
 if($key -match '^rest ' -and (Option $a '--method') -eq 'patch'){
  if($fixture.failWrite){$global:LASTEXITCODE=1;return 'Forbidden SECRET_SHOULD_NOT_PRINT'}
  if((Option $a '--url') -notmatch '/applications/aacb102c-4dbb-4cbc-b056-58b4fed0e674$'){throw 'Unexpected app write'}
  $body=Get-Content -LiteralPath ((Option $a '--body').TrimStart('@')) -Raw | ConvertFrom-Json
  $fixture.web.spa.redirectUris=$body.spa.redirectUris;return '{}'
 }
 if($key -match '^rest ' -and (Option $a '--url') -eq 'https://graph.microsoft.com/v1.0/applications'){if($key -match 'legendary-rib-corgi-api'){return Reply @($fixture.api)};return Reply @($fixture.web)}
 if($key -match '^rest ' -and (Option $a '--url') -match '/servicePrincipals/'){return Reply $fixture.principal}
 if($key -match '^cosmosdb sql database list '){$list=@($fixture.others);if($fixture.db){$list+=@($fixture.db)};return Reply $list}
 if($key -match '^cosmosdb sql container list '){if((Option $a '-d') -eq 'legendary-rib-corgi'){if($fixture.container){return Reply @($fixture.container)};return '[]'};return Reply @($fixture.otherContainers)}
 if($key -match '^cosmosdb sql database exists '){return Reply ([bool]$fixture.db)}
 if($key -match '^cosmosdb sql container exists '){return Reply ([bool]$fixture.container)}
 if($key -match '^cosmosdb sql (database|container) throughput show '){
  if((Option $a '-n') -eq 'scores'){return '{"resource":{"throughput":3400}}'}
  if((Option $a '-n') -eq 'game-data' -and $fixture.container){return '{"resource":{"throughput":400}}'}
  if((Option $a '-n') -eq 'legendary-rib-corgi' -and $fixture.dbThroughput){return Reply @{resource=@{throughput=$fixture.dbThroughput}}}
  $global:LASTEXITCODE=3;return 'ERROR: (NotFound) No dedicated throughput resource'
 }
 if($key -match '^cosmosdb sql role assignment list '){return Reply @($fixture.roles)}
 if($key -match '^staticwebapp show '){if($fixture.swa){if((Option $a '--query') -eq '{id:id,host:defaultHostname,sku:sku.name}'){return Reply @{id=$fixture.swa.id;host=$fixture.swa.defaultHostname;sku=$fixture.swa.sku.name}};return Reply $fixture.swa};$global:LASTEXITCODE=3;return 'ERROR: (ResourceNotFound) no SWA'}
 if($key -match '^staticwebapp create '){if((Option $a '--sku') -ne 'Standard'){throw 'Only Standard is allowed'};if($fixture.failSwa){$global:LASTEXITCODE=1;return 'ERROR: too many static sites with SKU: Standard SECRET_SHOULD_NOT_PRINT'};$fixture.swa=$fixture.newSwa;return Reply $fixture.swa}
 if($key -match '^staticwebapp appsettings list '){return Reply $fixture.settings}
 if($key -match '^staticwebapp appsettings set '){
  if($fixture.failWrite){$global:LASTEXITCODE=1;return 'Forbidden SECRET_SHOULD_NOT_PRINT'}
  $map=@{GAME_TENANT_ID='tenant';GAME_API_CLIENT_ID='api';GAME_WEB_CLIENT_ID='web';GAME_COSMOS_CLIENT_ID='client';GAME_COSMOS_ENDPOINT='endpoint';GAME_TEST_OBJECT_IDS='testIds'}
  foreach($arg in $a){if($arg -match '^(GAME_[A-Z_]+)=(.*)$'){if(!$map.ContainsKey($Matches[1])){throw 'Unexpected setting'};$fixture.settings.($map[$Matches[1]])=$Matches[2]}}
  return '6'
 }
 throw 'Unexpected mock command; real Azure CLI is never called'
}
try { if($AppMode){ & $ScriptPath -Mode $Mode }else{ & $ScriptPath -Mode $Mode -TenantId $Tenant -ApiServicePrincipalObjectId $Principal -SwaLocation $Location } }
finally { [IO.File]::WriteAllText(($FixturePath+'.result'),(Reply @{fixture=$fixture;trace=@($trace)})) }
