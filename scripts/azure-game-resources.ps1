[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'Create', 'Verify')][string]$Mode = 'Inspect',
    [Parameter(Mandatory = $true)][string]$TenantId,
    [string]$ApiServicePrincipalObjectId,
    [string]$SwaLocation
)
$ErrorActionPreference = 'Stop'
$subscription = 'b7af62a9-9a10-4deb-95fa-1690f7bbd33d'
$group = 'grill-me-edu'
$account = 'maze-rescue-ms-b7af62a9'
$database = 'legendary-rib-corgi'
$container = 'game-data'
$accountId = "/subscriptions/$subscription/resourceGroups/$group/providers/Microsoft.DocumentDB/databaseAccounts/$account"
$databaseId = "$accountId/sqlDatabases/$database"
$containerId = "$databaseId/containers/$container"
$scope = "$accountId/dbs/$database"
$role = "$accountId/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
$swaId = "/subscriptions/$subscription/resourceGroups/$group/providers/Microsoft.Web/staticSites/$database"
$accountArgs = @('-g', $group, '-a', $account)
$databaseArgs = $accountArgs + @('-d', $database)
$repo = Split-Path $PSScriptRoot -Parent
$evidencePath = Join-Path $repo '.git/azure-game-resources.json'
$indexPath = Join-Path $PSScriptRoot 'game-cosmos-index.json'
$desiredIndex = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8 | ConvertFrom-Json

