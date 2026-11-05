# Reuse the strict fake Azure port; unknown requests never reach the real CLI.
param([string]$FixturePath,[string]$ScriptPath,[string]$Mode)
& (Join-Path $PSScriptRoot 'azure-game-resources.mock.ps1') -FixturePath $FixturePath -ScriptPath $ScriptPath -Mode $Mode -AppMode
