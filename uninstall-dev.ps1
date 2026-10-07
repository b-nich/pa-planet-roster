$ErrorActionPreference = 'Stop'
$target = Join-Path $env:LOCALAPPDATA 'Uber Entertainment\Planetary Annihilation\mods\com.pa.bteam.planetroster'
if (Test-Path $target) {
    Remove-Item $target -Recurse -Force
    Write-Host "Removed $target"
} else {
    Write-Host "Nothing to remove at $target"
}
