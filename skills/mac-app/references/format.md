# What Format taught: a Mac app with its own UI

Lessons from `/Volumes/Projects/format/mac` (a menu-bar dictation app: global shortcuts, a floating panel,
audio, pasting into other apps, in-app updates). Written by the format session on 2026-10-13 from its code.
File names are in `format/mac/app/Sources/Format/` unless a path is given. A line in bold is a trap that was
met; the rest is the way that works there.

## Permissions

- Look the signing identity up, with ad hoc as the fallback:
  `security find-identity -v -p codesigning | awk -F'"' '/Apple Development/ {print $2; exit}'`, then
  `--sign "${identity:--}"`. Print which one was used, so a lost permission is explained. `scripts/build.sh`.
- Pass `--identifier "$id"` when signing: the executable has the same name in dev and prod, only the bundle id
  differs. `scripts/build.sh`.
- Carbon hot keys (`RegisterEventHotKey`) need no permission. Watching modifiers system-wide
  (`NSEvent.addGlobalMonitorForEvents`) needs Accessibility. `Hotkeys.swift`.
- Microphone: check `AVCaptureDevice.authorizationStatus(for: .audio)` and call `requestAccess` only on
  `.notDetermined`; on denied, say so and stop. Info.plist needs `NSMicrophoneUsageDescription` and
  `NSSpeechRecognitionUsageDescription`. `Session.swift` (`microphoneAllowed`).
- Accessibility is asked once at launch (`AXIsProcessTrustedWithOptions` with the prompt) and every feature
  degrades without it: paste becomes "copied only", the screen lookup falls back to the window list.
  `Paster.swift` (`askForTrust`, `ready`), `Screens.swift`.
- **A bare, unbundled build reading the Keychain makes macOS ask for the login password every time.** Give
  dev-only modes a switch that turns the Keychain off, and the bare build its own service name.
  `Account.swift` (`Keychain.enabled`), `Build.swift`.

## Global shortcuts

- `RegisterEventHotKey` fails when another app holds the combination: make the initializer failable and log
  "already taken". `Hotkeys.swift` (`init?`).
- One Carbon event handler for all hot keys, mapped by id, hopping to the main queue. `Hotkeys.swift`
  (`installHandler`).
- **While Settings records a new shortcut, the registered ones swallow the key press.** Unregister all while
  recording, register again after. `Settings.swift` (`recordingShortcut`), `AppDelegate.swift` (`applyShortcuts`).
- A recorded shortcut must have ⌃, ⌥ or ⌘ (or be an F-key), or it gets in the way of typing.
- Keys that only make sense in one state (Esc, ⌥1 to ⌥9) are registered when that state starts and dropped
  when it ends, so they are not taken from other apps the rest of the time. `Session.swift` (`start`, `stopEngine`).
- Double-tap of a modifier: `flagsChanged` plus `keyDown`; cancel if another key went down in between or the
  hold passed 0.35 s; install a local monitor as well as the global one. `Hotkeys.swift` (`DoubleTapRightOption`).
- Store combinations as Carbon key code and Carbon modifier mask; convert to `NSEvent.ModifierFlags` only to
  show a menu key equivalent. `Settings.swift` (`KeyCombo`).

## Audio and input devices

- Remember a microphone by its CoreAudio UID (`kAudioDevicePropertyDeviceUID`), not its `AudioDeviceID`: the
  UID survives reconnects and reboots. `AudioDevices.swift`.
- A remembered microphone may be unplugged: `AVCaptureDevice(uniqueID:)` returns nil. Fall back to the default
  input and log it. `Microphone.swift`.
- `AVCaptureSession` with `AVCaptureAudioDataOutput` and the wanted format in `audioSettings` (16 kHz mono
  PCM16): the system converts, and a device can be picked. `Microphone.swift`.
- Listing inputs: keep devices whose `kAudioDevicePropertyStreamConfiguration` in the input scope has
  channels; rebuild menus on the `kAudioHardwarePropertyDevices` and `kAudioHardwarePropertyDefaultInputDevice`
  listeners. `AudioDevices.swift` (`inputs`, `watch`).
