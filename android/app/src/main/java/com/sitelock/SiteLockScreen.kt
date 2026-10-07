package com.sitelock

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Builds SiteLock's full-screen native pages (block page, guard, re-enable
 * prompt) in the same visual language as the React Native app: deep navy or
 * soft light background, an icon badge, bold title, rounded quote card and a
 * pill button. Follows the user's dark-mode and accent choice from the shared
 * "BlockedPrefs" storage that the JS SharedStorage module writes.
 */
object SiteLockScreen {

    enum class Tone { ACCENT, DANGER }

    data class Spec(
        val iconRes: Int,
        val tone: Tone,
        val eyebrow: String,
        val title: String,
        val body: String,
        val quote: String? = null,
        val primaryLabel: String,
        val onPrimary: () -> Unit,
        val secondaryLabel: String? = null,
        val onSecondary: (() -> Unit)? = null,
    )

    private data class Palette(
        val dark: Boolean,
        val background: Int,
        val card: Int,
        val border: Int,
        val text: Int,
        val muted: Int,
        val accent: Int,
        val danger: Int,
    )

    /** Mirrors src/theme/accents.ts: name -> (dark, light). */
    private val ACCENTS = mapOf(
        "indigo" to ("#7C8CFF" to "#4F5BD5"),
        "violet" to ("#B18CFF" to "#7C4DDB"),
        "teal" to ("#2DD4CF" to "#0E9490"),
        "emerald" to ("#3DDC97" to "#12A26B"),
        "amber" to ("#FFB547" to "#C77700"),
        "rose" to ("#FF7A9C" to "#D6336C"),
    )

    private fun palette(context: Context): Palette {
        val prefs = context.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
        // Stored by JS as JSON: "true"/"false" and "\"teal\"". Dark is the app default.
        val dark = prefs.getString("@is_dark_mode", null) != "false"
        val accentName = prefs.getString("@accent_color", null)?.trim('"') ?: "indigo"
        val (accentDark, accentLight) = ACCENTS[accentName] ?: ACCENTS.getValue("indigo")

        return if (dark) {
            Palette(
                dark = true,
                background = Color.parseColor("#0B0F1A"),
                card = Color.parseColor("#151B2B"),
                border = Color.parseColor("#252E44"),
                text = Color.parseColor("#F3F5FA"),
                muted = Color.parseColor("#8A93A8"),
                accent = Color.parseColor(accentDark),
                danger = Color.parseColor("#FF6B6B"),
            )
        } else {
            Palette(
                dark = false,
                background = Color.parseColor("#F4F6FB"),
                card = Color.parseColor("#FFFFFF"),
                border = Color.parseColor("#E2E6F0"),
                text = Color.parseColor("#111527"),
                muted = Color.parseColor("#6B7389"),
                accent = Color.parseColor(accentLight),
                danger = Color.parseColor("#E5484D"),
            )
        }
    }

