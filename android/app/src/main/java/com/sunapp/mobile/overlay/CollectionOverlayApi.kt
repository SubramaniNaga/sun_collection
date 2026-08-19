package com.sunapp.mobile.overlay

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

object CollectionOverlayApi {
  private val executor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  fun submitPayment(
    config: OverlayConfig,
    amountPaid: Double,
    paymentType: String,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    if (config.paymentKind == "nip") {
      submitNipPayment(config, amountPaid, paymentType, onSuccess, onError)
      return
    }

    submitCollectionPayment(config, amountPaid, paymentType, onSuccess, onError)
  }

  private fun submitNipPayment(
    config: OverlayConfig,
    amountPaid: Double,
    paymentType: String,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    if (config.loanId <= 0 || config.customerId <= 0) {
      val msg = "Invalid loan/customer id (${config.loanId}/${config.customerId})"
      OverlayApiLogger.logError("POST", nipCollectionUrl(config), null, msg, null)
      mainHandler.post { onError(msg) }
      return
    }

    executor.execute {
      try {
        val url = URL(nipCollectionUrl(config))
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val payload =
          JSONObject().apply {
            put("loan_id", config.loanId)
            put("customer_id", config.customerId)
            put("nip_date", today)
            put("amount_paid", amountPaid)
            put("balance_amount", config.balanceAmount)
            put("notes", "Collected via proximity overlay")
            put("payment_type", paymentType.lowercase(Locale.US))
            put("status", 1)
            if (config.latitude != 0.0 || config.longitude != 0.0) {
              put("latitude", config.latitude)
              put("longitude", config.longitude)
            }
          }

        val response = postJson(url, config.authToken, payload)
        if (response.success) {
          mainHandler.post(onSuccess)
        } else {
          mainHandler.post { onError(response.message) }
        }
      } catch (e: Exception) {
        OverlayApiLogger.logError(
          "POST",
          nipCollectionUrl(config),
          null,
          e.message ?: "Payment failed",
          null,
        )
        mainHandler.post { onError(e.message ?: "Payment failed") }
      }
    }
  }

  private fun submitCollectionPayment(
    config: OverlayConfig,
    amountPaid: Double,
    paymentType: String,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    val collectionId = config.collectionId
    if (collectionId <= 0) {
      val msg = "Invalid collection id ($collectionId)"
      OverlayApiLogger.logError("PUT", collectionPaymentUrl(config, collectionId), null, msg, null)
      mainHandler.post { onError(msg) }
      return
    }

    executor.execute {
      try {
        val url = URL(collectionPaymentUrl(config, collectionId))
        val payload =
          JSONObject().apply {
            put("amount_paid", amountPaid)
            put("payment_type", paymentType)
            if (config.latitude != 0.0 || config.longitude != 0.0) {
              put("latitude", config.latitude)
              put("longitude", config.longitude)
            }
          }
        val response = putJson(url, config.authToken, payload)
        if (response.success) {
          mainHandler.post(onSuccess)
        } else {
          mainHandler.post { onError(response.message) }
        }
      } catch (e: Exception) {
        OverlayApiLogger.logError(
          "PUT",
          collectionPaymentUrl(config, collectionId),
          null,
          e.message ?: "Payment failed",
          null,
        )
        mainHandler.post { onError(e.message ?: "Payment failed") }
      }
    }
  }

  fun submitDelayRemark(
    config: OverlayConfig,
    description: String,
    photoPath: String,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    if (config.remarkId <= 0) {
      val msg = "Invalid remark id (${config.remarkId})"
      OverlayApiLogger.logError("POST", delayRemarkUrl(config), null, msg, null)
      mainHandler.post { onError(msg) }
      return
    }

    val photoFile = File(photoPath)
    if (!photoFile.exists() || photoFile.length() <= 0L) {
      val msg = "Visit photo is required"
      OverlayApiLogger.logError("POST", delayRemarkUrl(config), null, msg, null)
      mainHandler.post { onError(msg) }
      return
    }

    executor.execute {
      try {
        val url = URL(delayRemarkUrl(config))
        val boundary = "----SunOverlay${System.currentTimeMillis()}"
        val logBody =
          JSONObject()
            .apply {
              put("remark_id", config.remarkId)
              put("description", description)
              put("profile_photo", photoFile.name)
            }
            .toString()
        OverlayApiLogger.logRequest("POST", url.toString(), logBody)

        val connection =
          (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 30000
            readTimeout = 30000
            doOutput = true
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            if (config.authToken.isNotBlank()) {
              setRequestProperty("Authorization", "Bearer ${config.authToken}")
            }
          }

        connection.outputStream.use { output ->
          writeMultipartField(output, boundary, "remark_id", config.remarkId.toString())
          writeMultipartField(output, boundary, "description", description)
          writeMultipartFile(output, boundary, "profile_photo", photoFile, "image/jpeg")
          output.write("--$boundary--\r\n".toByteArray(Charsets.UTF_8))
        }

        try {
          val response = readResponse(connection, "POST", url.toString())
          if (response.success) {
            mainHandler.post(onSuccess)
          } else {
            mainHandler.post { onError(response.message) }
          }
        } finally {
          connection.disconnect()
        }
      } catch (e: Exception) {
        OverlayApiLogger.logError(
          "POST",
          delayRemarkUrl(config),
          null,
          e.message ?: "Could not submit delay remark",
          null,
        )
        mainHandler.post { onError(e.message ?: "Could not submit delay remark") }
      }
    }
  }

