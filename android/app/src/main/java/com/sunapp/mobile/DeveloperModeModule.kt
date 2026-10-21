package com.sunapp.mobile

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DeveloperModeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DeveloperMode"

  @ReactMethod
  fun isDeveloperModeEnabled(promise: Promise) {
    // Android 17 reports development_settings_enabled and adb_enabled as 0 to
    // every third-party app. adb_wifi_enabled is still readable and is only on
    // when Developer options are on.
    val dev = readGlobalInt(Settings.Global.DEVELOPMENT_SETTINGS_ENABLED)
    val adb = readGlobalInt(Settings.Global.ADB_ENABLED)
    val wifiAdb = readGlobalInt("adb_wifi_enabled")
    val enabled = dev == 1 || adb == 1 || wifiAdb == 1
    Log.i(TAG, "dev=$dev usbAdb=$adb wifiAdb=$wifiAdb enabled=$enabled")
    promise.resolve(enabled)
  }

  @ReactMethod
  fun openDeveloperSettings() {
    val context = reactApplicationContext
    val developerSettings =
      Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
    try {
      context.startActivity(developerSettings)
    } catch (e: ActivityNotFoundException) {
      val settings =
        Intent(Settings.ACTION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      context.startActivity(settings)
    }
  }

  private fun readGlobalInt(name: String): Int {
    return try {
      Settings.Global.getInt(reactApplicationContext.contentResolver, name, 0)
    } catch (e: Exception) {
      -1
    }
  }

  companion object {
    private const val TAG = "DeveloperMode"
  }
}
