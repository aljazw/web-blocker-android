package com.disciplineapp

import android.content.Context

/** The user-facing app name. The brand lives only in res/values/strings.xml (app_name). */
val Context.appName: String get() = getString(R.string.app_name)
