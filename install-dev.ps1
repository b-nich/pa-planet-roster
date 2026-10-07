# Copies the client mod into PA's local mods folder so it shows up under
# Community Mods > Installed. Re-run after every edit (PA's virtual filesystem
# does not follow junctions or symlinks, so a real copy is required).
$ErrorActionPreference = 'Stop'

$identifier = 'com.pa.bteam.planetroster'
$source = Join-Path $PSScriptRoot "client\$identifier"
$target = Join-Path $env:LOCALAPPDATA "Uber Entertainment\Planetary Annihilation\mods\$identifier"

if (-not (Test-Path $source)) { throw "Mod source not found: $source" }
$parent = Split-Path $target -Parent
if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }

robocopy $source $target /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-Host "Copied $source -> $target"
Write-Host "In game: Community Mods > Installed > enable 'Planet Roster'. Return to the main menu or restart PA after each re-run."
exit 0   # robocopy leaves a non-zero "files copied" code in $LASTEXITCODE