    fun show(activity: Activity, spec: Spec) {
        val p = palette(activity)
        val tone = if (spec.tone == Tone.DANGER) p.danger else p.accent
        val dp = { v: Int -> v.dp(activity) }

        val content = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(32), dp(28), dp(32))
        }

        // Icon badge: tinted circle with the glyph inside.
        val badge = FrameLayout(activity).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(withAlpha(tone, 0.16f))
            }
            layoutParams = LinearLayout.LayoutParams(dp(96), dp(96))
            addView(ImageView(activity).apply {
                setImageResource(spec.iconRes)
                setColorFilter(tone)
                layoutParams = FrameLayout.LayoutParams(dp(44), dp(44), Gravity.CENTER)
            })
        }

        val eyebrow = TextView(activity).apply {
            text = spec.eyebrow.uppercase()
            textSize = 11f
            letterSpacing = 0.12f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setTextColor(tone)
            setPadding(dp(12), dp(6), dp(12), dp(6))
            background = pill(withAlpha(tone, 0.14f))
            layoutParams = margins(top = dp(28))
        }

        val title = TextView(activity).apply {
            text = spec.title
            textSize = 28f
            letterSpacing = -0.01f
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setTextColor(p.text)
            layoutParams = margins(top = dp(14))
        }

        val body = TextView(activity).apply {
            text = spec.body
            textSize = 16f
            gravity = Gravity.CENTER
            setLineSpacing(0f, 1.25f)
            setTextColor(p.muted)
            layoutParams = margins(top = dp(12))
        }

        content.addView(badge)
        content.addView(eyebrow)
        content.addView(title)
        content.addView(body)

        spec.quote?.let { quote ->
            content.addView(TextView(activity).apply {
                text = quote
                textSize = 15f
                gravity = Gravity.CENTER
                setLineSpacing(0f, 1.2f)
                setTypeface(typeface, Typeface.ITALIC)
                setTextColor(p.text)
                setPadding(dp(20), dp(18), dp(20), dp(18))
                background = GradientDrawable().apply {
                    cornerRadius = dp(20).toFloat()
                    setColor(p.card)
                    setStroke(dp(1), p.border)
                }
                layoutParams = margins(top = dp(28), matchWidth = true)
            })
        }

        val primary = TextView(activity).apply {
            text = spec.primaryLabel
            textSize = 16f
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setTextColor(Color.WHITE)
            background = pill(tone)
            isClickable = true
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)).apply {
                topMargin = dp(36)
            }
            addPressSpring()
            setOnClickListener { spec.onPrimary() }
        }
        content.addView(primary)

        if (spec.secondaryLabel != null && spec.onSecondary != null) {
            content.addView(TextView(activity).apply {
                text = spec.secondaryLabel
                textSize = 14f
                gravity = Gravity.CENTER
                setTextColor(p.muted)
                setPadding(dp(16), dp(14), dp(16), dp(14))
                isClickable = true
                layoutParams = margins(top = dp(8))
                setOnClickListener { spec.onSecondary.invoke() }
            })
        }

        val scroll = ScrollView(activity).apply {
            isFillViewport = true
            setBackgroundColor(p.background)
            addView(FrameLayout(activity).apply {
                addView(content, FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER,
                ))
            }, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }

        // Keep content clear of the status/navigation bars (Android 15 is edge-to-edge).
        scroll.setOnApplyWindowInsetsListener { v, insets ->
            @Suppress("DEPRECATION")
            v.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
            insets
        }

        activity.setContentView(scroll)
        paintSystemBars(activity, p.background, p.dark)
        animateIn(content, badge, dp(24))
    }

    // ---- helpers -----------------------------------------------------------

    private fun Int.dp(context: Context): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, this.toFloat(), context.resources.displayMetrics).toInt()

    private fun withAlpha(color: Int, alpha: Float): Int =
        Color.argb((alpha * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))

    private fun pill(color: Int) = GradientDrawable().apply {
        cornerRadius = 999f
        setColor(color)
    }

    private fun margins(top: Int, matchWidth: Boolean = false) = LinearLayout.LayoutParams(
        if (matchWidth) ViewGroup.LayoutParams.MATCH_PARENT else ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = top }

    @Suppress("ClickableViewAccessibility")
    private fun View.addPressSpring() {
        setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.96f).scaleY(0.96f).setDuration(90).start()
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
                    v.animate().scaleX(1f).scaleY(1f).setDuration(220)
                        .setInterpolator(OvershootInterpolator(3f)).start()
            }
            false // let the click listener still fire
        }
    }

    private fun animateIn(content: View, badge: View, offset: Int) {
        content.alpha = 0f
        content.translationY = offset.toFloat()
        badge.scaleX = 0.6f
        badge.scaleY = 0.6f

        AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(content, View.ALPHA, 1f).setDuration(380),
                ObjectAnimator.ofFloat(content, View.TRANSLATION_Y, 0f).setDuration(420)
                    .apply { interpolator = DecelerateInterpolator(2f) },
                ObjectAnimator.ofFloat(badge, View.SCALE_X, 1f).setDuration(520)
                    .apply { interpolator = OvershootInterpolator(2.2f) },
                ObjectAnimator.ofFloat(badge, View.SCALE_Y, 1f).setDuration(520)
                    .apply { interpolator = OvershootInterpolator(2.2f) },
            )
            startDelay = 60
            start()
        }
    }

    @Suppress("DEPRECATION")
    private fun paintSystemBars(activity: Activity, color: Int, dark: Boolean) {
        val window = activity.window
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            window.statusBarColor = color
            window.navigationBarColor = color
        }
        // Dark icons on the light theme, light icons on the dark theme.
        var flags = window.decorView.systemUiVisibility
        flags = if (dark) flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        else flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags = if (dark) flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
            else flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        window.decorView.systemUiVisibility = flags
    }
}