function Assert-Condition([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Guid([string]$Value, [string]$Label) {
    $parsed = [guid]::Empty
    Assert-Condition ([guid]::TryParse($Value, [ref]$parsed) -and $parsed -ne [guid]::Empty) "$Label must be a real UUID."
}
function Invoke-Azure([string[]]$Arguments, [switch]$AllowNotFound) {
    # Arrays only. No Invoke-Expression, account keys, secret arguments, or shell-built commands.
    $all = $Arguments + @('--subscription', $subscription, '--only-show-errors', '-o', 'json')
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $command = Get-Command az -ErrorAction Stop
        if ($command.CommandType -eq 'Application' -and $command.Source.EndsWith('.cmd')) {
            # The MSI az.cmd shim reparses parentheses/& through cmd.exe. Invoke its
            # bundled Python directly so Graph filters remain literal arguments.
            $python = Join-Path (Split-Path $command.Source -Parent) '../python.exe'
            Assert-Condition (Test-Path -LiteralPath $python) 'Azure CLI Python executable not found.'
            $raw = & $python -IBm azure.cli @all 2>&1
        } else { $raw = & az @all 2>&1 }
        $exitCode = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $savedPreference }
    $body = ($raw | ForEach-Object { [string]$_ }) -join "`n"
    if ($exitCode -ne 0) {
        if ($AllowNotFound -and $body -match '(?i)(ResourceNotFound|\(NotFound\)|\b404\b|throughput is not configured)') { return $null }
        $category = if ($body -match '(?i)too many static sites|static.*quota') { 'SWA site quota reached; no deletion or quota change attempted' }
            elseif ($body -match '(?i)quota|throughput.*limit|capacity') { 'quota/throughput limit; no cap change attempted' }
            elseif ($body -match '(?i)AuthorizationFailed|Forbidden|permission') { 'permission denied' }
            elseif ($body -match '(?i)subscription.*not found|login|AADSTS') { 'target subscription/tenant login required' } else { 'Azure request failed' }
        throw "$category ($($Arguments[0..([Math]::Min(2, $Arguments.Length - 1))] -join ' ')); inspect Azure Portal."
    }
    if ([string]::IsNullOrWhiteSpace($body)) { return $null }
    $parsed = ConvertFrom-Json -InputObject $body
    return $parsed
}
function Json($Value) { return ConvertTo-Json -InputObject $Value -Depth 80 -Compress }
function Read-Throughput([string]$Db, [string]$Collection) {
    $command = @('cosmosdb', 'sql')
    if ($Collection) { $command += @('container', 'throughput', 'show') + $accountArgs + @('-d', $Db, '-n', $Collection) }
    else { $command += @('database', 'throughput', 'show') + $accountArgs + @('-n', $Db) }
    $value = Invoke-Azure $command -AllowNotFound
    if ($null -eq $value) { return $null }
    return [ordered]@{ throughput = $value.resource.throughput; autoscaleSettings = $value.resource.autoscaleSettings }
}
function Read-Account {
    $query = '{id:id,kind:kind,enableFreeTier:enableFreeTier,locations:locations,capabilities:capabilities,publicNetworkAccess:publicNetworkAccess,capacity:capacity,ipRules:ipRules,virtualNetworkRules:virtualNetworkRules,isVirtualNetworkFilterEnabled:isVirtualNetworkFilterEnabled,disableLocalAuth:disableLocalAuth,disableKeyBasedMetadataWriteAccess:disableKeyBasedMetadataWriteAccess,enableAutomaticFailover:enableAutomaticFailover,enableMultipleWriteLocations:enableMultipleWriteLocations,networkAclBypass:networkAclBypass,networkAclBypassResourceIds:networkAclBypassResourceIds,consistencyPolicy:consistencyPolicy,backupPolicy:backupPolicy}'
    return Invoke-Azure @('cosmosdb', 'show', '-g', $group, '-n', $account, '--query', $query)
}
function Read-OtherDatabases {
    # ARM metadata only: never query other players' documents or use their keys.
    $items = @()
    $dbs = @(Invoke-Azure (@('cosmosdb', 'sql', 'database', 'list') + $accountArgs))
    foreach ($db in ($dbs | Where-Object { $_.name -ne $database } | Sort-Object name)) {
        $collections = @()
        foreach ($c in (@(Invoke-Azure (@('cosmosdb', 'sql', 'container', 'list') + $accountArgs + @('-d', $db.name))) | Sort-Object name)) {
            $r = $c.resource
            $collections += [ordered]@{ name = $c.name; id = $c.id; partitionKey = $r.partitionKey; defaultTtl = $r.defaultTtl;
                indexingPolicy = $r.indexingPolicy; uniqueKeyPolicy = $r.uniqueKeyPolicy; throughput = (Read-Throughput $db.name $c.name) }
        }
        $items += [ordered]@{ name = $db.name; id = $db.id; throughput = (Read-Throughput $db.name ''); containers = @($collections) }
    }
    return ,$items
}
function Total-Throughput($Items) {
    $total = 0L
    foreach ($db in $Items) {
        foreach ($t in @($db.throughput) + @($db.containers | ForEach-Object { $_.throughput })) {
            if ($null -ne $t) {
                if ($t.autoscaleSettings) { $total += [long]$t.autoscaleSettings.maxThroughput }
                else { $total += [long]$t.throughput }
            }
        }
    }
    return $total
}
function Save-Evidence {
    [System.IO.File]::WriteAllText($evidencePath, (Json $script:evidence), (New-Object System.Text.UTF8Encoding $false))
}
function Assert-Container($Value) {
    Assert-Condition ($Value.id -eq $containerId -and $Value.resource.id -eq $container) 'Container identity mismatch.'
    $r = $Value.resource
    Assert-Condition (@($r.partitionKey.paths).Count -eq 1 -and $r.partitionKey.paths[0] -eq '/playerId' -and $r.partitionKey.kind -eq 'Hash') 'Partition key mismatch.'
    Assert-Condition ($r.defaultTtl -eq -1) 'TTL must be enabled with no default expiry (-1).'
    $p = $r.indexingPolicy
    Assert-Condition ($p.indexingMode -eq 'consistent' -and $p.automatic -eq $true) 'Index mode mismatch.'
    Assert-Condition ((Json @($p.includedPaths.path | Sort-Object)) -eq (Json @($desiredIndex.includedPaths.path | Sort-Object))) 'Included index paths mismatch.'
    Assert-Condition ((Json @($p.excludedPaths.path | Sort-Object)) -eq (Json @($desiredIndex.excludedPaths.path | Sort-Object))) 'Excluded index paths mismatch.'
    Assert-Condition (-not $p.compositeIndexes -and -not $p.spatialIndexes -and -not $p.vectorIndexes) 'Unexpected secondary indexes.'
    Assert-Condition (-not $r.uniqueKeyPolicy.uniqueKeys -and -not $r.clientEncryptionPolicy -and -not $r.vectorEmbeddingPolicy) 'Unexpected container policy.'
    $tp = Read-Throughput $database $container
    Assert-Condition ($tp -and $tp.throughput -eq 400 -and -not $tp.autoscaleSettings) 'Container must have dedicated manual 400 RU/s.'
}
function Read-App([string]$Name) {
    $query = 'value[].{id:id,appId:appId,displayName:displayName,signInAudience:signInAudience,identifierUris:identifierUris,api:api,spa:spa,web:web,requiredResourceAccess:requiredResourceAccess,passwordCredentials:passwordCredentials[].{keyId:keyId,endDateTime:endDateTime}}'
    # `az ad` does not accept --subscription. Explicitly select this subscription's
    # tenant for Graph requests using az rest; never depend on the CLI default tenant.
    $filter = '$filter=displayName eq ' + "'$Name'"
    $apps = @(Invoke-Azure @('rest', '--method', 'get', '--url', 'https://graph.microsoft.com/v1.0/applications', '--url-parameters', $filter,
        '$select=id,appId,displayName,signInAudience,identifierUris,api,spa,web,requiredResourceAccess,passwordCredentials', '--query', $query) | Where-Object { $_.displayName -ceq $Name })
    Assert-Condition ($apps.Count -eq 1) "Exactly one Entra registration named $Name is required; create it in the target tenant."
    Assert-Guid $apps[0].appId 'Application ID'
    Assert-Condition ($apps[0].signInAudience -eq 'AzureADMyOrg') 'Only the target organization is allowed.'
    return $apps[0]
}

Assert-Guid $TenantId 'TenantId'
Assert-Condition ($TenantId -eq '69c1e470-4528-435a-a1ae-de98e0aac738') 'Only the agreed tenant is allowed.'
if (-not $ApiServicePrincipalObjectId) { $ApiServicePrincipalObjectId = 'f02b1a27-859d-4872-8549-99ad95927132' }
Assert-Condition ($ApiServicePrincipalObjectId -eq 'f02b1a27-859d-4872-8549-99ad95927132') 'Only the recorded API principal is allowed.'
$login = Invoke-Azure @('account', 'show', '--query', '{id:id,tenantId:tenantId,state:state}')
Assert-Condition ($login.id -eq $subscription -and $login.tenantId -eq $TenantId -and $login.state -eq 'Enabled') 'Target subscription/tenant mismatch; no writes performed.'
$beforeAccount = Read-Account
Assert-Condition ($beforeAccount.id -eq $accountId -and $beforeAccount.kind -eq 'GlobalDocumentDB') 'The specified NoSQL account was not found.'
Assert-Condition ($beforeAccount.enableFreeTier -eq $true -and -not (@($beforeAccount.capabilities.name) -contains 'EnableServerless')) 'Provisioned throughput with free tier is required.'
Assert-Condition (@($beforeAccount.locations).Count -eq 1 -and $beforeAccount.locations[0].locationName -eq 'Korea Central') 'Account regions differ from the agreed Korea Central configuration.'
Assert-Condition ($beforeAccount.publicNetworkAccess -eq 'Enabled' -and -not $beforeAccount.ipRules -and -not $beforeAccount.isVirtualNetworkFilterEnabled) 'Account network settings differ; no automatic network changes.'
$otherDatabases = Read-OtherDatabases
$otherTotal = Total-Throughput $otherDatabases
$provider = Invoke-Azure @('provider', 'show', '--namespace', 'Microsoft.Web', '--query', 'resourceTypes[?resourceType==`staticSites`].locations')
$supported = @($provider | ForEach-Object { $_ } | ForEach-Object { ([string]$_).Replace(' ', '').ToLowerInvariant() })
if (-not $SwaLocation) {
    if ($supported -contains 'eastasia') { $SwaLocation = 'eastasia' }
    elseif ($supported -contains 'southeastasia') { $SwaLocation = 'southeastasia' }
    else { throw 'No supported East/Southeast Asia SWA API region. Ask the user to choose from provider locations.' }
}
$SwaLocation = $SwaLocation.Replace(' ', '').ToLowerInvariant()
Assert-Condition ($supported -contains $SwaLocation -and $SwaLocation -in @('eastasia', 'southeastasia')) 'Unsupported or unapproved SWA location.'
$script:evidence = $null
if (Test-Path -LiteralPath $evidencePath) {
    $script:evidence = Get-Content -LiteralPath $evidencePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-Condition ($evidence.subscription -eq $subscription -and $evidence.tenantId -eq $TenantId -and $evidence.plan -eq '2026-11-04-entra-login-cloud-save-leaderboard') 'Local creation evidence belongs to another target.'
    Assert-Condition ((Json $evidence.accountBefore) -eq (Json $beforeAccount)) 'Shared account settings changed since preparation. Stop and review.'
    Assert-Condition ((Json $evidence.otherDatabasesBefore) -eq (Json $otherDatabases)) 'Other database metadata changed since preparation. Stop and review.'
}
Assert-Condition ($null -ne $evidence) 'Legacy creation evidence is required; no automatic recreation.'
$dbExists = Invoke-Azure (@('cosmosdb', 'sql', 'database', 'exists') + $accountArgs + @('-n', $database))
$collectionExists = $false
if ($dbExists) {
    Assert-Condition ($evidence -and $evidence.databaseId -eq $databaseId) 'Name collision: existing DB has no creation evidence from this task.'
    Assert-Condition ($null -eq (Read-Throughput $database '')) 'Game database must not have shared throughput.'
    $children = @(Invoke-Azure (@('cosmosdb', 'sql', 'container', 'list') + $databaseArgs))
    Assert-Condition (@($children | Where-Object { $_.name -ne $container }).Count -eq 0) 'Unexpected containers in game DB.'
    $collection = $children | Where-Object { $_.name -eq $container }
    if ($collection) {
        Assert-Condition ($evidence.containerId -eq $containerId) 'Name collision: container has no creation evidence.'
        Assert-Container $collection
        $collectionExists = $true
    }
}
Assert-Condition ($dbExists -and $collectionExists) 'Recorded game DB/container missing; no automatic recreation.'
$sites = @(Invoke-Azure @('staticwebapp', 'list', '--query', '[].{id:id,name:name,sku:sku.name,location:location}'))
$freeSiteCount = @($sites | Where-Object { $_.sku -eq 'Free' }).Count
$standardSiteCount = @($sites | Where-Object { $_.sku -eq 'Standard' }).Count
$swa = Invoke-Azure @('staticwebapp', 'show', '-g', $group, '-n', $database) -AllowNotFound
if ($swa) {
    Assert-Condition ($evidence -and $evidence.swaId -eq $swaId) 'Name collision: SWA has no creation evidence.'
    Assert-Condition ($swa.id -eq $swaId -and $swa.sku.name -eq 'Standard' -and $swa.location.Replace(' ', '').ToLowerInvariant() -eq $SwaLocation) 'SWA identity/SKU/location mismatch.'
    Assert-Condition (-not $swa.repositoryUrl) 'Existing source integration would allow unintended deployment.'
}
Assert-Condition ($swa -or $standardSiteCount -lt 100) 'SWA Standard site quota reached; no deletion or quota change attempted.'
Assert-Guid $ApiServicePrincipalObjectId 'ApiServicePrincipalObjectId'
$apiApp = Read-App 'legendary-rib-corgi-api'
$webApp = Read-App 'legendary-rib-corgi-web'
Assert-Condition ($apiApp.appId -eq 'a2e3f4fa-56e5-4ab5-ba41-43cb974b8722' -and $apiApp.id -eq 'bd092a7c-ad3c-4fe4-8475-7ec70769be73' -and $webApp.appId -eq 'e467e8bc-c900-4d08-88be-7f0a5fce2474' -and $webApp.id -eq 'aacb102c-4dbb-4cbc-b056-58b4fed0e674') 'Recorded app identity mismatch.'
Assert-Condition ($apiApp.appId -ne $webApp.appId -and $apiApp.api.requestedAccessTokenVersion -eq 2) 'Separate apps and API access token version 2 are required.'
Assert-Condition (@($apiApp.identifierUris) -contains "api://$($apiApp.appId)") 'API application ID URI mismatch.'
$scopes = @($apiApp.api.oauth2PermissionScopes | Where-Object { $_.value -eq 'access_as_user' -and $_.isEnabled })
Assert-Condition ($scopes.Count -eq 1) 'Enabled access_as_user scope required.'
Assert-Guid $scopes[0].id 'Scope ID'
Assert-Condition ($scopes[0].id -eq 'd36060b6-6582-45d3-a95f-5b1b8b742883') 'Recorded scope identity mismatch.'
$grants = @($webApp.requiredResourceAccess | Where-Object { $_.resourceAppId -eq $apiApp.appId } | ForEach-Object { $_.resourceAccess } | Where-Object { $_.id -eq $scopes[0].id -and $_.type -eq 'Scope' })
Assert-Condition ($grants.Count -eq 1) 'Web app delegated API permission missing.'
Assert-Condition (-not $webApp.web.implicitGrantSettings.enableAccessTokenIssuance -and -not $webApp.web.implicitGrantSettings.enableIdTokenIssuance) 'Implicit grant must be disabled.'
$principal = Invoke-Azure @('rest', '--method', 'get', '--url', "https://graph.microsoft.com/v1.0/servicePrincipals/$ApiServicePrincipalObjectId", '--url-parameters', '$select=id,appId,appOwnerOrganizationId,accountEnabled')
Assert-Condition ($principal.id -eq $ApiServicePrincipalObjectId -and $principal.appId -eq $apiApp.appId -and $principal.appOwnerOrganizationId -eq $TenantId -and $principal.accountEnabled) 'API service principal does not match the app/tenant.'
$assignments = @(Invoke-Azure (@('cosmosdb', 'sql', 'role', 'assignment', 'list') + $accountArgs))
$appRoles = @($assignments | Where-Object { $_.principalId -eq $ApiServicePrincipalObjectId })
foreach ($assignment in $appRoles) { Assert-Condition ($assignment.scope -eq $scope -or $assignment.scope.StartsWith("$scope/colls/")) 'API principal already has access outside this game DB. Review manually.' }
$matching = @($appRoles | Where-Object { $_.scope -eq $scope -and $_.roleDefinitionId -eq $role })
Assert-Condition ($matching.Count -eq 1) 'Recorded DB-scoped data role missing or duplicated; no automatic grants.'
if ($Mode -eq 'Inspect') {
    [ordered]@{ mode = $Mode; subscription = $subscription; tenantId = $TenantId; account = $accountId; otherDatabaseCount = @($otherDatabases).Count;
        otherThroughputRU = $otherTotal; reportedPreviousTotalRU = 3400; accountThroughputLimit = $beforeAccount.capacity.totalThroughputLimit;
        createDatabase = $false; createContainer = $false; reusedDatabase = $true; reusedContainer = $true; additionalRU = 0;
        freeSiteCount = $freeSiteCount; standardSiteCount = $standardSiteCount; standardSiteLimit = 100;
        createSwa = (-not $swa); swaLocation = $SwaLocation; sku = 'Standard'; scope = $scope } | ConvertTo-Json -Depth 8
    return
}
if ($Mode -eq 'Create') {
    if (-not $swa) {
        Assert-Condition ($null -eq (Invoke-Azure @('staticwebapp', 'show', '-g', $group, '-n', $database) -AllowNotFound)) 'SWA appeared during preflight; stopping.'
        $swa = Invoke-Azure @('staticwebapp', 'create', '-g', $group, '-n', $database, '--sku', 'Standard', '--location', $SwaLocation)
        Assert-Condition ($swa.id -eq $swaId -and $swa.sku.name -eq 'Standard' -and $swa.location.Replace(' ', '').ToLowerInvariant() -eq $SwaLocation) 'Unexpected created SWA.'
        $evidence.swaId = $swa.id
        $evidence | Add-Member -NotePropertyName standardRelease -NotePropertyValue ([ordered]@{ plan = '2026-11-05-azure-standard-release'; sku = 'Standard'; swaId = $swa.id; createdAt = [DateTime]::UtcNow.ToString('o') }) -Force
        Save-Evidence
    }
} else {
    Assert-Condition ($dbExists -and $collectionExists -and $swa -and $matching.Count -gt 0) 'Game resources or DB-scoped role are missing.'
    Assert-Condition ($swa.defaultHostname -match '^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:[0-9]+\.)?azurestaticapps\.net$') 'Unexpected SWA hostname.'
    foreach ($uri in @('http://localhost:3000/', 'http://localhost:3000/auth/redirect/', "https://$($swa.defaultHostname)/", "https://$($swa.defaultHostname)/auth/redirect/")) {
        Assert-Condition (@($webApp.spa.redirectUris) -contains $uri) "Required SPA redirect URI missing: $uri"
    }
    $activeSecrets = @($apiApp.passwordCredentials | Where-Object { [DateTime]$_.endDateTime -gt [DateTime]::UtcNow })
    Assert-Condition ($activeSecrets.Count -gt 0) 'API app has no unexpired credential metadata.'
    # Read public settings and presence only. Never return the secret value from az.
    $settingsQuery = 'properties.{tenant:GAME_TENANT_ID,api:GAME_API_CLIENT_ID,web:GAME_WEB_CLIENT_ID,endpoint:GAME_COSMOS_ENDPOINT,client:GAME_COSMOS_CLIENT_ID,testIds:GAME_TEST_OBJECT_IDS,secretPresent:length(GAME_COSMOS_CLIENT_SECRET || `""`) > `0`}'
    $settings = Invoke-Azure @('staticwebapp', 'appsettings', 'list', '-g', $group, '-n', $database, '--query', $settingsQuery)
    Assert-Condition ($settings.tenant -eq $TenantId -and $settings.api -eq $apiApp.appId -and $settings.web -eq $webApp.appId -and $settings.client -eq $apiApp.appId -and $settings.secretPresent) 'SWA server settings are missing or incorrect.'
    Assert-Condition ($settings.endpoint -in @("https://$account.documents.azure.com:443/", "https://$account.documents.azure.com/")) 'Cosmos endpoint mismatch.'
    Assert-Condition ($settings.testIds -match '^\s*\[') 'Test allowlist must be a JSON array; use [] until explicitly selected.'
    $parsedIds = ConvertFrom-Json -InputObject $settings.testIds
    $testIds = @($parsedIds)
    Assert-Condition ($testIds.Count -le 100) 'Too many test user IDs.'
    foreach ($oid in $testIds) { Assert-Guid $oid 'Test user object ID' }
}
Assert-Condition ((Json (Read-Account)) -eq (Json $evidence.accountBefore)) 'Shared account settings changed during execution; review without automatic rollback.'
Assert-Condition ((Json (Read-OtherDatabases)) -eq (Json $evidence.otherDatabasesBefore)) 'Other database metadata changed during execution; review without automatic rollback.'
[ordered]@{ mode = $Mode; subscription = $subscription; tenantId = $TenantId; databaseId = $databaseId; containerId = $containerId;
    throughputRU = 400; partitionKey = '/playerId'; defaultTtl = -1; apiClientId = $apiApp.appId; webClientId = $webApp.appId;
    apiServicePrincipalObjectId = $ApiServicePrincipalObjectId; apiScopeId = $scopes[0].id; roleScope = $scope;
    swaId = $swaId; swaHostname = $swa.defaultHostname; swaLocation = $SwaLocation; sku = 'Standard'; sharedResourcesPreserved = $true;
    next = $(if ($Mode -eq 'Create') { 'Register SPA root + /auth/redirect/ URIs, configure SWA server settings directly, then run Verify.' } else { 'Resource settings verified. Actual credential use and login still require release validation.' }) } | ConvertTo-Json -Depth 8
