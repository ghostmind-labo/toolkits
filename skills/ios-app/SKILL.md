---
name: ios-app
description: >-
  Tips, tricks and traps for building one of our iOS apps with Expo / React Native: the files to copy,
  the commands in order, what Xcode 27 breaks with Expo SDK 54 and how to fix it, how to try a flow on
  the simulator without being able to tap, and how to get a build on a plugged-in iPhone. Use this
  skill whenever the work touches an Expo or React Native app of ours: "create an iOS app for X", "set
  up Expo for this project", "prebuild", "run it on my phone", "expo run:ios fails", a red screen, a
  pod that will not build, an app that signs in to the wrong server, or an app that will not install
  or sign. The rules that do not depend on the framework (does it need a server, which credentials,
  naming, routines) are in the `system` plugin: this skill is only the framework's side.
---

# An iOS app with Expo: tips, tricks and traps

**The direction is in the `system` plugin** (`new-app` → non-web.md → *A mobile app*): no server of its
own by default, sign-in through the product's own OAuth with no new Google credential, Apple's shared
credentials in Vault, the bundle id and routine names, and no silent fallback to prod. Read it first.
This skill is what Expo and React Native add to it.

The lean, complete example is relay (`/Volumes/Projects/relay/native`); `tags/native` and
`potion/native` have a companion server, share extensions and widgets.

## The whole road, in order

1. Read the direction in `system`, and tell the person what will be asked of them (its table "who does what").
2. The files below, copied from relay; `npm install`; `varlock load`.
3. Sign-in: one exact app address in the product's OAuth proxy.
4. The two identifiers on Apple (API), capabilities if any.
5. `module_local_prebuild`, then the app on the simulator against a pretend backend. Look at every screen.
6. `mobile_local_device`: the dev app on the person's phone. Check the address at the bottom of the sign-in screen.
7. Merge, so prod has what the app needs.
8. The App Store Connect record (browser), then `mobile_archive` (a trial with no upload), then `mobile_publish`.
9. The tester group and the invitation (API). The person accepts it on the phone.

## The files

```
native/
  meta.json  .env.schema  Readme.md
  scripts/ios.sh       prebuild | (simulator) | device | start
  scripts/publish.sh   bump, build with Xcode, check, upload | submit | archive (no upload)
  app/                 the Expo project
    app.json           static: name, slug, scheme, version, icon
    app.config.ts      what differs per environment
    plugins/with-ios-deployment-target.js
    patches/expo++@expo+cli+<version>.patch
```

Copy `plugins/`, `patches/`, `scripts/publish.sh` and `scripts/fix-expo-simulator-check.sh` from relay or
Potion unchanged: they are what Xcode 27 needs with Expo SDK 54, and the reasons are written in them.
`package.json` needs `"postinstall": "patch-package"` and `patch-package` in devDependencies. The patch
is per `@expo/cli` version (Potion and relay: 54.0.27; tags: 54.0.23): when it stops applying, run
`fix-expo-simulator-check.sh`, then `npx patch-package expo/@expo/cli`.

Use the versions of a project that already builds on this Mac rather than the newest ones.

## The commands, in order

```sh
cd native/app && npm install                       # applies the patch
cd .. && varlock load                              # every value resolves
run routine module_local_prebuild                  # writes app/ios, installs the pods
run routine mobile_local_device                    # builds, installs on the phone, starts Metro
```

`app/ios/` is generated and not committed. After any change to `app.config.ts`, a plugin or a native
package: prebuild again.

**Google Cast** (a speaker on the same Wi-Fi): `react-native-google-cast` with its Expo plugin and the receiver id
from the schema. Start discovery from the first press of your own cast button
(`CastContext.getDiscoveryManager().startDiscovery()`, then `CastContext.showCastDialog()`), so iOS asks for the
local network then and not at launch: `iosDisableDiscoveryAutostart: true`, `iosStartDiscoveryAfterFirstTapOnCastButton:
false`, and an `NSLocalNetworkUsageDescription` that says what it is for. The simulator finds no speaker: casting is
tried on a phone, and only with the person's say. Reference: `noice/native` (`hooks/useNoice.tsx`).

