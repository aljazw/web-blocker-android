# 🔒 SiteLock

**SiteLock** is an Android app that blocks distracting websites, and is built to stay on when you're tempted to switch it off. It's written in **React Native + TypeScript** with native **Kotlin** modules, and all blocking runs on your device: no accounts, no servers, no tracking.

> ⚠️ **Android only.** SiteLock relies on Android Accessibility Services, `VpnService` and other Android-specific APIs.

## ✨ Features

### Blocking

-   🔗 **Real-time URL blocking:** an Accessibility Service watches the address bar of Chrome, Firefox, Brave and Opera and redirects blocked sites to a block page.
-   🌐 **DNS filter (second layer):** an on-device VPN answers DNS lookups for always-blocked sites, so they stay blocked even if Accessibility is turned off. A guided wizard walks you through setup, and you can forward allowed sites to the system resolver or to AdGuard DNS to keep ad and tracker blocking.
-   ⏰ **Schedules:** block a site on chosen days and hours, including overnight ranges such as 22:00 to 07:00. Presets cover *Always*, *Work hours*, *Evenings*, *Bedtime* and *Weekends*.
-   ⚡ **Quick add:** one-tap suggestions for common distractions in Social, Video, Forums and Shopping.

### Making it stick

-   🐕 **Watchdog:** a separate foreground service notices the moment the Accessibility Service is switched off and shows a full-screen "turn protection back on" prompt.
-   🛡️ **Settings guard:** SiteLock's own Accessibility on/off page is guarded while protection is active.
-   🔁 **Restart after reboot:** protection layers restart after a reboot or an app update.
-   🔑 **Passphrase protection:** removing sites or weakening protection requires typing a long passphrase.
-   🚫 **Uninstall prevention:** SiteLock registers as a device admin so it can't be removed on impulse.
-   🙈 **Hidden sites:** you can hide a blocked site so it can't be removed from inside the app.

### App

-   📊 **Overview dashboard:** shows protection status, how many sites are blocked right now, and a searchable block list with each site's schedule.
-   🩺 **Protection health:** Settings shows which layers are active at a glance.
-   🎨 **Modern UI:** light and dark mode with six accent colors, crisp vector icons ([Lucide](https://lucide.dev)), smooth animations and light haptic feedback. The native block and re-enable screens match the app's theme and accent.

## 🛠️ Setup

> 💡 First, set up your environment with the official [React Native Environment Setup Guide](https://reactnative.dev/docs/environment-setup) (choose the **React Native CLI** tab). The app targets Android 7.0+ (minSdk 24, targetSdk 35).

```bash
git clone https://github.com/aljazw/web-blocker-android.git
cd web-blocker-android
npm install

# Terminal 1: start Metro
npm start

# Terminal 2: build and install the debug app on a device or emulator
npm run android
```

On first launch, follow the in-app steps to enable SiteLock under **Settings → Accessibility**. For the strongest protection, also open **Settings** in the app and:

1. Grant **Display over other apps**, so the watchdog can show its prompt.
2. Turn on **DNS blocking** and follow the guided setup.
3. Enable **Passphrase protection** and **Uninstall prevention**.

If you get stuck, see the React Native [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

## 🔐 Release build

A debug build loads JavaScript from Metro and is signed with a throwaway key. For daily use, build a signed release APK:

1. **Generate a signing key** (once):

    ```bash
    keytool -genkey -v -keystore sitelock-release-key.jks -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
    ```

2. Put the `.jks` file in `android/app/`, and create `android/keystore.properties`:

    ```
    storeFile=sitelock-release-key.jks
    storePassword=yourStorePassword
    keyAlias=my-key-alias
    keyPassword=yourKeyPassword
    ```

    Both files are git-ignored. Never commit them.

3. **Build:**

    ```bash
    cd android
    ./gradlew assembleRelease
    ```

    The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

> Debug and release builds are signed with different keys. To switch between them, uninstall first. This clears your block list.

## 🗂️ Project structure

```
src/
├── screens/      Overview (Home), Add site (Block), Schedule, Settings, Welcome
├── components/   Design-system pieces: Button, Chip, SectionHeader, BlurModal, …
├── theme/        Light/dark palettes, accent colors, spacing & radius tokens
├── context/      Theme (dark mode + accent) and passphrase state
├── utils/        Storage, schedule logic, DNS, watchdog and overlay bridges
└── constants/    UI strings and quick-add suggestions

android/app/src/main/java/com/sitelock/
├── BlockAccessibilityService.kt   URL detection and settings guard
├── DnsVpnService.kt               On-device DNS filter
├── WatchdogService.kt             Re-enable prompt when protection is turned off
├── BootReceiver.kt                Restarts layers after reboot or update
└── modules/ + *Module.kt          React Native bridges
```

## 🤖 Built with Claude Code

SiteLock started as a hand-written learning project. From February 2025 to September 2026 I built the core myself: the React Native UI, the Accessibility-based blocker, schedules, the passphrase, dark mode and device-admin uninstall prevention. That work runs through commit `091096d`.

After that, I continued development with [Claude Code](https://claude.com/claude-code):

1. **Protection layers.** In an earlier Claude Code session we added the watchdog service, the settings-page guard, the full-screen re-enable prompt, the DNS-filtering VPN with its setup wizard, the AdGuard upstream option, and restarting protection on boot.
2. **Code review and fixes** (commit `9a38a4a`). Claude reviewed `BlockAccessibilityService.kt` and fixed several bugs: schedule start times are now inclusive, deleted sites are unblocked immediately, and accessibility nodes are recycled to avoid leaks on Android 12 and below. It also refactored event handling so schedules are parsed once instead of on every screen event.
3. **Redesign and new features.** We built a new design system with deeper dark and light palettes, rounded cards, pill buttons and selectable accent colors. Every screen was rebuilt on it, with Lucide vector icons, spring and fade animations, haptics, and restyled native block screens. Settings became scrollable on small phones, and we added the Overview dashboard, block-list search, quick-add suggestions, schedule presets and the protection-health summary.

## 🤝 Contributing

_I'm still learning and this project is a work in progress. If you spot messy code, bad practices or things that could be done better, please jump in!_
_Code improvements, performance tips and cleanups are all welcome, as suggestions or pull requests._

## 📄 License

_This project is licensed under the [Apache License 2.0](LICENSE)._
