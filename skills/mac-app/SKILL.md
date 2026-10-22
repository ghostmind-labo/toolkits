---
name: mac-app
description: >-
  Tips, tricks and traps for building one of our Mac apps in Swift without an Xcode project: a Swift
  package turned into a .app by a script, a menu-bar app with a window in SwiftUI, running a bundled
  command-line program (Node) from Swift, signing, notarising, making a .dmg, and checking the app
  when you cannot see its window. Use this skill whenever the work touches a Swift Mac app of ours:
  "make a Mac app for X", "a menu bar app", "package it as a DMG", "notarise it", "the app will not
  open on another Mac", "bundle node in the app", or a Swift build error in `mac/app`. The rules that
  do not depend on Swift (one per machine, where downloads live, who does what) are in the `system`
  plugin (`new-app`, non-web.md, *A Mac app*): this skill is only the language's side.
---

# A Mac app in Swift, our way

References: `/Volumes/Projects/relay/mac` (small: an app around a command-line program) and
`/Volumes/Projects/format/mac` (large: its own UI, in-app updates). Read the `system` plugin's *A Mac app*
first: it says what the app is and who does what. This is how to write it.

## No Xcode project

- `mac/app/Package.swift` with one `executableTarget`, `platforms: [.macOS(.v14)]`. `swift build` compiles it;
  a script copies the binary into `Relay.app/Contents/MacOS/`, writes `Contents/Info.plist` and signs. That is
  a whole app. Nothing to click in Xcode, and the build is a routine.
- **Use Swift language mode 5** (`swiftSettings: [.swiftLanguageMode(.v5)]`, tools version 6.0). Mode 6's
  strict concurrency turns every `Process` and `Pipe` callback into an error for no gain in an app this size.
- `swift build --show-bin-path` gives the folder of the binary; do not guess `.build/debug`.
- The bare binary runs from a terminal, but menu bar items, login items and permissions only behave inside a
  `.app`. Always try the bundle.

## The app's shape (SwiftUI)

- A window plus a menu bar item is two scenes: `Window("Name", id: "main") { … }` and `MenuBarExtra { … } label: { … }`.
  Closing the window leaves the app running in the menu bar. Reopen it with `@Environment(\.openWindow)` and
  `NSApp.activate(ignoringOtherApps: true)`.
- `Section` is SwiftUI's own name. An enum of yours called `Section` shadows it: write `SwiftUI.Section` for
  the list ones, or name the enum something else.
- A custom entry point: `@main enum Main { static func main() async { … RelayApp.main() } }` and no `@main` on
  the `App`. That is where a `--describe` mode goes.
- Start at login: `SMAppService.mainApp.register()` (ServiceManagement). It only works from a signed bundle,
  and throws otherwise: catch it and say so.

## Running a program from the app

- `Process` with `executableURL` and `arguments`; give it a `Pipe` for output and `FileHandle.nullDevice` for
  input (a program that finds no terminal must not wait for one).
- **Read the pipe to the end before `waitUntilExit()`.** The other order hangs when the output is larger than
  the pipe's buffer.
- Do it off the main actor (`Task.detached`) and come back with the answer. One short-lived process every few
  seconds is fine; do not keep a shell open.
- A long-running child: `terminationHandler` to bring it back (wait longer each time, up to a minute), a
  `readabilityHandler` on its pipe for its log, and `terminate()` when the app quits.
- Pass the environment on and add to it; a child started from an app does not get the shell's `PATH`. Call
  the runtime by its full path.
- Decode the program's JSON with `Decodable`. For "any value" fields, a small enum that tries Bool, then
  Double, then String. Try Bool before Double.

## A runtime inside the app (Node)

- Fetch the official archive for the exact version, check it against `SHASUMS256.txt` from the same release,
  and copy only `bin/node` into `Contents/Resources/`. About 110 MB in the app, 60 MB in the .dmg.
- The program's files go in `Contents/Resources/program/`, with `npm ci --omit=dev` run there.
- Node needs entitlements to run under the hardened runtime: `com.apple.security.cs.allow-jit`,
  `allow-unsigned-executable-memory`, `disable-library-validation`. Sign `node` with them, then the app.
- Sign inside out: nested binaries first, the app last. `--deep` hides mistakes; do not use it.
- Apple silicon only unless you also fetch and `lipo` the Intel one. Say which in the readme.

## Signing, notarising, the disk image

- A trial build: `codesign --force --sign - <app>` (signed for this Mac only).
- To give it away: `codesign --force --options runtime --timestamp --sign "Developer ID Application: …"`.
  Find the identity with `security find-identity -v -p codesigning`. An "Apple Development" identity is not
  it: an app signed with that is refused on any other Mac.
- The Developer ID certificate is made by the account holder, once, in Xcode. A script cannot make it.
- Notarise the .dmg, not the app: `xcrun notarytool submit <dmg> --key <p8 file> --key-id … --issuer … --wait`,
  then `xcrun stapler staple <dmg>`. The key is the App Store Connect key from Vault, written to a temporary
  folder removed by a trap.