**Sign-in through the product's OAuth:** `WebBrowser.openAuthSessionAsync(authorizeUrl, "<scheme>://oauth")`
(expo-web-browser), PKCE with expo-crypto, tokens in expo-secure-store. `relay/native/app/utils/auth.ts`
is forty lines to copy. No `expo-auth-session`, no reversed Google client id.

**Signing for a phone** needs no manual step when Xcode has the Apple account and an "Apple Development"
certificate (`security find-identity -v -p codesigning`): `appleTeamId` in the config and automatic
signing make the profile. Without an Xcode login (a fresh Mac): `xcodebuild -allowProvisioningUpdates
-authenticationKeyPath … -authenticationKeyID … -authenticationKeyIssuerID …` with the App Store Connect
key from Vault; see `tags/native/scripts/ios.sh signing`.

**Check signing without touching the phone:** `xcodebuild -workspace ios/<App>.xcworkspace -scheme <App>
-configuration Debug -destination 'id=<udid>' -allowProvisioningUpdates build`, then read
`Provisioning Profile:` in the output. To put that build on the phone yourself:
`xcrun devicectl device install app --device <udid> <path>.app`.

## The config is read twice: keep the values for Xcode

`app.config.ts` is read by the expo command (which has varlock's values) **and again inside Xcode**, by
the build step that writes the config into the app (`EXConstants.bundle/app.config`). That step does not
inherit the shell's environment. In a Debug build without a dev client, `Constants.expoConfig` is that
embedded copy, not Metro's. So with `process.env.API_URL ?? '<prod>'` the phone silently got prod.

- `scripts/ios.sh` writes the resolved, non-secret values to `app/.build-env.json` (gitignored) before any
  expo command; `app.config.ts` reads `process.env[key] || written[key]`.
- No default in `app.config.ts`: a missing value throws, naming the routine to run.
- To see what an installed build was given:
  `find ~/Library/Developer/Xcode/DerivedData -name app.config -path "*EXConstants*"` and read `extra`.

## Try a flow on the simulator

Use the simulator and a **pretend backend**, never the user's real account or real devices: a local copy
of the project's server with a pretend store, plus two routes that stand in for sign-in
(`/oauth/authorize` answers with a redirect straight back to the app with a code; `/oauth/token` answers
with a pretend token). Then:

```sh
API_URL=http://127.0.0.1:5098 varlock run -- bash scripts/ios.sh        # a process value wins over the schema
xcrun simctl io booted screenshot /tmp/s.png                            # then Read the image
```

You cannot tap in the simulator. To go through a flow, add one temporary line that does the press by
itself (an effect that calls the sign-in, or `router.navigate(...)`), let hot reload take it, screenshot,
and remove the line. Search for your marker before finishing (`grep -r TRIAL app`).

For a real phone, use the `ios-device` skill (screenshots and logs over USB).

## Traps

| What you see | Why, and what to do |
|---|---|
| Apple refuses the build after "Upload succeeded": email "Action needed … ITMS-90683: Missing purpose string in Info.plist … NSPhotoLibraryUsageDescription", and no build ever shows in TestFlight | A library refers to a protected API even though the app never calls it. `expo-file-system`'s legacy module (`ios/Legacy`, PHAsset) is the usual one, which is why an app without it (relay, noice) passes. Add the purpose string in `app.config.ts` `ios.infoPlist`, saying truthfully when the app would use it, and publish again. Look in `node_modules` for the API Apple names (`grep -rl PHPhotoLibrary node_modules --include='*.swift' --include='*.m'`) |
| The same refusal (ITMS-90683) for **`NSMicrophoneUsageDescription`** in an app that records, after adding `expo-image-picker` | Its plugin's `microphonePermission: false` does not mean "leave it": it **deletes** the key, even when another plugin (`expo-speech-recognition`) set it. Give it the app's own sentence instead, and read the four purpose strings in `ios/<App>/Info.plist` after the prod prebuild, before publishing |
| `mobile_signing` (or any `xcodebuild -workspace`) fails at once with `ls: ios/*.xcworkspace: No such file or directory` | The last prebuild was stopped while installing the pods (Ctrl-C in its pane): `ios/` holds the project but no workspace and no `Pods/`. Run `module_local_prebuild` to the end, then the routine again |
| `Can't determine id of Simulator app` on every `expo run:ios` | Xcode 27 replaced Simulator.app. The patch in `patches/` fixes it; it is applied by `npm install`. Check with `grep -c com.apple.dt.Devices node_modules/expo/node_modules/@expo/cli/build/src/start/doctor/apple/SimulatorAppPrerequisite.js` |
| The simulator build succeeds, then `open -a Simulator … exited with non-zero code` | The same rename, in a place the patch does not cover. The app **is installed**. Start Metro alone (`ios.sh start`) and `xcrun simctl launch booted <bundle id>` |
| `xcodebuild` error 65, a pod below iOS 15 | `plugins/with-ios-deployment-target.js` is missing from `plugins` in `app.config.ts`, or the prebuild was not run again |
| Red screen: `Couldn't find a LinkingContext context` | Two copies of `@react-navigation/native`. Do not list `@react-navigation/*` in `package.json`: expo-router brings its own. Check with `npm ls @react-navigation/native` |
| `npm install` fails with `EACCES … _cacache` or "peer … @undefined" | Part of `~/.npm` is owned by root. `npm install --cache <another folder>` works; the lasting fix is `sudo chown -R $(whoami) ~/.npm`, which is the user's to run |
| `xcrun simctl openurl booted myapp://…` shows "Open in …?" and nothing happens | A system question nobody can tap. Navigate with a temporary line instead; a leftover question goes away with `xcrun simctl shutdown booted` and a boot |
| A WebView with `source={{ html }}` opens Safari for a link | A URL outside `originWhitelist` is handed to the system. Use `originWhitelist={['*']}` **and** `onShouldStartLoadWithRequest` that returns true only for `about:blank` |
| Red screen at launch: `[Reanimated] Invalid color value: rgb(0 0 0 / 0.85)` | Reanimated only takes the comma forms (`rgba(0, 0, 0, 0.85)`, `#rrggbb`), although React Native's own parser accepts the space-separated CSS form. A colour made for the web (a theme package's `roleValue`) must be converted before it reaches a style: `nativeColour()` from `@ghostmind-dev/colors/native`, or `platformColors()`, which already does it |
| A test of "is the token in the page" says yes | The test's own text contains the word it looks for. Build the word from two parts |
| Sign-in returns to the app but the sheet stays, or iOS asks "wants to use … to sign in" in a trial | That question is normal on a real phone. For a pretend backend on `http://`, pass `preferEphemeralSession: true` |
| `mobile_publish` ends with "the export failed" right after Xcode's "Upload succeeded" | An old copy of `publish.sh`: it looked for `build/export`, which an upload does not leave. The upload did succeed. Take the current script (relay, Potion and tags were fixed on 2026-10-13) |
| A block, a layout or a dashboard in a web view never answers in a dev build, and a release build is fine | Its bridge (`serve` of `@ghostmind-dev/block`, or anything with a `stop()`) was made in `useMemo` or while rendering and stopped in an effect's cleanup. In development React runs an effect, undoes it and runs it again, and a stopped bridge answers nothing. Make it inside the effect and keep it in a ref |
| `new URL(x).searchParams` is empty or throws in the app | React Native's `URL` is not the browser's. Read the one value you need with a regular expression |
| The app on the phone talks to prod in dev ("redirect_uri is missing or not allowed" at sign-in, with prod's host in the sheet's title) | Xcode's config step did not get varlock's values. See *The config is read twice* above |
| The app shows **another project's screens**, or its red box names files that are not yours | Two apps in dev on one Mac, both asking Metro on 8081: yours loaded the other project's code. React Native's core is prebuilt with 8081 compiled in, so `expo run:ios --port` and `RCT_METRO_PORT` do nothing. Give each project its own port: a config plugin that sets `RCTBundleURLProvider.sharedSettings().jsLocation = "<ip.txt or localhost>:<port>"` in Debug, and `expo start --port <port>`. Copy `noice/native/app/plugins/with-metro-port.js`. Check what holds the port: `lsof -iTCP:8081 -sTCP:LISTEN` |
| `expo start` stops on "Use port 8082 instead?" in a script | The port is taken and the command is not interactive. Do not take the other one: the app was built for its own port. Find who holds it, and stop yours or theirs |
| Device build: "No profiles for '<bundle id>' were found … Automatic signing is disabled" | A new identifier: Apple does not know it, and no profile exists. Register it (`POST /v1/bundleIds`), then build once with `-allowProvisioningUpdates` and the App Store Connect key (`noice/native/scripts/ios.sh signing`). After that `expo run:ios --device` signs by itself |
| Signed device build: `Provisioning profile "iOS Team Provisioning Profile: <id>" doesn't include the App Groups capability` (and "doesn't support the group.… App Group") | The app group is in the entitlements but Apple does not know it, or the App ID does not have it. Register the group and assign it on each App ID (*A keyboard…* above), then build again with `-allowProvisioningUpdates` |
| `expo run:ios --device` stops at `- Connecting to: <phone>` after `Installing …`, for minutes | The phone is locked, or another project is installing on the same phone at the same time (`pgrep -fl "expo run:ios"`). The app is built: install it yourself, `xcrun devicectl device install app --device <udid> ~/Library/Developer/Xcode/DerivedData/<App>-*/Build/Products/Debug-iphoneos/<App>.app`, and stop your stuck command |
| `expo-speech-recognition` writes only WAV (`recordingOptions.outputEncoding` is a PCM format), about 2 MB a minute at 16 kHz | Keep the WAV for the recognizer and the server, and make a small M4A on the phone for storage with a local module (*A small native function* above): a fraction of the size, no conversion on a server |
| `react-native-google-cast`: an option has no effect (discovery starts at launch, Google's expanded controls appear) | Its Expo plugin's iOS options are prefixed: `iosReceiverAppId`, `iosDisableDiscoveryAutostart`, `iosStartDiscoveryAfterFirstTapOnCastButton`, `iosSuspendSessionsWhenBackgrounded`; `expandedController` defaults to true. An unprefixed `disableDiscoveryAutostart` is ignored in silence. Read the result in `ios/<App>/AppDelegate.swift` after the prebuild |
| Cast: "The request was aborted because a similar and overriding request was initiated", once per step of a fader | Each `session.setVolume` overtook the last, and the rejection is never caught. Send the volume at most every 200 ms, the last value only |

## To TestFlight: built here, no outside service

**Expo builds the app; it does not publish it.** We use none of Expo's hosted service (EAS): no `eas.json`, no
`eas-cli`, no project on expo.dev, no `expo-updates`. A project that still has them is to be brought to this
(relay, Potion and tags were, on 2026-10-12).

`scripts/publish.sh` is the same in relay, Potion and tags below its first lines: copy it, and change all of
them together. It builds with Xcode, checks the archive, and signs and uploads with the App Store Connect key
from Vault, so nobody types an Apple password. `publish.sh archive` (routine `mobile_archive`) does everything
except the upload: run it after any change to the targets (a share extension, a widget) to prove they sign.

It refuses to upload an archive that is not what was asked for: the prod identifier, the prod address in the
embedded config, and one build number in the app and every extension inside it.

```sh
npx expo prebuild --clean --platform ios        # under APP_ENV=prod: ios/ becomes the prod app
xcodebuild -workspace ios/<App>.xcworkspace -scheme <App> -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/<App>.xcarchive archive -allowProvisioningUpdates \
  -authenticationKeyPath <key.p8> -authenticationKeyID <id> -authenticationKeyIssuerID <issuer>
xcodebuild -exportArchive -archivePath build/<App>.xcarchive -exportOptionsPlist export.plist -exportPath build/export <same key flags>
```

- `export.plist`: `method` `app-store-connect`, `destination` `upload`, `signingStyle` `automatic`, `teamID`.
- The key is written to a `mktemp -d` folder and removed by a `trap`: it never stays on the machine.
- **Every upload needs its own build number.** Give the time (`date +%Y%m%d%H%M`) as `ios.buildNumber` through
  the environment, and keep it for Xcode's config step with the other values.
- "Upload Symbols Failed … React.framework / hermes.framework" at the end are warnings: the upload succeeded.
- The prebuild leaves `ios/` as the prod app: run `module_local_prebuild` before the next dev run.
- **Publish from a copy of `main`, not from the folder the dev build lives in:** `git worktree add
  .claude/worktrees/ios origin/main` (never a folder beside the project), `npm install` there once, then the
  publish in its `native/`, and `git worktree remove` it after. The dev folder
  keeps its dev `ios/`, and nobody's uncommitted work is in the build.
- **Nobody at the keyboard:** the version question takes its answer on standard input,
  `printf 'p\n' | run routine mobile_publish` (p, m, M, k, or a version in full).
- **One build of an app at a time, and say you are starting it.** Two sessions told to publish the same app
  each started one; one stopped "its own" with `pkill -f scripts/publish.sh`, which matches every project's
  publish on the machine (relay, 2026-10-13). Stop a build by its process id.
- **After "Uploaded", commit the new version**: `app.json`, that one file, as a change of its own. Left
  uncommitted, it rides into somebody's next `git commit -a`.
- **An upload is not a test.** A build nobody opened has run nowhere: say so in the report, with what to press
  first in TestFlight.
- Apple processes a build for a few minutes. Watch it with `GET /v1/builds?filter[app]=<id>`
  (`processingState` `VALID`, then `internalBuildState` `READY_FOR_BETA_TESTING`).

**What Apple only allows on its website** (use Chrome; the person is signed in there):

- **The App Store Connect record** (Apps → + → New App). The store name must be unique ("Relay" is taken:
  "Ghostmind Relay"); the name under the icon is the app's own. Write its id at the top of `publish.sh`. The site's selects
  ignore values set by script: click each one and type the option's text.
- **The push key** (developer.apple.com → Keys → +, "Apple Push Notifications service"). Choose **Sandbox &
  Production** and **Team Scoped**: neither can be changed after, and one key serves every app. Apple gives the
  file once. Fetching it is the person's click (an agent is not allowed to download a key): then
  `vault kv patch <path> APNS_KEY_ID=<id> APNS_KEY_P8=@<file>` and delete the file.

**What the API does** (the App Store Connect key, ES256 JWT):

- register a bundle id (`POST /v1/bundleIds`), turn a capability on (`POST /v1/bundleIdCapabilities`,
  `PUSH_NOTIFICATIONS`);
- make the internal tester group (`POST /v1/betaGroups`, `isInternalGroup` and `hasAccessToAllBuilds` true) and put
  a team member in it (`POST /v1/betaTesters` with their email and the group; adding an existing tester by id to an
  internal group is refused).

## A keyboard, and other extensions that share data with the app

Reference: `format/native/app/targets/keyboard` (built by `@bacons/apple-targets`, type `keyboard`, learned 2026-10-18).

- **A keyboard has no microphone.** iOS gives a keyboard extension no access to the mic, with or without Full Access.
  A dictation key opens the app (`format://record?from=keyboard`), the app records, leaves the text in the **app
  group** both share, and the keyboard types it (`textDocumentProxy.insertText`) when it is shown again. To record
  without leaving the other app, the app must already be running a background audio session the keyboard talks to;
  the person starts it once (that is how Wispr Flow works).
- **Opening the app from a keyboard:** `UIApplication.shared` does not exist in an extension. Walk the responder
  chain to the `UIApplication` and call `openURL:options:completionHandler:` through its method pointer (the
  keyboard's `open(_:)` in `KeyboardViewController.swift`, seen opening the app on iOS 26).
- **Full Access** (`RequestsOpenAccess: true`) is needed to read the app group. The target's own `Info.plist` in
  `targets/<name>/` is not managed by the plugin: write the whole `NSExtension` dict there yourself.
- **The app group, end to end:** `ios.entitlements['com.apple.security.application-groups']` in `app.config.ts`, the
  same array in the extension's `expo-target.config.js` (make it a function of `config`: the keyboard type did not
  pick it up by itself), then Apple: register the group in the Developer portal (Identifiers → App Groups; the
  identifier field adds `group.` itself, so type `com.example.app`), and on **every** App ID that uses it (the app and
  the extension, dev and prod) turn App Groups on and assign the group. The App Store Connect API cannot do either.
  Saving invalidates the existing profiles; the next build with `-allowProvisioningUpdates` makes new ones.
- **The app writes, the extension reads:** `ExtensionStorage` from `@bacons/apple-targets`
  (`new ExtensionStorage('group.<bundle id>').set(key, value)`), and `UserDefaults(suiteName:)` on the Swift side.

## A small native function of your own (a local Expo module)

When no package does one thing the app needs (here: the recognizer's WAV as M4A with Apple's encoder), write a
local module instead of a config plugin: `modules/<name>/` with `expo-module.config.json`
(`{"platforms":["apple"],"apple":{"modules":["<Name>Module"]}}`), `ios/<Name>.podspec` (depends on
`ExpoModulesCore`, `static_framework = true`), `ios/<Name>Module.swift` (`Name(…)`, `AsyncFunction(…)`), and an
`index.ts` with `requireNativeModule`. The prebuild links it like any package (check `grep <Name> ios/Podfile.lock`).
Reference: `format/native/app/modules/format-audio` (`AVAssetExportSession`, `AVAssetExportPresetAppleM4A`).

## Html a model wrote, in a web view

A chart in a note, a layout, a dashboard: every app of ours shows these with `@ghostmind-dev/block`, the same
sandboxed page as on the web (its rules: the `system` plugin, `new-app`, blocks.md). In the app:

- **The page:** `documentOf(source, { host, libraries, transport: 'webview', viewport })`. `transport` adds the
  script that talks through `window.ReactNativeWebView`; nothing else of the document differs from the web's.
- **The app's side:** `serve(host, webviewTarget((js) => web.current?.injectJavaScript(js)), handlers, { onHeight })`
  and `onMessage={(e) => served.receive(fromWebview(e.nativeEvent.data))}`. The handlers are the product's own
  functions, the same ones its web page uses. Make `serve` inside the effect (see *Traps*).
- **Keep `source` the same object while the page is the same** (`useMemo` on the html). A new object on every
  render reloads the page, and a height message is a render.
- **The channel carries text.** Bytes (a map tile) cross as base64 and are bytes again in the page; an app that
  already holds base64 answers `{ __blockBytes: text }`.
- **The web view is what keeps the page in:** `incognito`, and `onShouldStartLoadWithRequest` true only for
  `about:blank`. A second web view (a block opened on the whole screen) gets a document of its own
  (`expanded: true`, a viewport that may be pinched) and its own `serve`.
- **The package is plain JavaScript.** Metro reads it as it is; TypeScript needs a
  `types/ghostmind-block.d.ts` with `declare module '@ghostmind-dev/block'` for what the app uses.
- References: `potion/native/app/components/elements/HtmlBlock.tsx` (many functions, two web views),
  `tags/native/app/components/elements/LayoutView/LayoutView.tsx` (one function, 100 lines),
  `relay/native/app/app/dashboard/[id].tsx` with `utils/block.ts`.

## Location and notifications

- **Arriving and leaving** is a geofence (`expo-location` + `expo-task-manager`): iOS wakes the app at the edge,
  closed or not. It needs "Always" (ask "While using" first, then "Always"), `isIosBackgroundLocationEnabled`, and
  a purpose text that says exactly what it is for. Define the task at the top of a module the root layout imports.
- **The phone is locked when it arrives.** Anything the background task reads from the keychain must be saved with
  `keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK`, or the read fails in a pocket. A failed read is not
  "signed out": do not cache it as that.
- **Push without Expo's service:** `Notifications.getDevicePushTokenAsync()` gives Apple's own token; the server
  posts to APNs itself (HTTP/2, a JWT from the push key: `relay/api/app/src/push.js`, no dependency). A build from
  Xcode is known to Apple's **sandbox** service and a TestFlight one to **production**: send
  `Application.getIosPushNotificationServiceEnvironmentAsync()` with the token, and the bundle id as the topic.
- Ask for each permission when the person turns the feature on, never at launch.

## Before publishing

- What is given up without Expo's service: updates sent to installed apps without a new build. A fix is a new
  TestFlight build.
- Internal testers need no review. Outside testers and the App Store do: the privacy form, and for an app that
  signs in with Google only, Sign in with Apple.
- Sign in with Apple, when the app needs it: `expo-apple-authentication` and `usesAppleSignIn: true`
  (Potion has both).
