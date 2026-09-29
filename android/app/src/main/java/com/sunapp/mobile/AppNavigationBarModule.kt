package com.sunapp.mobile

import android.graphics.Color
import android.os.Build
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Lets a screen paint its own color behind the system navigation bar.
 * Android's contrast scrim otherwise covers that area with a black bar.
 */
class AppNavigationBarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var previousContrastEnforced: Boolean? = null
  private var previousLightNavigationBars: Boolean? = null

  override fun getName(): String = "AppNavigationBar"

  @ReactMethod
  fun setTabColorBehindNavigation(enabled: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = reactApplicationContext.currentActivity?.window ?: return@runOnUiThread
      val controller = WindowInsetsControllerCompat(window, window.decorView)

      if (enabled) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && previousContrastEnforced == null) {
          previousContrastEnforced = window.isNavigationBarContrastEnforced
        }
        if (previousLightNavigationBars == null) {
          previousLightNavigationBars = controller.isAppearanceLightNavigationBars
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          window.isNavigationBarContrastEnforced = false
        }
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT
        // Dark gesture icon so it stays visible on the white tab half.
        controller.isAppearanceLightNavigationBars = true
      } else {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          window.isNavigationBarContrastEnforced = previousContrastEnforced ?: true
        }
        controller.isAppearanceLightNavigationBars = previousLightNavigationBars ?: false
        previousContrastEnforced = null
        previousLightNavigationBars = null
      }
    }
  }
}
