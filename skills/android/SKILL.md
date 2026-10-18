---
name: android
description: >-
  Set up and drive Android development on the Mac without Android Studio: Java 17, Google's
  command-line tools, the SDK, a virtual phone (emulator), and adb as the agent's eyes and hands
  (screenshots, taps, the screen's element tree, logs). Use this skill whenever the work touches an
  Android app or the Android build of one of our Expo / React Native apps, or the user says "set up
  Android", "what do I need for Android", "install the Android SDK", "start the emulator", "run it on
  Android", "screenshot the Android phone", "expo run:android fails", "adb doesn't see the device",
  or "avdmanager can't find the system image".
---

# Android on the Mac

The strict minimum is **Java 17, Google's command-line tools and the SDK**: no Android Studio. It
comes to about 5 GB, plus about 1 GB for each virtual phone. Proven on an M3 Mac on 2026-10-18.

## Setup

Each step needs the user's go-ahead: they install software and accept Google's licences.

```bash
brew install openjdk@17                            # Gradle needs Java 17 (Expo SDK 54 / React Native 0.81)
brew install --cask android-commandlinetools       # only to bootstrap sdkmanager

export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
SDK=$HOME/Library/Android/sdk
SM=/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager
yes | $SM --sdk_root=$SDK --licenses
$SM --sdk_root=$SDK "cmdline-tools;latest" "platform-tools" "platforms;android-36" \
  "build-tools;36.0.0" "emulator" "system-images;android-36;google_apis_playstore;arm64-v8a"
```

API 36 and build-tools 36 are what Expo SDK 54 compiles against. Take the **arm64-v8a** image: on
Apple Silicon it runs natively and boots in under a minute.

In `~/.zshrc`, with the SDK's own tools **before** the rest of the PATH (see *Traps*):

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="${HOME}/Library/Android/sdk"
export PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator:$PATH"
```

A virtual phone:

```bash
echo no | avdmanager create avd -n pixel -k "system-images;android-36;google_apis_playstore;arm64-v8a" -d pixel_8
```

## Run the virtual phone

```bash
emulator -avd pixel &                                          # with a window, for the user
emulator -avd pixel -no-window -no-audio -no-snapshot-save &   # headless, for an agent

# Wait with a bounded loop, never `adb wait-for-device` (see Traps)
for i in $(seq 80); do
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && break; sleep 3
done
adb emu kill                                                   # stop it when done: it holds 2 to 4 GB
```

Then build an app onto it: `npx expo run:android` in the Expo app's folder. The first Gradle build
is slow (5 to 10 minutes). *Not yet proven on our apps: write what it took here the first time.*

## adb: the agent's eyes and hands

Use adb, not Computer Use on the emulator's window. It works the same on a real phone over USB once
*USB debugging* is on (Settings → About → tap the build number 7 times, then Developer options).

| Need | Command |
|---|---|
| Screenshot | `adb exec-out screencap -p > shot.png` (then read the file) |
| Tap, swipe, type | `adb shell input tap X Y`, `input swipe X1 Y1 X2 Y2`, `input text 'hello'`, `input keyevent KEYCODE_BACK` |
| What is on screen, with bounds | `adb shell uiautomator dump /sdcard/ui.xml && adb exec-out cat /sdcard/ui.xml`: tap the centre of an element's `bounds` |
| Logs | `adb logcat -d -t 200`, or `adb logcat '*:E'` for errors only |
| Open a screen by deep link | `adb shell am start -a android.intent.action.VIEW -d '<scheme>://path'` |
| Which devices | `adb devices` (`emulator-5554` is the virtual phone) |

Screenshots are full resolution (1080×2400 on a Pixel 8). Map coordinates from the image you read
back to the device's pixels before tapping.

## Traps

| What you see | Why | What to do |
|---|---|---|
| `avdmanager create avd …` → `Error: Package path is not valid. Valid system image paths are: null`, though the image is installed | `/opt/homebrew/bin/avdmanager` (from the cask) comes first on the PATH and looks for the SDK in Homebrew's folder, not `~/Library/Android/sdk` | Put `$ANDROID_HOME/cmdline-tools/latest/bin` **first** on the PATH (above), and check with `which avdmanager` |
| A command that boots the emulator never returns | `adb wait-for-device` waits forever when the emulator failed to start, and blocks the tool call | Poll `sys.boot_completed` with a bounded loop; read the emulator's own output when it does not come up |
| `sys.boot_completed` is `1`, but the screenshot shows only a spinner and `uiautomator dump` has no `text=` in it | Android reports *booted* before the home screen has finished loading, most of all on a first boot | Before tapping, poll the dump until the text you expect is in it (bounded, like the boot loop) |
| `sdkmanager` prints that it is deprecated: *Use Android CLI instead* | Google is replacing it with `android` (`android sdk …`), in the same `cmdline-tools/latest/bin`, documented for agents at https://d.android.com/tools/agents/android-cli | `sdkmanager` still works. Try the Android CLI when something new is needed, and update this skill with what it does better |
| `android-commandlinetools requires Java` after the cask installs | The cask's warning, written for a Java on the system path | Ignore it: every command above runs with `JAVA_HOME` set |
| An old `export PATH=…${HOME}/android/platform-tools` line in `~/.zshrc` | A leftover from an earlier install, pointing to a folder that no longer exists | Replace it with the three lines above |
