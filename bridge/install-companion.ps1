$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$homePath = Join-Path $root '.local/dsh-home'
$presetPath = Join-Path $homePath '.agent-presets/companion'
New-Item -ItemType Directory -Force $presetPath | Out-Null
Copy-Item (Join-Path $root 'presets/companion/*') $presetPath -Force
Write-Host 'Installed preset: 小雅 · 陪伴聊天'
Write-Host 'Select it when creating a new DSH session. Existing sessions keep their previous preset.'
Write-Host 'To make it the default, set agent-presets.default to companion in the DSH settings.'
