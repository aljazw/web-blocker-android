# Gaman

**Gaman** is an Android focus and self-improvement app. It blocks the websites and apps that take your time, puts your phone to bed at night, plans your day in time windows, helps you build daily habits, guides your workouts set by set, and trains your breath-hold with freediving apnea tables. It's built with **React Native + TypeScript** and native **Kotlin** modules. Everything runs on your device: no accounts, no servers, no tracking.

> **Android only.** Gaman relies on Android Accessibility Services, `VpnService`, foreground services and other Android-specific APIs.

## Features

### Apnea training

-   **CO₂ and O₂ tables** generated from your personal best. A CO₂ table keeps the hold fixed (40–60% of your best) while the rest shrinks from 2:00 to 0:15. An O₂ table keeps a 2:00 rest while the hold grows to at most 85% of your best. Easy, Normal and Hard profiles, 4–12 rounds, every time snapped to 5 seconds.
-   **Custom tables:** set your own rest and hold for each round, then save and reuse them.
-   **Max-hold test:** an optional 1–3 minute breathe-up, then an open-ended hold with a live comparison to your best. You can also enter a time you measured elsewhere.
-   **Runs with the app closed.** A native foreground service owns the session clock. It holds a wake lock, plays cues and shows a live notification with Pause, End hold and End session. If Android kills the app, the session is restored and continues where it left off.
-   **Eyes-closed cues:** distinct tones and vibration patterns for hold and breathe, a 10-second warning, a 3-2-1 countdown, and an optional pulse every 30 s during a max hold.
-   **Contraction tracking:** tap at each diaphragm contraction. History records the count and first-contraction time for every round.
-   **Breathing exercises:** box breathing, breathe-up (1:2), 4-7-8 and resonance breathing, with an animated pacer.
-   **Progress:** personal-best trend chart, weekly sessions and hold time, training streak, and full per-round history.
-   **Safety first:** a one-time briefing (dry training only, no hyperventilation, never alone in water) before the first session.

### Day plan

-   **Your whole day in time windows:** meals, workouts, work and habits on one timeline, with the free time between blocks shown (tap it to fill it).
-   **Edit, don't rebuild:** each new day starts as a copy of the last one. One-off blocks (an appointment) stay on their day. Tomorrow can be planned in the evening.
-   **Built from your habits:** a starter day fits between your wake-up and bedtime and slots in today's habits. Habit blocks only appear on days the habit is due, and checking one off checks off the habit.
-   **Running late:** shift the rest of today's blocks by 10 minutes to an hour. Tomorrow keeps the usual times.
-   **Last 7 days:** how much of each day's plan you actually followed.
-   **Staying on track:** a "Now" card with time left and what's next, a notification as each block starts, an evening "plan tomorrow" reminder, and occasional in-app check-ins ("Now: Deep work", "Did you finish Lunch?").

### Habits

-   **Daily habits** with an icon and the weekdays they're due.
-   **Streaks:** consecutive due days completed. Days off never break a streak, and today stays pending until it's over. Best streak and a 7-day completion rate are tracked too.
-   **Reminders:** an optional notification at a time you choose, only on that habit's days.
-   **Automation:** a habit can complete itself when you reach the end of a workout or finish an apnea session that day.

### Workouts

-   **Plans:** list exercises with sets, then reps or a time per set, and the rest after each set. Two example workouts are one tap away.
-   **Follow along:** one tap per finished set, so you never lose count. Timed exercises such as a plank get a 5-second lead-in and count down for you. Rests count down too, with *Skip rest* and *+15 s*.
-   **Cues:** optional tones and vibration when a timed set or rest starts and ends, plus the last 3 seconds.
-   **Never lost:** progress is saved after every step, so closing the app resumes the workout where you left off.
-   **History:** weekly workouts, sets and time, plus recent sessions.

### Sleep time

-   **Bedtime to morning:** between the times you choose, every app opens a sleep page instead, Settings and Gaman included. Calls, the alarm clock, the home screen and the keyboard keep working.
-   **Hard to undo:** turning it off for the night means watching a short video to the end (no skip), then typing a short sentence such as *Habits are everything*. It comes back the next evening.

### Blocking

-   **Real-time URL blocking:** an Accessibility Service watches the address bar of Chrome, Firefox, Brave and Opera and redirects blocked sites to a block page.
-   **App blocking:** block any installed app on the same schedules. Opening it shows the block page, and the only way out is the home screen. Settings and the phone dialer can't be blocked, so emergency calls always work.
-   **DNS filter (second layer):** an on-device VPN answers DNS lookups for always-blocked sites, so they stay blocked even if Accessibility is turned off. A guided wizard walks you through setup, and allowed sites can be forwarded to the system resolver or to AdGuard DNS.
-   **Schedules:** chosen days and hours, including overnight ranges such as 22:00 to 07:00, with presets for *Always*, *Work hours*, *Evenings*, *Bedtime* and *Weekends*.

### Making it stick

