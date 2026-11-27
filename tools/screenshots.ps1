# Capture the README screenshots with the scripted inputs (needs the Editor
# build and ffmpeg). Run from anywhere:
#
#   powershell -ExecutionPolicy Bypass -File tools\screenshots.ps1
param(
    [string[]]$Times = @("1.5", "15.5", "11")
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$tmp = Join-Path $env:TEMP "shmup8-screenshots"
& .\out\cat-debug.exe --capture --out $tmp @Times | Where-Object { $_ -match '^t=' } | Write-Host
New-Item -ItemType Directory -Force screenshots | Out-Null
$i = 1
foreach ($t in $Times) {
    $png = Join-Path $tmp ("t{0:000.00}.png" -f [double]$t)
    & ffmpeg -y -loglevel error -i $png -q:v 3 "screenshots\shot$i.jpg"
    $i++
}
Get-ChildItem screenshots | Format-Table Name, Length
