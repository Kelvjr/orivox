# Early Windows installable build (M2)

## Build and install

Run `npm run package:win` on Windows. This builds the production renderer, main and preload bundles, creates `release/win-unpacked`, and emits `release/Orivox-0.2.0-alpha.1-Windows-x64.zip`. Extract the entire ZIP, then run `Install-Orivox.ps1` from the extracted folder. It copies Orivox to `%LOCALAPPDATA%\Programs\Orivox` and creates Orivox and Uninstall Orivox shortcuts in the user's Start Menu. It requires no administrator privileges, VS Code, Node.js, or development server on the target machine.

The installer script can be run explicitly from PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Orivox.ps1
```

To uninstall, exit Orivox from its tray menu, then use the Uninstall Orivox Start Menu shortcut. The uninstaller retains per-user application data, including any protected credential file, rather than deleting user data without a separate choice.

An NSIS `.exe` build is configured as `npm run package:win:nsis`, but it could not complete on this machine because electron-builder's NSIS binary download from GitHub failed with `getaddrinfo ENOTFOUND github.com`. The installable ZIP is the tested delivery format for this early build. It is unsigned and uses the default Electron icon.

## Deepgram credential boundary

No Deepgram key is included in the ZIP, React bundle, Git, or logs. Local capture works without a key. For cloud transcription in the installed build, launch the installed executable from a PowerShell session holding a temporary key:

```powershell
$orivoxSecureKey = Read-Host 'Deepgram API key' -AsSecureString
$env:DEEPGRAM_API_KEY = [System.Net.NetworkCredential]::new('', $orivoxSecureKey).Password
Remove-Variable orivoxSecureKey
& "$env:LOCALAPPDATA\Programs\Orivox\Orivox.exe"
```

Do not paste the key into a chat, put it in a script, or commit an `.env` file. Close the PowerShell window after exiting Orivox. This early installer does not yet expose a credential setup screen. Fresh per-session cloud consent is still required before audio is transmitted.

## Independent Windows verification (2026-11-04)

- Built `0.2.0-alpha.1` with Electron 45.1.0 and electron-builder 26.18.1 using the locally installed Electron distribution.
- Produced a 159.9 MB installable ZIP, extracted it, and ran its own installer script. Installed executable: `%LOCALAPPDATA%\Programs\Orivox\Orivox.exe`.
- Launched that executable directly, outside VS Code and `npm run dev`. The visible main window loaded `file:///.../resources/app.asar/out/renderer/index.html`, confirming bundled renderer assets were used. Navigated from Home to Live Session and back in the installed app.
- Confirmed the package contains the application executable, installer and uninstaller scripts, `app.asar`, the PCM worklet, and the production `ws` dependency. No `.env` files or `.log` files were included.
- `npm run typecheck` passed. `npm test` passed: 63 tests across 8 suites. The production build passed.
- User confirmed a fresh-consent Local Capture Only microphone session in the installed app: the microphone level moved, Stop ended capture, and the indicator returned to Ready for Session. This was a user-observed smoke test, not an automated capture assertion. Earlier dual-source Deepgram call tests are recorded in `docs/m2-test-plan.md` and were run from the development build, not this installer.

The installed window currently displays older M2 copy, including an `Orivox v0.1.0` footer. Antigravity owns the renderer copy corrections; a later package rebuild will incorporate its handoff. This package is an early M2 preview, not a signed public release.
