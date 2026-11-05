# Resume only: preserve registered apps and credentials, finalize public settings.
[CmdletBinding()]
param([ValidateSet('Create', 'Finalize')][string]$Mode = 'Create')
$ErrorActionPreference = 'Stop'
$subscription = 'b7af62a9-9a10-4deb-95fa-1690f7bbd33d'
$tenant = '69c1e470-4528-435a-a1ae-de98e0aac738'
$repo = Split-Path $PSScriptRoot -Parent
$statePath = Join-Path $repo '.git/azure-game-apps.json'
$evidencePath = Join-Path $repo '.git/azure-game-resources.json'
$bodyPath = Join-Path $repo '.git/azure-game-app-request.json'
$apiId = 'a2e3f4fa-56e5-4ab5-ba41-43cb974b8722'
$webId = 'e467e8bc-c900-4d08-88be-7f0a5fce2474'
$scopeId = 'd36060b6-6582-45d3-a95f-5b1b8b742883'
function Assert-Condition([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Azure([string[]]$Arguments) {
    $all = $Arguments + @('--subscription', $subscription, '--only-show-errors', '-o', 'json')
    $saved = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
        $cli = Get-Command az -ErrorAction Stop
        if ($cli.CommandType -eq 'Application' -and $cli.Source.EndsWith('.cmd')) {
            $python = Join-Path (Split-Path $cli.Source -Parent) '../python.exe'
            if (!(Test-Path -LiteralPath $python)) { throw 'Azure CLI bundled Python not found.' }
            $raw = & $python -IBm azure.cli @all 2>&1
        } else { $raw = & az @all 2>&1 }
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $saved }
    if ($code -ne 0) { throw 'Azure operation failed. Review permissions/login; no rollback or tenant fallback.' }
    $body = ($raw | ForEach-Object { [string]$_ }) -join "`n"
    if ($body) { try { return ConvertFrom-Json $body } catch { throw 'Invalid Azure response.' } }
}
function Graph([string]$Method, [string]$Path, $Body) {
    $a = @('rest', '--method', $Method, '--url', "https://graph.microsoft.com/v1.0/$Path")
    if ($null -ne $Body) {
        [IO.File]::WriteAllText($bodyPath, ($Body | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
        $a += @('--body', "@$bodyPath", '--headers', 'Content-Type=application/json')
    }
    return Azure $a
}
function Find-App([string]$Name) {
    return Azure @('rest','--method','get','--url','https://graph.microsoft.com/v1.0/applications','--url-parameters',
        ('$filter=displayName eq ' + "'$Name'"), '$select=id,appId,displayName,signInAudience,api,identifierUris,spa,web,requiredResourceAccess', '--query','value')
}
Assert-Condition ($Mode -eq 'Finalize') 'Registrations already exist. Create is disabled; use Finalize after Standard setup.'
$account = Azure @('account','show','--query','{id:id,tenantId:tenantId,state:state}')
Assert-Condition ($account.id -eq $subscription -and $account.tenantId -eq $tenant -and $account.state -eq 'Enabled') 'Subscription/tenant mismatch; no writes.'
Assert-Condition ((Test-Path -LiteralPath $statePath) -and (Test-Path -LiteralPath $evidencePath)) 'Creation evidence is required.'
$state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
$evidence = Get-Content -LiteralPath $evidencePath -Raw -Encoding UTF8 | ConvertFrom-Json
Assert-Condition ($state.tenantId -eq $tenant -and $state.subscription -eq $subscription -and $state.scopeId -eq $scopeId) 'App evidence target/scope mismatch.'
Assert-Condition ($state.api.appId -eq $apiId -and $state.api.id -eq 'bd092a7c-ad3c-4fe4-8475-7ec70769be73' -and $state.web.appId -eq $webId -and $state.web.id -eq 'aacb102c-4dbb-4cbc-b056-58b4fed0e674' -and $state.apiPrincipal.id -eq 'f02b1a27-859d-4872-8549-99ad95927132' -and $state.apiPrincipal.appId -eq $apiId) 'Recorded app/principal identity mismatch.'
$apps = @{}
foreach ($kind in @('api','web')) {
    $found = @(Find-App "legendary-rib-corgi-$kind")
    Assert-Condition ($found.Count -eq 1 -and $found[0].id -eq $state.$kind.id -and $found[0].appId -eq $state.$kind.appId -and $found[0].signInAudience -eq 'AzureADMyOrg') 'App identity changed.'
    $apps[$kind] = $found[0]
}
$api = $apps.api; $web = $apps.web
Assert-Condition ($api.api.requestedAccessTokenVersion -eq 2 -and @($api.identifierUris) -contains "api://$apiId") 'API token version or URI mismatch.'
$scopes = @($api.api.oauth2PermissionScopes | Where-Object { $_.id -eq $scopeId -and $_.value -eq 'access_as_user' -and $_.isEnabled })
Assert-Condition ($scopes.Count -eq 1) 'API scope mismatch.'
$grants = @($web.requiredResourceAccess | Where-Object { $_.resourceAppId -eq $apiId } | ForEach-Object { $_.resourceAccess } | Where-Object { $_.id -eq $scopeId -and $_.type -eq 'Scope' })
Assert-Condition ($grants.Count -eq 1 -and !$web.web.implicitGrantSettings.enableAccessTokenIssuance -and !$web.web.implicitGrantSettings.enableIdTokenIssuance) 'Web delegated permission or implicit grant mismatch.'
$sp = Graph 'get' "servicePrincipals/$($state.apiPrincipal.id)?`$select=id,appId,appOwnerOrganizationId,accountEnabled" $null
Assert-Condition ($sp.id -eq $state.apiPrincipal.id -and $sp.appId -eq $apiId -and $sp.appOwnerOrganizationId -eq $tenant -and $sp.accountEnabled) 'API principal mismatch.'
$swa = Azure @('staticwebapp','show','-g','grill-me-edu','-n','legendary-rib-corgi','--query','{id:id,host:defaultHostname,sku:sku.name}')
$expected = "/subscriptions/$subscription/resourceGroups/grill-me-edu/providers/Microsoft.Web/staticSites/legendary-rib-corgi"
Assert-Condition ($evidence.subscription -eq $subscription -and $evidence.tenantId -eq $tenant -and $evidence.plan -eq '2026-11-04-entra-login-cloud-save-leaderboard' -and $evidence.swaId -eq $expected) 'SWA creation evidence mismatch.'
Assert-Condition ($swa.id -eq $expected -and $swa.sku -eq 'Standard' -and $swa.host -match '^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:[0-9]+\.)?azurestaticapps\.net$') 'Unexpected SWA target.'
# All reads and validation precede the first write. Never select secret values.
$query = 'properties.{tenant:GAME_TENANT_ID,api:GAME_API_CLIENT_ID,web:GAME_WEB_CLIENT_ID,client:GAME_COSMOS_CLIENT_ID,endpoint:GAME_COSMOS_ENDPOINT,testIds:GAME_TEST_OBJECT_IDS}'
$existing = Azure @('staticwebapp','appsettings','list','-g','grill-me-edu','-n','legendary-rib-corgi','--query',$query)
if ($null -ne $existing.testIds) {
    try { $parsed = ConvertFrom-Json -InputObject $existing.testIds } catch { throw 'Invalid test allowlist JSON.' }
    Assert-Condition ($existing.testIds.Trim().StartsWith('[') -and $existing.testIds.Trim().EndsWith(']') -and @($parsed).Count -le 100) 'Invalid test allowlist array.'
    foreach ($id in @($parsed)) { $guid = [guid]::Empty; Assert-Condition ([guid]::TryParse([string]$id,[ref]$guid) -and $guid -ne [guid]::Empty) 'Invalid test account ID.' }
}
$requiredUris = @('http://localhost:3000/','http://localhost:3000/auth/redirect/',"https://$($swa.host)/","https://$($swa.host)/auth/redirect/")
$uris = @(@($web.spa.redirectUris) + $requiredUris | Sort-Object -Unique)
$changedUris = @($uris | Where-Object { @($web.spa.redirectUris) -notcontains $_ }).Count -gt 0
if ($changedUris) { $null = Graph 'patch' "applications/$($state.web.id)" @{spa=@{redirectUris=$uris}} }
$desired = [ordered]@{ tenant=@('GAME_TENANT_ID',$tenant); api=@('GAME_API_CLIENT_ID',$apiId); web=@('GAME_WEB_CLIENT_ID',$webId); client=@('GAME_COSMOS_CLIENT_ID',$apiId); endpoint=@('GAME_COSMOS_ENDPOINT','https://maze-rescue-ms-b7af62a9.documents.azure.com:443/') }
$settings = @()
foreach ($key in $desired.Keys) { if ($existing.$key -cne $desired[$key][1]) { $settings += ($desired[$key][0] + '=' + $desired[$key][1]) } }
if ($null -eq $existing.testIds) { $settings += 'GAME_TEST_OBJECT_IDS=[]' }
if ($settings.Count -gt 0) { $null = Azure (@('staticwebapp','appsettings','set','-g','grill-me-edu','-n','legendary-rib-corgi','--setting-names') + $settings + @('--query','length(keys(properties))')) }
[ordered]@{ tenantId=$tenant; subscription=$subscription; apiClientId=$apiId; webClientId=$webId; swaId=$expected; swaHostname=$swa.host; sku='Standard'; addedRedirectUris=$changedUris; publicSettingsChanged=$settings.Count } | ConvertTo-Json
