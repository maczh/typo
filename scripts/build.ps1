# build.ps1 — Cross-platform build script for the Typo Tauri v2 desktop app (Windows host).
#
# Maps a chosen OS + CPU architecture to the matching Rust target triple and runs
# the project's local @tauri-apps/cli (`npm run tauri build`). The frontend is
# built automatically by Tauri's beforeBuildCommand (npm run build).
#
# Usage (PowerShell):
#   .\scripts\build.ps1 [-Os <win|mac|linux>] [-Arch <amd64|arm64>]
#                      [-Debug] [-Bundles <csv>] [-AllowCross]
#
# Defaults: auto-detect the host OS/arch and build natively.
#
# Cross-compilation caveats:
#   * macOS targets can ONLY be built on macOS (need the macOS SDK / Xcode).
#   * Windows arm64 (aarch64-pc-windows-msvc) from x64 Windows needs the VS
#     arm64 build tools. Cross to Linux needs the appropriate GNU toolchain.
#   Pass -AllowCross to attempt a cross build anyway (best-effort).

param(
  [string]$Os = "",
  [string]$Arch = "",
  [switch]$Debug,
  [string]$Bundles = "",
  [switch]$AllowCross
)

$ErrorActionPreference = 'Stop'

# Ensure the Cargo/Rust toolchain is reachable (rustup default install dir may not
# be on PATH in a fresh shell). Safe no-op if already present.
$cargoPaths = @("$env:CARGO_HOME\bin", "$env:USERPROFILE\.cargo\bin", "C:\Users\$env:USERNAME\.cargo\bin")
foreach ($p in $cargoPaths) {
  if ($p -and (Test-Path $p)) { $env:PATH = "$p;$env:PATH"; break }
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $ProjectRoot

function HostTriple {
  $raw = & rustc -vV 2>$null | Where-Object { $_ -match '^host:\s*(.+)$' } | ForEach-Object { $Matches[1] }
  return $raw
}

function DetectOs($t) {
  if ($t -match 'windows') { return 'win' }
  if ($t -match 'apple')   { return 'mac' }
  if ($t -match 'linux')   { return 'linux' }
  return 'unknown'
}

function DetectArch($t) {
  if ($t -match '^x86_64')       { return 'amd64' }
  if ($t -match 'aarch64|arm64') { return 'arm64' }
  return 'unknown'
}

$hostTriple = HostTriple
if (-not $hostTriple) { Write-Error 'rustc not found; install the Rust toolchain first.'; exit 1 }

$hostOs = DetectOs $hostTriple
$hostArch = DetectArch $hostTriple

if (-not $Os)   { $Os = $hostOs }
if (-not $Arch) { $Arch = $hostArch }

$triple = switch ("$Os-$Arch") {
  'win-amd64'   { 'x86_64-pc-windows-msvc' }
  'win-arm64'   { 'aarch64-pc-windows-msvc' }
  'mac-amd64'   { 'x86_64-apple-darwin' }
  'mac-arm64'   { 'aarch64-apple-darwin' }
  'linux-amd64' { 'x86_64-unknown-linux-gnu' }
  'linux-arm64' { 'aarch64-unknown-linux-gnu' }
  default       { '' }
}
if (-not $triple) { Write-Error "unsupported OS/arch combination: $Os/$Arch"; exit 1 }

Write-Host "Host:    $hostTriple ($hostOs/$hostArch)"
Write-Host "Target:  $triple ($Os/$Arch)"

if ($triple -ne $hostTriple) {
  Write-Host ''
  Write-Host 'NOTE: cross-compilation requested.'
  if ($Os -eq 'mac') {
    Write-Error 'macOS targets can only be built on macOS (need the macOS SDK / Xcode). Build on a Mac instead.'
    if (-not $AllowCross) { exit 1 }
  }
  if ($Os -eq 'win' -and $hostOs -ne 'win') {
    Write-Warning 'Building Windows from non-Windows needs MinGW-w64 (for -gnu) or MSVC (Windows host).'
    if (-not $AllowCross) { Write-Error 'Pass -AllowCross to attempt.'; exit 1 }
  }
  Write-Host 'Attempting cross build (best-effort)...'
}

if (Get-Command rustup -ErrorAction SilentlyContinue) {
  $installed = & rustup target list --installed 2>$null
  if ($installed -notcontains $triple) {
    Write-Host "Installing Rust target: $triple"
    & rustup target add $triple
  }
} else {
  Write-Warning 'rustup not found; assuming target is already installed.'
}

$cmd = @('run', 'tauri', '--', 'build', '--target', $triple)
if (-not $Debug) { $cmd += '--release' }
if ($Bundles) { $cmd += '--bundles'; $cmd += $Bundles }

Write-Host ''
Write-Host "Running: npm $($cmd -join ' ')"
Write-Host ''

& npm @cmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$out = if ($Debug) { 'debug' } else { 'release' }
Write-Host ''
Write-Host "Build finished. Artifacts in: src-tauri/target/$triple/$out/"
