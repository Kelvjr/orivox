param()

$ErrorActionPreference = 'Stop'
$expectedRoot = Join-Path $env:LOCALAPPDATA 'Programs\Orivox'
if ((Test-Path -LiteralPath $expectedRoot) -and
    ((Get-Item -LiteralPath $expectedRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Refusing to uninstall through a directory link.'
}
$running = Get-CimInstance Win32_Process -Filter "Name = 'Orivox.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($expectedRoot, [StringComparison]::OrdinalIgnoreCase) }
if ($running) {
  throw 'Exit Orivox from the system tray before uninstalling.'
}
$menuRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Orivox'
if (Test-Path -LiteralPath $menuRoot) {
  Remove-Item -LiteralPath $menuRoot -Recurse -Force
}
if (Test-Path -LiteralPath $expectedRoot) {
  Remove-Item -LiteralPath $expectedRoot -Recurse -Force
}
Write-Output 'Orivox uninstalled. Per-user application data was retained.'
