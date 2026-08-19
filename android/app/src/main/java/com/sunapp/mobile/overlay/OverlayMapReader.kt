package com.sunapp.mobile.overlay

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

internal object OverlayMapReader {
  fun getMap(map: ReadableMap?, key: String): ReadableMap? {
    if (map == null || !map.hasKey(key) || map.isNull(key)) return null
    return runCatching { map.getMap(key) }.getOrNull()
  }

  fun readInt(map: ReadableMap?, key: String, fallback: Int = 0): Int {
    if (map == null || !map.hasKey(key) || map.isNull(key)) return fallback
    return when (map.getType(key)) {
      ReadableType.Number -> map.getDouble(key).toInt()
      ReadableType.String -> map.getString(key)?.toDoubleOrNull()?.toInt() ?: fallback
      else -> fallback
    }
  }

  fun readDouble(map: ReadableMap?, key: String, fallback: Double = 0.0): Double {
    if (map == null || !map.hasKey(key) || map.isNull(key)) return fallback
    return when (map.getType(key)) {
      ReadableType.Number -> map.getDouble(key)
      ReadableType.String -> map.getString(key)?.toDoubleOrNull() ?: fallback
      else -> fallback
    }
  }

  fun readString(map: ReadableMap?, key: String, fallback: String = ""): String {
    if (map == null || !map.hasKey(key) || map.isNull(key)) return fallback
    return when (map.getType(key)) {
      ReadableType.String -> map.getString(key)?.trim().orEmpty().ifBlank { fallback }
      ReadableType.Number -> {
        val n = map.getDouble(key)
        if (n % 1.0 == 0.0) n.toInt().toString() else n.toString()
      }
      else -> fallback
    }
  }

  fun readBalanceText(item: ReadableMap): String {
    val directText = readString(item, "balance_amount_text", "")
    if (directText.isNotBlank()) return directText

    val flatBalance = readString(item, "balance_amount", "")
    if (flatBalance.isNotBlank()) return flatBalance

    val loan = getMap(item, "loan")
    val loanBalance = readString(loan, "balance_amount", "")
    if (loanBalance.isNotBlank()) return loanBalance

    val amount = readDouble(item, "balance_amount", readDouble(loan, "balance_amount", 0.0))
    return if (amount % 1.0 == 0.0) amount.toInt().toString() else String.format("%.2f", amount)
  }

  fun readBalanceAmount(item: ReadableMap): Double {
    val text = readBalanceText(item)
    return text.toDoubleOrNull() ?: readDouble(item, "balance_amount", readDouble(getMap(item, "loan"), "balance_amount", 0.0))
  }
}
