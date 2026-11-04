param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$releaseRoot = Join-Path $projectRoot 'release'
$unpackedRoot = Join-Path $releaseRoot 'win-unpacked'
$stagingRoot = Join-Path $releaseRoot 'package-staging'
$appRoot = Join-Path $stagingRoot 'Orivox'
$archivePath = Join-Path $releaseRoot ("Orivox-{0}-Windows-x64.zip" -f $packageJson.version)

$resolvedReleaseRoot = [IO.Path]::GetFullPath($releaseRoot).TrimEnd('\')
$resolvedStagingRoot = [IO.Path]::GetFullPath($stagingRoot).TrimEnd('\')
if (-not $resolvedStagingRoot.StartsWith($resolvedReleaseRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Package staging must stay inside the release directory.'
}
if ((Test-Path -LiteralPath $stagingRoot) -and
    ((Get-Item -LiteralPath $stagingRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Package staging cannot be a directory link.'
}

if (-not (Test-Path -LiteralPath (Join-Path $unpackedRoot 'Orivox.exe'))) {
  throw 'The packaged Orivox.exe is missing. Run electron-builder first.'
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $appRoot -Force | Out-Null
Copy-Item -Path (Join-Path $unpackedRoot '*') -Destination $appRoot -Recurse -Force
$copiedDebugLog = Join-Path $appRoot 'debug.log'
if (Test-Path -LiteralPath $copiedDebugLog) {
  Remove-Item -LiteralPath $copiedDebugLog -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Install-Orivox.ps1') -Destination $stagingRoot
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall-Orivox.ps1') -Destination $stagingRoot

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
Compress-Archive -Path (Join-Path $stagingRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingRoot -Recurse -Force
Write-Output $archivePath
