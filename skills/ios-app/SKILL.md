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
| `Can't determine id of Simulator app` on every `expo run:ios` | Xcode 27 replaced Simulator.app. The patch in `patches/` fixes it; it is applied by `npm install`. Check with `grep -c com.apple.dt.Devices node_modules/expo/node_modules/@expo/cli/build/src/start/doctor/apple/SimulatorAppPrerequisite.js` |
| The simulator build succeeds, then `open -a Simulator … exited with non-zero code` | The same rename, in a place the patch does not cover. The app **is installed**. Start Metro alone (`ios.sh start`) and `xcrun simctl launch booted <bundle id>` |
| `xcodebuild` error 65, a pod below iOS 15 | `plugins/with-ios-deployment-target.js` is missing from `plugins` in `app.config.ts`, or the prebuild was not run again |
| Red screen: `Couldn't find a LinkingContext context` | Two copies of `@react-navigation/native`. Do not list `@react-navigation/*` in `package.json`: expo-router brings its own. Check with `npm ls @react-navigation/native` |
| `npm install` fails with `EACCES … _cacache` or "peer … @undefined" | Part of `~/.npm` is owned by root. `npm install --cache <another folder>` works; the lasting fix is `sudo chown -R $(whoami) ~/.npm`, which is the user's to run |
| `xcrun simctl openurl booted myapp://…` shows "Open in …?" and nothing happens | A system question nobody can tap. Navigate with a temporary line instead; a leftover question goes away with `xcrun simctl shutdown booted` and a boot |
| A WebView with `source={{ html }}` opens Safari for a link | A URL outside `originWhitelist` is handed to the system. Use `originWhitelist={['*']}` **and** `onShouldStartLoadWithRequest` that returns true only for `about:blank` |
| A test of "is the token in the page" says yes | The test's own text contains the word it looks for. Build the word from two parts |
| Sign-in returns to the app but the sheet stays, or iOS asks "wants to use … to sign in" in a trial | That question is normal on a real phone. For a pretend backend on `http://`, pass `preferEphemeralSession: true` |
| `mobile_publish` ends with "the export failed" right after Xcode's "Upload succeeded" | An old copy of `publish.sh`: it looked for `build/export`, which an upload does not leave. The upload did succeed. Take the current script (relay, Potion and tags were fixed on 2026-10-13) |
| A block, a layout or a dashboard in a web view never answers in a dev build, and a release build is fine | Its bridge (`serve` of `@ghostmind-dev/block`, or anything with a `stop()`) was made in `useMemo` or while rendering and stopped in an effect's cleanup. In development React runs an effect, undoes it and runs it again, and a stopped bridge answers nothing. Make it inside the effect and keep it in a ref |
| `new URL(x).searchParams` is empty or throws in the app | React Native's `URL` is not the browser's. Read the one value you need with a regular expression |
| The app on the phone talks to prod in dev ("redirect_uri is missing or not allowed" at sign-in, with prod's host in the sheet's title) | Xcode's config step did not get varlock's values. See *The config is read twice* above |

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
  ../<project>-ios origin/main`, `npm install` there once, then the publish in its `native/`. The dev folder
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