-   **Watchdog:** a separate foreground service notices the moment the Accessibility Service is switched off and shows a full-screen prompt to turn it back on.
-   **Settings guard:** Gaman's own Accessibility toggle is guarded while protection is active.
-   **Restart after reboot:** protection layers restart after a reboot or an app update.
-   **Passphrase protection:** removing blocks or weakening protection requires typing a long passphrase.
-   **Uninstall prevention:** Gaman registers as a device admin so it can't be removed on impulse.
-   **Hidden blocks:** a block can be hidden so it can't be removed from inside the app.

### App

-   **Overview:** protection status, today's habits, your apnea best and the searchable block list in one place.
-   **Protection health:** Settings shows which layers are active at a glance.
-   **Design:** a restrained, neutral design system in light and dark mode with six accent colors, tabular numerals for every timer and statistic, [Lucide](https://lucide.dev) icons and subtle motion. The native block screens match the app's theme.

## Setup

> First, set up your environment with the official [React Native Environment Setup Guide](https://reactnative.dev/docs/environment-setup) (choose the **React Native CLI** tab). The app targets Android 7.0+ (minSdk 24, targetSdk 35).

```bash
git clone https://github.com/aljazw/web-blocker-android.git
cd web-blocker-android
npm install

# Terminal 1: start Metro
npm start

# Terminal 2: build and install the debug app on a device or emulator
npm run android
```

On first launch, follow the in-app steps to enable Gaman under **Settings → Accessibility**. For the strongest protection, also open **Settings** in the app and:

1. Grant **Display over other apps**, so the watchdog can show its prompt.
2. Turn on **DNS blocking** and follow the guided setup.
3. Enable **Passphrase protection** and **Uninstall prevention**.

If you get stuck, see the React Native [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

## Release build

A debug build loads JavaScript from Metro and is signed with a throwaway key. For daily use, build a signed release APK:

1. **Generate a signing key** (once):

    ```bash
    keytool -genkey -v -keystore gaman-release-key.jks -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
    ```

2. Put the `.jks` file in `android/app/`, and create `android/keystore.properties`:

    ```
    storeFile=gaman-release-key.jks
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

## Project structure

```
src/
├── screens/      Overview, Routine (day plan, block editor, habits), Workout (editor, session), Apnea (tables, session, history, settings), Block, Schedule, Sleep, Settings
├── components/   Design system: Card, ListGroup, Dialog, Button, TextField, IconPicker, EmptyState, StatTile, …
├── theme/        Light/dark palettes, accent colors, spacing & radius tokens
├── context/      Theme (dark mode + accent) and passphrase state
├── navigation/   Native stack + tabs (hidden screens frozen, tabs preloaded after launch)
├── storage/      One module per domain over a cached native store; writes notify open screens
├── hooks/        Screen data via useFocusData (loads once, refreshes on focus and on data changes)
├── utils/        Pure logic (plans, schedules, streaks, apnea tables and stats), native bridges
└── constants/    UI strings, safety copy, habit icons and quick-add suggestions

android/app/src/main/java/com/gaman/
├── BlockAccessibilityService.kt   URL and app blocking, sleep time and settings guard
├── DnsVpnService.kt               On-device DNS filter
├── WatchdogService.kt             Re-enable prompt when protection is turned off
├── BootReceiver.kt                Restarts layers after reboot or update
├── apnea/                         Session timeline, cue player and foreground service
├── sleep/                         Sleep schedule and the sleep page (video + passphrase)
└── modules/ + *Module.kt          React Native bridges, all registered in modules/GamanPackage.kt
```

## Built with Claude Code

Gaman (originally called SiteLock) started as a hand-written learning project. From February 2025 to September 2026 I built the core myself: the React Native UI, the Accessibility-based blocker, schedules, the passphrase, dark mode and device-admin uninstall prevention. That work runs through commit `091096d`.

After that, I continued development with [Claude Code](https://claude.com/claude-code):

1. **Protection layers.** In an earlier Claude Code session we added the watchdog service, the settings-page guard, the full-screen re-enable prompt, the DNS-filtering VPN with its setup wizard, the AdGuard upstream option, and restarting protection on boot.
2. **Code review and fixes** (commit `9a38a4a`). Claude reviewed `BlockAccessibilityService.kt` and fixed several bugs: schedule start times are now inclusive, deleted sites are unblocked immediately, and accessibility nodes are recycled to avoid leaks on Android 12 and below. It also refactored event handling so schedules are parsed once instead of on every screen event.
3. **Redesign and new features.** We built a first design system with selectable accent colors, Lucide icons, animations and haptics, made Settings scrollable on small phones, and added the Overview dashboard, block-list search, quick-add suggestions, schedule presets and the protection-health summary.
4. **Habits and app blocking** (commit `35566e2`). Daily habits with streaks and reminders, blocking installed apps on the same schedules as websites, and a refactor into shared hooks and pure, unit-tested logic.
5. **Apnea training and a professional redesign.** A Kotlin foreground service runs CO₂/O₂ tables, max-hold tests and breathing exercises with the app closed, with tested table generation and statistics. The whole app moved to a restrained design system: neutral palette, tabular numerals, list groups and standard dialogs instead of emoji and confetti.

## Contributing

_I'm still learning and this project is a work in progress. If you spot messy code, bad practices or things that could be done better, please jump in!_
_Code improvements, performance tips and cleanups are all welcome, as suggestions or pull requests._

## License

_This project is licensed under the [Apache License 2.0](LICENSE)._
