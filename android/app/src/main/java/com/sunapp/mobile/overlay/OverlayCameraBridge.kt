package com.sunapp.mobile.overlay

import android.os.Handler
import android.os.Looper

object OverlayCameraBridge {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var onPhotoCaptured: ((String?) -> Unit)? = null

  fun requestCapture(callback: (String?) -> Unit) {
    onPhotoCaptured = callback
  }

  fun deliverPhoto(path: String?) {
    mainHandler.post {
      val callback = onPhotoCaptured
      onPhotoCaptured = null
      callback?.invoke(path)
    }
  }

  fun cancelPending() {
    onPhotoCaptured = null
  }
}
