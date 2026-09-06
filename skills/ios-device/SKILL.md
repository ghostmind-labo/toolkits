---
name: ios-device
description: >-
  See and inspect a real iPhone or iPad over USB — screenshots, live logs, device info, deep links —
  using pymobiledevice3. Use this skill whenever the user wants to check what an app looks like on
  their physical device, or says things like "screenshot my iPhone", "what does it look like on the
  phone", "show me the device", "check it on my iPhone", "grab the device screen", "read the device
  logs", "why is the app crashing on device", "verify this on iOS", "is it working on the phone",
  "take a picture of my screen", or asks how to give Claude eyes on a device. Also use when work
  touches React Native, Expo, or a native iOS app and a change needs verifying somewhere other than
  a simulator. Covers the physical-device path first, because that is the one that is hard; the
  simulator path is here too for when no cable is available.
---

# iOS Device — eyes on real hardware

A connected iPhone can be screenshotted, tailed and driven from the command line. This
closes the gap where mobile changes get shipped "code-verified only" — the loop becomes
the same one used for a browser: change it, let hot reload push, look at the screen.

**One tool does the work: `pymobiledevice3`.** Everything else on macOS either lacks the
capability or was broken by Apple's iOS 17 protocol change. Read *What does not work*
before reaching for anything familiar — that section is the reason this skill exists.

## Setup

Needed once per machine:

```bash
pip3 install --user pymobiledevice3        # or: pipx install pymobiledevice3
```

The binary may land outside `PATH`. Resolve it before anything else and reuse the value:

```bash
PMD=$(command -v pymobiledevice3 || ls ~/Library/Python/*/bin/pymobiledevice3 2>/dev/null | head -1)
```

Needed every session:

- **A USB cable.** This is the usual cause of "no device found". A phone paired over
  Wi-Fi is visible to `xcrun devicectl` and to Xcode, and completely invisible here —
  these tools speak usbmuxd, which needs the cable. Plug it in and tap **Trust**.
- **Developer Mode enabled** on the device (Settings → Privacy & Security → Developer
  Mode). Already true for anything running a dev build.

Confirm before doing anything else, and read the version — it decides which paths work:

```bash
$PMD usbmux list
```

An empty list means no USB connection, whatever Xcode says.

## Capability: Screenshot the device

```bash
$PMD developer dvt screenshot /tmp/device.png
```

Then read the PNG with the Read tool. About three seconds per capture, no `sudo`, no
tunnel to start by hand — pymobiledevice3 negotiates the iOS 17+ native tunnel itself
and prints a warning saying so, which is expected and not an error.

Practical notes:

- **Warnings are noise.** `NotOpenSSLWarning` and an asyncio `DeprecationWarning` appear
  on every call under an older Python. Send stderr to `/dev/null` and check the file
  exists instead of parsing output.
- **The capture is the live screen**, including whatever sheet or keyboard is up. To
  prove a capture is fresh rather than a stale file, compare `md5` of two captures, or
  read the clock in the status bar.
- **Identical hashes are not a failure.** A static screen produces identical PNGs. Only
  conclude "nothing is animating" if something animated is actually in the viewport.

## Capability: Read device logs

Two channels, and they answer different questions:

```bash
$PMD syslog live                      # the whole device, iOS-level
```

For a React Native or Expo app, the app's own `console.log` and red-box errors usually
appear in the **Metro/dev-server terminal**, not in syslog — with source file, line and
call stack. Read that first for anything app-level; it is richer and needs no cable.

Logs answer what a screenshot cannot: a request that hangs, a token that fails, a stack
trace. A blank screen with a healthy log is a rendering bug; a blank screen with a stack
trace is that stack trace.

## Capability: Device info

```bash
$PMD usbmux list                                   # everything, as JSON
ideviceinfo -k ProductVersion                      # if libimobiledevice is installed
xcrun devicectl list devices                       # works over Wi-Fi too; good for pairing state
```

`ProductVersion` matters: every iOS major has moved this ground at least once.

## Capability: Deep link into a screen

Screenshots show one screen — the one the person left open. To reach another, use the
app's URL scheme rather than asking them to tap:

```bash
$PMD developer dvt launch <bundle-id>              # cold-start the app
```

There is no tap or swipe here. `idb` (`brew install idb-companion`) adds
`idb ui tap x y` if a flow genuinely needs driving; do not install it for screenshots
alone.

## What does not work

Each of these looks correct, is widely suggested, and fails. Do not spend time on them.

| Approach | What actually happens |
|---|---|
| `xcrun devicectl ... screenshot` | **No screenshot subcommand exists.** devicectl manages and launches; it does not capture. |
| `idevicescreenshot` (libimobiledevice) | `Could not start screenshotr service: Invalid service` on iOS 17+. The Developer Disk Image is mounted and *still* fails: Apple moved these services behind RemoteXPC, which libimobiledevice 1.4.0 cannot reach. Not a mounting problem — do not chase the DDI. |
| `ffmpeg -f avfoundation` | Lists the phone as `<Name> Camera` and `<Name> Desk View Camera`. That is **Continuity Camera — the rear camera**, not the screen. There is no screen source. |
| QuickTime movie recording | Shows the screen to a human but cannot be scripted into a file a tool can read. |
| Anything, over Wi-Fi | usbmuxd requires the cable. `devicectl` seeing the device proves pairing, not usability here. |

If `pymobiledevice3` itself fails after an iOS update, that is the thing to upgrade
(`pip3 install --user --upgrade pymobiledevice3`) — it tracks Apple's protocol changes
and the others do not.

## When there is no cable: the simulator

`xcrun simctl` needs no cable and no extra install, and gives more control than a real
device — at the cost of not being one:

```bash
xcrun simctl list devices available              # pick one
xcrun simctl boot "iPhone 17 Pro"
xcrun simctl io booted screenshot /tmp/sim.png
xcrun simctl openurl booted "myapp://some/path"  # navigate without tapping
xcrun simctl ui booted appearance dark           # check both themes
xcrun simctl status_bar booted override --time "9:41" --batteryLevel 100
xcrun simctl shutdown "iPhone 17 Pro"            # clean up what you booted
```

A freshly booted simulator screenshots **black** for the first several seconds. Wait for
the boot to finish before concluding anything.

Use the simulator for fast iteration on layout and rendering; use the real device to
confirm, because the two differ on exactly the things that tend to break: WebView
behaviour, share extensions, cameras, Continuity, fonts and performance.

## Workflow guidance

**The loop.** With hot reload running, a mobile change is verifiable the same way a web
change is: edit the file, let Fast Refresh push it, screenshot, look. Do this rather
than reporting a mobile change as unverified — one capture takes seconds.

**Say what the screenshot shows, not what it implies.** Report the state visible on the
device. If something needed to prove a claim is off-screen, ask for a scroll rather than
inferring it.

**A screenshot is not a diagnosis.** It shows a symptom. The logs show the cause. When a
screen is blank or wrong, read the log before theorising about the code.

**Do not leave things running.** Shut down any simulator that was booted for a check, and
delete capture files from `/tmp` once they have been read.

**Ask for the physical things.** Plugging in a cable, tapping Trust, scrolling to a
screen, unlocking the device — none of these can be done from here. Ask directly and say
why, rather than working around them with something that does not actually work.