  private fun writeMultipartField(
    output: java.io.OutputStream,
    boundary: String,
    name: String,
    value: String,
  ) {
    output.write("--$boundary\r\n".toByteArray(Charsets.UTF_8))
    output.write(
      "Content-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray(Charsets.UTF_8),
    )
  }

  private fun writeMultipartFile(
    output: java.io.OutputStream,
    boundary: String,
    fieldName: String,
    file: File,
    mimeType: String,
  ) {
    output.write("--$boundary\r\n".toByteArray(Charsets.UTF_8))
    output.write(
      (
        "Content-Disposition: form-data; name=\"$fieldName\"; filename=\"${file.name}\"\r\n" +
          "Content-Type: $mimeType\r\n\r\n"
      ).toByteArray(Charsets.UTF_8),
    )
    file.inputStream().use { input -> input.copyTo(output) }
    output.write("\r\n".toByteArray(Charsets.UTF_8))
  }

  /** @deprecated Use submitDelayRemark with photo capture instead */
  fun submitDecline(
    config: OverlayConfig,
    reason: String,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    executor.execute {
      try {
        val url = URL(declineUrl(config))
        val payload =
          JSONObject().apply {
            put("loan_id", config.loanId)
            put("customer_id", config.customerId)
            put("user_id", config.userId)
            put("reason", reason)
            if (config.remarkId > 0) {
              put("remark_id", config.remarkId)
            }
          }
        val response = postJson(url, config.authToken, payload)
        if (response.success) {
          mainHandler.post(onSuccess)
        } else {
          mainHandler.post { onError(response.message) }
        }
      } catch (e: Exception) {
        OverlayApiLogger.logError(
          "POST",
          declineUrl(config),
          null,
          e.message ?: "Could not submit reason",
          null,
        )
        mainHandler.post { onError(e.message ?: "Could not submit reason") }
      }
    }
  }

  private data class ApiResult(val success: Boolean, val message: String, val status: Int, val body: String)

  private fun nipCollectionUrl(config: OverlayConfig): String {
    return "${config.apiBaseUrl.trimEnd('/')}/nip-collection"
  }

  private fun collectionPaymentUrl(config: OverlayConfig, collectionId: Int): String {
    return "${config.apiBaseUrl.trimEnd('/')}/collection/payment/$collectionId"
  }

  private fun delayRemarkUrl(config: OverlayConfig): String {
    return "${config.apiBaseUrl.trimEnd('/')}/collection/delay-remarks/submit"
  }

  private fun declineUrl(config: OverlayConfig): String {
    return "${config.apiBaseUrl.trimEnd('/')}/attendance/delay-proximity/decline"
  }

  private fun putJson(url: URL, authToken: String, payload: JSONObject): ApiResult {
    OverlayApiLogger.logRequest("PUT", url.toString(), payload.toString())
    val connection =
      (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "PUT"
        connectTimeout = 15000
        readTimeout = 15000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        if (authToken.isNotBlank()) {
          setRequestProperty("Authorization", "Bearer $authToken")
        }
      }

    return try {
      OutputStreamWriter(connection.outputStream).use { it.write(payload.toString()) }
      readResponse(connection, "PUT", url.toString())
    } finally {
      connection.disconnect()
    }
  }

  private fun postJson(url: URL, authToken: String, payload: JSONObject): ApiResult {
    OverlayApiLogger.logRequest("POST", url.toString(), payload.toString())
    val connection =
      (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15000
        readTimeout = 15000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        if (authToken.isNotBlank()) {
          setRequestProperty("Authorization", "Bearer $authToken")
        }
      }

    return try {
      OutputStreamWriter(connection.outputStream).use { it.write(payload.toString()) }
      readResponse(connection, "POST", url.toString())
    } finally {
      connection.disconnect()
    }
  }

  private fun readResponse(connection: HttpURLConnection, method: String, url: String): ApiResult {
    val code = connection.responseCode
    val stream = if (code in 200..299) connection.inputStream else connection.errorStream
    val body =
      stream?.let { input ->
        BufferedReader(InputStreamReader(input)).use { it.readText() }
      } ?: ""

    val json = runCatching { JSONObject(body) }.getOrNull()
    val message =
      json?.optString("message")?.takeIf { it.isNotBlank() }
        ?: if (code in 200..299) "Success" else "HTTP $code"

    val success = code in 200..299 && (json == null || json.optBoolean("success", true))

    if (success) {
      OverlayApiLogger.logResponse(method, url, code, body.ifBlank { "{}" })
    } else {
      OverlayApiLogger.logError(method, url, code, message, body.ifBlank { null })
    }

    return ApiResult(success, message, code, body)
  }
}

data class OverlayConfig(
  val loanId: Int,
  val customerId: Int,
  val collectionId: Int,
  val remarkId: Int,
  val customerName: String,
  val customerNo: String,
  val customerPhone: String,
  val customerAddress: String,
  val balanceAmount: Double,
  val balanceAmountText: String,
  val distanceMeters: Double,
  val loanTypeName: String,
  val loanStatusName: String,
  val branchName: String,
  val lineName: String,
  val paymentKind: String,
  val apiBaseUrl: String,
  val authToken: String,
  val userId: Int,
  val latitude: Double,
  val longitude: Double,
  val radiusMeters: Int,
  val totalNearby: Int,
  val nearbyIndex: Int,
)

fun OverlayConfig.effectiveBalance(): Double {
  return balanceAmountText.toDoubleOrNull()?.takeIf { it > 0 }
    ?: balanceAmount.takeIf { it > 0 }
    ?: 0.0
}

fun OverlayConfig.hasCollectibleBalance(): Boolean = effectiveBalance() > 0
