# App icon

The app icon is **Spartan helm in laurel**, in black and steel blue.

## app/

The source SVGs the Android icon is rendered from.

| File | Used for |
|---|---|
| `icon_foreground.svg` | Adaptive icon foreground (`mipmap-*/ic_launcher_foreground.png`) |
| `icon_background.svg` | Adaptive icon background (`mipmap-*/ic_launcher_background.png`) |
| `icon_monochrome.svg` | Android 13+ themed icon (`mipmap-*/ic_launcher_monochrome.png`) |
| `icon_visible.svg` | Legacy and round launcher icons, and the in-app logo (`src/assets/icons/ic_app.png`) |
| `icon_notification.svg` | Notification icon (`drawable-*/ic_stat_app.png`) |
| `icon_full.svg` | The full 108×108 canvas, foreground over background |
| `icon_512.png` | 512 px preview |

The artwork is scaled to stay inside Android's safe zone, a circle of radius 33 on the 108-unit canvas, so launchers never crop it.

Sizes per density: the adaptive layers are 108 dp (108, 162, 216, 324 and 432 px), the launcher icons are 48 dp (48, 72, 96, 144 and 192 px), and the notification icon is 24 dp (24, 36, 48, 72 and 96 px).

## alternatives/

Kept in case the icon changes later.

- `koku.svg` and `koku-android.svg` (fitted for Android): 克, "to overcome", as in 克己, self-mastery. Black and steel blue.
