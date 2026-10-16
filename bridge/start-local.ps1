param(
    [string]$Harness = (Join-Path (Split-Path $PSScriptRoot -Parent) '../deepseek-harness'),
    [switch]$BridgeOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$local = Join-Path $root '.local'
$python = Join-Path $root '.venv/Scripts/python.exe'
if (-not (Test-Path $python)) { throw 'Missing .venv. See docs/LOCAL_SETUP.md.' }
if (-not (Test-Path (Join-Path $PSScriptRoot 'bridge-config.json'))) { throw 'Missing bridge/bridge-config.json.' }
New-Item -ItemType Directory -Force $local | Out-Null
try { $health = Invoke-RestMethod 'http://127.0.0.1:8765/api/health' -TimeoutSec 2 } catch { $health = $null }
if ($null -eq $health) {
    Start-Process -FilePath $python -ArgumentList '-m','uvicorn','voice_bridge:app','--host','127.0.0.1','--port','8765' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $local 'bridge.stdout.log') -RedirectStandardError (Join-Path $local 'bridge.stderr.log')
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8765/api/health' -TimeoutSec 2
            if ($health.status -eq 'ok') { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) { throw "Bridge did not become ready. Check $local/bridge.stderr.log." }
} elseif ($health.status -ne 'ok') { throw 'Port 8765 did not return a healthy voice bridge.' }
Write-Host 'Voice bridge: http://127.0.0.1:8765/docs (model readiness requires STT/TTS tests)'
if ($BridgeOnly) { return }
$nodeDir = Join-Path $local 'runtime/node_modules/node/bin'
if (Test-Path (Join-Path $nodeDir 'node.exe')) { $env:PATH = "$nodeDir;$env:PATH" }
$env:DSH_HOME = Join-Path $local 'dsh-home'
Push-Location $Harness
try {
    & node --import tsx/esm apps/cli/src/bin.ts web --no-open
    if ($LASTEXITCODE -ne 0) { throw "DSH exited with code $LASTEXITCODE" }
} finally { Pop-Location }
