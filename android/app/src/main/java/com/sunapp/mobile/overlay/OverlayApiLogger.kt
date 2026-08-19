package com.sunapp.mobile.overlay

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext

object OverlayApiLogger {
  private const val TAG = "ReactNativeJS"
  private const val EVENT = "OverlayApiLog"
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var reactContext: ReactApplicationContext? = null

  fun init(context: ReactApplicationContext) {
    reactContext = context
  }

  fun logRequest(method: String, url: String, body: String?) {
    logLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logLine("📤 API REQUEST [OVERLAY][$method] $url")
    if (!body.isNullOrBlank()) {
      logLine("📤 Request body: $body")
    }
    logLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    emit("request", method, url, body, null, null)
  }

  fun logResponse(method: String, url: String, status: Int, body: String?) {
    logLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logLine("📥 API RESPONSE [OVERLAY][$method] $url | Status: $status")
    if (!body.isNullOrBlank()) {
      logLine("📥 Response data: $body")
    }
    logLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    emit("response", method, url, null, status, body)
  }

  fun logError(method: String, url: String, status: Int?, message: String, body: String?) {
    logLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logLine(
      "📥 API ERROR [OVERLAY][$method] $url | Status: ${status ?: "n/a"} | Message: $message",
    )
    if (!body.isNullOrBlank()) {
      logLine("📥 Error response data: $body")
    }
    logLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    emit("error", method, url, message, status, body)
  }

  fun logInfo(message: String) {
    logLine(message)
    emit("info", "INFO", "", message, null, null)
  }

  private fun logLine(message: String) {
    Log.i(TAG, message)
  }

  private fun emit(
    kind: String,
    method: String,
    url: String,
    bodyOrMessage: String?,
    status: Int?,
    responseBody: String?,
  ) {
    mainHandler.post {
      val ctx = reactContext ?: return@post
      if (!ctx.hasActiveReactInstance()) return@post

      val map = Arguments.createMap().apply {
        putString("kind", kind)
        putString("method", method)
        putString("url", url)
        if (bodyOrMessage != null) putString("body", bodyOrMessage)
        if (status != null) putInt("status", status)
        if (responseBody != null) putString("responseBody", responseBody)
      }

      runCatching {
        ctx.emitDeviceEvent(EVENT, map)
      }
    }
  }
}