- Audio arrives before the recognizer is ready, and while it is swapped: buffer and replay, never drop.
  `Session.swift` (`AudioSink`), `LiveTranscriber.swift`.

## Pasting into another app

- **A modifier still held from the stop shortcut (the ⌥ of ⌥Space) turns ⌘V into ⌥⌘V.** Wait for
  `CGEventSource.flagsState(.hidSystemState)` to show no modifiers (up to 1 s) before posting. `Paster.swift`
  (`waitForModifierRelease`).
- Post synthetic keys from `CGEventSource(stateID: .privateState)`; set the flags on key down and key up.
- Record the frontmost app when the action starts, and never your own app as the target. `Session.swift` (`start`).
- **Activating the target app switches desktops when its window is on another one.** Check with
  `CGWindowListCopyWindowInfo([.optionOnScreenOnly])` (owner pid, layer 0), log it, and wait about 80 ms after
  `activate()` before the keys. `Paster.swift` (`hasWindowOnThisDesktop`).
- Before ⌘V, ask Accessibility what has the focus: a text role or a settable `AXValue` means text; a known
  non-text role means copy only; **an app that does not say counts as text**, or pasting breaks in apps with
  poor accessibility. `Paster.swift` (`focusedTextInput`).
- Several things pasted in turn (text, picture, text): sleep between setting the pasteboard and the key, and
  after it (longer for a picture, 700 ms). `Paster.swift` (`pasteSequence`).
- A picture goes on the pasteboard as `.png` and `.tiff`; a file as `writeObjects([url as NSURL])`. Terminals
  want ⌃V: make the key a setting.
- Watching for copies: poll `NSPasteboard.general.changeCount`; skip what a password manager put there
  (`org.nspasteboard.ConcealedType`, `TransientType`, `com.agilebits.onepassword`). `Capture.swift`
  (`Clipboard.hidden`).

## A floating panel

- A panel that never takes the keyboard: `NSPanel` with `.nonactivatingPanel`, `isFloatingPanel`,
  `level = .statusBar`, `hidesOnDeactivate = false`, `canBecomeMain` false, `canBecomeKey` true only while the
  person types in it; show it with `orderFrontRegardless()`. `Panel.swift` (`FloatingPanel`).
- Clicks land on the first try: subclass `NSHostingView` with `acceptsFirstMouse` true.
- **A panel that lived through a change of desktops or displays ends up bound to another desktop, and
  `.canJoinAllSpaces` never brings it back (`isOnActiveSpace` stays false).** Make a new window every time it
  comes back from hidden. As a backstop, 150 ms after showing, if it is still off: order out, set
  `[.moveToActiveSpace, .fullScreenAuxiliary]`, order front; still off, replace the window. Log each step.
  `Panel.swift` (`rebuildPanel`, `verifyOnActiveSpace`).
- `isOnActiveSpace` read right after ordering front is not settled: wait 150 ms.
- Replacing a window: `isReleasedWhenClosed = false`, clear `contentView` before `close()`, remove observers.
- **SwiftUI resizes the hosting window to fit its content, and a window grew off the screen.**
  `hosting.sizingOptions = []` and size the window yourself. Met twice. `Panel.swift`, `AppDelegate.swift`
  (`openSettings`).
- **With `sizingOptions = []`, a row whose content cannot shrink makes the whole view wider than its window:
  both ends are cut and the rounded background loses its corners.** Lay each row over a strip of the window's
  width (`Color.clear.frame(maxWidth: .infinity).frame(height: h).overlay(alignment: .leading) { row }.clipped()`)
  and give `ViewThatFits` a barer last option. `Panel.swift` (`row(height:)`). Built on 2026-10-13, not yet
  confirmed by the person.
- Which screen: the one holding most of the target app's focused window (Accessibility), else its topmost
  window from the window server (no permission needed; layer 0, larger than 80 pt), else the mouse. Choose
  once when the action starts and keep it. `Screens.swift`.
- Accessibility and the window server measure from the top-left of the main display, AppKit from its
  bottom-left: `primary.frame.maxY - rect.maxY`. The same holds for `screencapture -R`.
- Remembering where the panel was dragged: `didMoveNotification` also fires for your own `setFrame`, so save
  only while a mouse button is down (`NSEvent.pressedMouseButtons & 1`); save the size on
  `didEndLiveResizeNotification` only; store the spot relative to the screen.
