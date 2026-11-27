# Build the snapshot (fast, Crinkler's instant mode: enough to follow the size)
# and the editor, report the size, and run the self-test (the minified shaders
# must compile and behave like the editor's).
#
#   powershell -ExecutionPolicy Bypass -File tools\check.ps1 [-Config Release] [-Log]
#
# -Log appends "date commit bytes subject" to tools\sizes.txt (once per commit).
param(
    [string]$Config = "Snapshot",
    [switch]$Log
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$msbuild = & $vswhere -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" | Select-Object -First 1
if (-not $msbuild) { throw "MSBuild not found" }

function Build([string]$configuration) {
    Write-Host "Building $configuration..."
    & $msbuild engine8.sln "-p:Configuration=$configuration" -p:Platform=Win32 -v:quiet -nologo
    if ($LASTEXITCODE -ne 0) { throw "$configuration build failed" }
}

# Snapshot and Release regenerate the minified shaders (src\shaders\shaders.inl).
Build $Config
Build "Editor"

$exe = switch ($Config) {
    "Snapshot" { "out\cat-snapshot.exe" }
    default { "out\cat-release.exe" }
}
$size = (Get-Item $exe).Length

$sizes = Join-Path $PSScriptRoot "sizes.txt"
$previous = $null
if (Test-Path $sizes) {
    $last = Get-Content $sizes | Where-Object { $_ -match '^\d{4}-' } | Select-Object -Last 1
    if ($last) { $previous = [int]($last -split '\s+')[2] }
}
$delta = if ($previous) { " ({0:+#;-#;0} since the last entry of tools\sizes.txt)" -f ($size - $previous) } else { "" }
Write-Host "$exe`: $size bytes$delta"

& .\out\cat-debug.exe --check | Where-Object { $_ -match '^(minified|history|inputs file|check|frame time)' } | Write-Host
$checkFailed = $LASTEXITCODE -ne 0

if ($Log) {
    $commit = git rev-parse --short HEAD
    if (git status --porcelain --untracked-files=no) { $commit += "+" }
    $subject = git log -1 --format=%s
    $date = Get-Date -Format "yyyy-MM-dd"
    $known = (Test-Path $sizes) -and (Select-String -Path $sizes -SimpleMatch " $commit " -Quiet)
    if ($known) {
        Write-Host "$commit is already in tools\sizes.txt"
    } else {
        "$date $commit $size $subject" | Add-Content $sizes
        Write-Host "Logged in tools\sizes.txt"
    }
}

if ($checkFailed) { Write-Host "Self-test FAILED"; exit 1 }
