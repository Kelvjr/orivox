param()

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'Programs\Orivox'
$sourceRoot = Join-Path $PSScriptRoot 'Orivox'
$sourceExe = Join-Path $sourceRoot 'Orivox.exe'
if (-not (Test-Path -LiteralPath $sourceExe)) {
  throw 'Orivox.exe is missing from this package. Extract the entire ZIP before installing.'
}
if (Test-Path -LiteralPath $InstallRoot) {
  throw "An Orivox installation already exists at $InstallRoot. Uninstall it before installing this build."
}

$installParent = Split-Path -Parent $InstallRoot
New-Item -ItemType Directory -Path $installParent -Force | Out-Null
Copy-Item -LiteralPath $sourceRoot -Destination $InstallRoot -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall-Orivox.ps1') -Destination $InstallRoot

$menuRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Orivox'
New-Item -ItemType Directory -Path $menuRoot -Force | Out-Null
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $menuRoot 'Orivox.lnk'))
$shortcut.TargetPath = Join-Path $InstallRoot 'Orivox.exe'
$shortcut.WorkingDirectory = $InstallRoot
$shortcut.Save()
$uninstallShortcut = $shell.CreateShortcut((Join-Path $menuRoot 'Uninstall Orivox.lnk'))
$uninstallShortcut.TargetPath = (Get-Command powershell.exe).Source
$uninstallShortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $InstallRoot 'Uninstall-Orivox.ps1') + '"'
$uninstallShortcut.Save()

Write-Output "Orivox installed at $InstallRoot"