- `isMovableByWindowBackground` fights with dragging inside the content: turn it off while the mouse is over
  that area. `Panel.swift` (`lockDrag`).
- A menu-bar app's Settings window: `collectionBehavior = [.moveToActiveSpace]`, never larger than the
  screen's `visibleFrame`, `NSApp.activate()` before `makeKeyAndOrderFront`.

## Menus

- **A SwiftUI `Menu` inside a view that redraws constantly was rebuilt while open and shrank to its button's
  width.** Build an `NSMenu` at the click and `popUp(positioning: nil, at: NSEvent.mouseLocation, in: nil)`.
  `Panel.swift` (`ActionMenu`).
- An `NSMenuItem` backed by a closure does not retain its target: put the target in `representedObject` too.
- The menu-bar menu is a plain `NSStatusItem` with an `NSMenu`, rebuilt whenever state changes;
  `setActivationPolicy(.accessory)` and `LSUIElement`. `AppDelegate.swift` (`buildMenu`), `main.swift`.

## Updates inside the app (Sparkle, in a Swift package)

- Sparkle must travel inside the app: `ditto` the framework from
  `.build/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework` into
  `Contents/Frameworks`, then `install_name_tool -add_rpath @executable_path/../Frameworks <binary>`.
- Signing order: Sparkle's `*.xpc`, `*.app` and `Autoupdate`, then the framework, then the app; then
  `codesign --verify --deep --strict`. `scripts/build.sh`.
- `sign_update` is in `.build/artifacts/sparkle/Sparkle/bin`. The private key comes from Vault as an
  environment variable, goes to a `mktemp` file under `umask 077` removed by a trap. The public key is
  `SUPublicEDKey` in Info.plist. `scripts/release.sh`.
- Sparkle compares `CFBundleVersion`: make it a build time (`date +%Y%m%d%H%M%S`) and put it in
  `sparkle:version`; the version people read goes in `shortVersionString`. The archive is
  `ditto -c -k --keepParent`.
- The dev app must not update from the public feed: its own `SUFeedURL` and `SUEnableAutomaticChecks` false,
  written by the build.
- Trying an update without publishing: a `defaults` key that points the feed at a local appcast; the
  signature is still checked. `Updater.swift`.
- A menu-bar app calls `NSApp.activate()` before `checkForUpdates`.

## One copy, and dev beside prod

- **Two copies of the app (`/Applications` and `~/Applications`) left fixes in a copy that was never the one
  launched.** One install path, and the About tab shows `Bundle.main.bundleURL.path`.
- **Two running copies both hear the shortcut, show two panels and paste twice.** At launch, terminate every
  other process with the same bundle id. `AppDelegate.swift` (`quitOtherCopies`).
- Dev and prod side by side: everything keyed apart (name, bundle id, URL scheme, server, config folder,
  Keychain service, update feed and **the default shortcut**). One Info.plist template with placeholders
  filled by `sed` from `--env`; Swift reads it in one enum. `scripts/build.sh`, `Build.swift`.
- The dev build says so: "dev" by the menu-bar icon and a badge in the panel.

## The dev loop

- **`open` right after replacing the bundle fails with -600.** After `pkill`, poll `pgrep` until the old one
  is gone (up to 5 s), retry `open` up to 5 times, and end with `pgrep` to prove it runs. `scripts/build.sh`.
- Watch mode with no extra tool: a stamp file and `find … -newer "$stamp" -print -quit` every second, 0.4 s
  for the editor to finish saving; a failed build leaves the previous app running. `scripts/dev.sh`.
- **The watch routine is often not running; an agent that edits Swift and assumes the dev app follows is
  wrong.** Build by hand and read the last lines: `cd mac && varlock run -- bash scripts/build.sh --debug --env dev`
  ends with "signature ok" and "installed …".
- An optimized build of a large dependency prints nothing for a minute and looks stuck: show which modules
  compile (from `ps`, `swift-frontend … -module-name`), and pass Ctrl-C on with a trap.

## Signing in to the product

