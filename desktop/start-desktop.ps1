param([switch]$SelfTest)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $PSScriptRoot 'node_modules/electron/dist/electron.exe'
if (-not (Test-Path $exe)) { throw 'Run npm ci in desktop first.' }
try { $null = Invoke-WebRequest 'http://127.0.0.1:3080/' -TimeoutSec 3 } catch { if ($null -eq $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw 'Start bridge/start-local.ps1 first (DSH port 3080 is unavailable).' } }
$argsForApp = @('"' + $PSScriptRoot + '"')
if ($SelfTest) { $argsForApp += '--self-test' }
Start-Process -FilePath $exe -ArgumentList $argsForApp -WorkingDirectory $PSScriptRoot