- The disk image: a folder with the app and a link to `/Applications`, then
  `hdiutil create -volname <Name> -srcfolder <folder> -format UDZO <out>.dmg`.
- Not notarised yet: it still opens with right-click, Open, the first time. Tell the person and say so on the
  download link.
- Local network access (looking for speakers, lights): `NSLocalNetworkUsageDescription` and, for Bonjour,
  `NSBonjourServices` in Info.plist, or macOS silently finds nothing.

## Checking it without seeing it

- `screencapture` fails from an agent's shell ("could not create image from display"), and System Events
  only lists windows on the current desktop. Do not rely on either.
- Give the app `--describe`: run the same model once, print what each view would list, exit. Run the packaged
  binary this way too: it proves the bundled runtime and program work.
- `pgrep -fl <App>.app/Contents/MacOS` says it is running; a crash leaves a report in
  `~/Library/Logs/DiagnosticReports`.
- Say what was not checked: the layout, the menu bar item, the first-open dialogs. The person looks at those.

## Traps met

- A script that replaces the built app with `rm -rf "$APP"` is stopped by the agent's safety check when the
  path comes from a variable. Move the old one aside inside the build folder and remove by a fixed pattern.
- The same config folder is read by the app's program and by a command-line copy the person already runs.
  That is wanted (one identity per machine) and is why only one may run: see the `system` plugin.
- A menu-bar app whose icon disappears after relaunches (each rebuild of a dev watch): an `NSStatusItem` with no
  `autosaveName` is put back at the left end of the menu bar, beside the notch, the first place a full menu bar hides.
  Set `statusItem.autosaveName` (one per app, "app-dev" for the dev one) so macOS keeps where the person dragged it.
  Seen on format (2026-10-18), with the dev and prod apps both in the menu bar; fixed in the code, not yet confirmed
  on screen.
- An app whose settings depend on which account it talks to: put the address in Info.plist at build time
  (trial: dev) and let an environment variable win, so one binary can be pointed elsewhere for a check.

## Sparkle in a Swift package app (learned on format and relay, 2026-10-22)

How we use it, the key and the release, is the `system` plugin's (`new-app`, non-web.md, *A Mac app*). What Sparkle
itself does:

- **SwiftPM leaves Sparkle outside the app.** `swift build` links `@rpath/Sparkle.framework` and puts it only in
  `.build/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/`. Copy it into `Contents/Frameworks`
  and add `install_name_tool -add_rpath @executable_path/../Frameworks`, or the app cannot start: dyld does not find
  `@rpath/Sparkle.framework`. Check with `otool -L` and by running the binary once.
- **Sign inside out:** `Downloader.xpc` and `Installer.xpc` (with `--preserve-metadata=entitlements`), `Updater.app`,
  `Autoupdate`, then the framework, then the app. A plain `codesign` on the app does not reach them, and
  `codesign --verify --deep --strict` then fails. Under the Developer ID each one gets `--options runtime --timestamp`.
- **`sparkle:version` is compared with `CFBundleVersion`**, not the version people see: the build number must only
  grow (a timestamp does).
- **Sparkle quits the app to replace it** (`NSApp.terminate`). A child process the app started keeps running from
  the old copy unless the app stops it on `NSApplication.willTerminateNotification`.
- `generate_keys --account <app>` keeps the private key in the login keychain; `-x <file>` exports it (for Vault),
  `-p` prints the public half. `sign_update --ed-key-file <file> -p <zip>` prints the signature alone.

## Bluetooth from a Mac app (learned on relay, 2026-10-13)

- **An app started as a child of a terminal gets the terminal's permissions.** CoreBluetooth then never
  answers (no state update, no error). Start a dev build with `open -n --stdout <file> --stderr <file> <App>.app`
  and read the file; never `<App>.app/Contents/MacOS/<App> &` from a script.
- `NSBluetoothAlwaysUsageDescription` in Info.plist, or the app is killed the first time it touches Bluetooth.
- Sign the dev build with the Apple Development certificate, not ad hoc, or macOS asks again for every
  permission after each rebuild.
- **macOS hides the game-controller and keyboard service (0x1812) from apps.** `discoverServices(nil)` on a
  controller returns only the ordinary ones (device information 0x180A, battery 0x180F). An app can read the
  battery; it cannot read the buttons. Buttons come through the system, as an input device (`node-hid`, or
  GameController).
- **A link an app holds does not make the device an input device.** `connect()` succeeds, and the system still
  shows no game controller. Do not build "reconnect my controller" on CoreBluetooth; the remedy for a stuck
  one is the system's (remove it, Bluetooth off and on, pair again).
- `retrieveConnectedPeripherals(withServices:)` only returns what matches a service the app may see: ask with
  0x1800 and 0x1801 (every device has them), not 0x1812.
- A device that knows its Mac calls only that Mac when switched on, and a scan does not hear it. A standing
  `connect()` on a peripheral from `retrievePeripherals(withIdentifiers:)` does, and never times out.
- Give the app a headless check (`<App> --bluetooth <file>`: listen for a while, write what it is told): an
  agent cannot see the app's window, and `log show` says nothing useful about Bluetooth.