- Loopback and PKCE, no secret in the app: `NWListener` on 127.0.0.1 with port `.any`, wait for `.ready` to
  read the port, open the system browser, answer the one request with a page that closes itself, check
  `state`, `NSApp.activate()`; a 300 s timeout races the callback. `Account.swift` (`signIn`, `LoopbackReceiver`).
- **A 502 or an HTML error page during a token refresh must not sign the person out.** Only a 400 or 401 with
  `invalid_grant`, `invalid_client` or `invalid_request` ends the login. Keep the old refresh token when the
  reply has none. `Account.swift` (`exchange`, `accessToken`).
- Keychain: a generic password, service = bundle id, `SecItemUpdate` then `SecItemAdd` on
  `errSecItemNotFound`, `kSecAttrAccessibleAfterFirstUnlock`; log the status code.
- The custom URL scheme is for commands (`open format://toggle`), handled in `application(_:open:)` and
  filtered on the build's own scheme. It is not how sign-in returns.

## Speech and CoreML models on the Mac

- **The libraries' loaders download whatever is missing.** Load a model only when all its files are on disk,
  pass `download: false` where the library has it (WhisperKit), and download only from a button.
  `LocalSpeech.swift`, `LocalEngines.swift`.
- A folder that exists is not a finished download: write your own marker file when the download returns.
- Loading takes seconds, longer the first time (CoreML compiles): load once per run and keep the engine.
- **A speech model given silence invents words.** Measure the stretch's energy and skip the model below a floor.
- MLX-based Swift packages need Xcode's Metal toolchain and do not build with plain `swift build`.
- Apple's `SpeechAnalyzer` / `DictationTranscriber`: `supportedLocale(equivalentTo:)`, assets through
  `AssetInventory.assetInstallationRequest`, `bestAvailableAudioFormat`, and convert the microphone's audio to
  it. `LiveTranscriber.swift` (`prepare`).
- **Words that are still changing often carry no audio time for a moment.** Code that places words by time
  must not attach an untimed word to the word before it. `LiveTranscriber.swift`. Built on 2026-10-13, not
  yet confirmed by the person.

## The release script

- **Released files are cached for a year, so a version is never published twice.** Read the published
  version from `latest.json`, take the higher of that and Info.plist, bump, refuse if the file exists; probe
  with `?t=$(date +%s)` or the CDN caches the 404. `scripts/release.sh`.
- **The connection dropped right after the third upload in a row.** Retry each upload, upload the feed and
  `latest.json` last, and give the script a `finish` mode that uploads what is missing without rebuilding.
- Info.plist is a template with placeholders: read and write the version as text with `sed`; PlistBuddy only
  on the built app's plist.
- **A release in flight leaves a bumped Info.plist and `Info.plist.bak` in the working tree, then commits on
  the branch itself. An agent's `git add -A` sweeps them in, and `HEAD` is no longer the agent's commit.**
  While a release may be running: stage by path, and take a commit's hash from `git log`, not `HEAD`.
- A "latest" download that is never cached: upload the .dmg again under a fixed name with `no-cache` and
  `content-disposition: attachment; filename="…-<version>.dmg"`.
- Release notes: `release-notes/<version>.md`, one line per item, turned into `<li>` in the appcast.

## Seeing the UI, and logging

- **Render every state of a SwiftUI view to PNG with `ImageRenderer`, from a `--render-panels <dir>` mode:**
  states staged on the model, no window, no server. This is how an agent looks at the UI. `main.swift`,
  `scripts/panels.sh`.
- A thumbnail must be a real bitmap drawn now (`NSBitmapImageRep` with `NSGraphicsContext`), or it does not
  show in `ImageRenderer`. `Capture.swift` (`load`).
- A screenshot taken by the app: `/usr/sbin/screencapture -x -i <file>` (Esc leaves no file: success is a size
  above 0); hide your own panel while the picker is up; needs Screen Recording.
- Headless modes on the binary: `--list-mics`, `--transcribe-file x.wav [locale]` fed at real speed. `main.swift`.
- An append-only log in the config folder (`~/.format/app.log`): one line per decision (which screen and how
  it was found, the paste target and its focus, Keychain status, model load times, panel recovery), never the
  person's text. `Paster.swift` (`AppLog`).
