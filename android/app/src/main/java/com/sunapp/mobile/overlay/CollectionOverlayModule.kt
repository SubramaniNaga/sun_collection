package com.sunapp.mobile.overlay

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class CollectionOverlayModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    OverlayApiLogger.init(reactContext)
  }

  override fun getName(): String = "CollectionOverlay"

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter
  }

  @ReactMethod
  fun canDrawOverlays(promise: Promise) {
    promise.resolve(CollectionOverlayManager.canDrawOverlays(reactApplicationContext))
  }

  @ReactMethod
  fun requestOverlayPermission() {
    val context = reactApplicationContext
    if (CollectionOverlayManager.canDrawOverlays(context)) return

    val intent =
      Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}"),
        )
        .apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    context.startActivity(intent)
  }

  @ReactMethod
  fun hideOverlay() {
    CollectionOverlayManager.hide(reactApplicationContext)
  }

  @ReactMethod
  fun showOverlay(config: ReadableMap, promise: Promise) {
    try {
      if (!CollectionOverlayManager.canDrawOverlays(reactApplicationContext)) {
        promise.reject("NO_PERMISSION", "Display over other apps permission is not granted")
        return
      }

      val nearby = config.getArray("nearby")
      if (nearby == null || nearby.size() == 0) {
        promise.reject("NO_DATA", "No nearby collection data")
        return
      }

      val parsed = ArrayList<OverlayConfig>()
      for (index in 0 until nearby.size()) {
        val item = nearby.getMap(index) ?: continue
        if (!OverlayMapReader.hasCollectibleBalance(item)) continue

        val loanId =
          OverlayMapReader.readInt(item, "loan_id", OverlayMapReader.readInt(OverlayMapReader.getMap(item, "loan"), "id", 0))
        val customerId =
          OverlayMapReader.readInt(
            item,
            "customer_id",
            OverlayMapReader.readInt(OverlayMapReader.getMap(item, "customer"), "id", 0),
          )
        val collectionId = OverlayMapReader.readInt(item, "collection_id", 0)
        if (loanId <= 0 && customerId <= 0 && collectionId <= 0) continue

        parsed.add(parseOverlayConfig(config, item, 0, 1))
      }

      if (parsed.isEmpty()) {
        promise.reject("NO_DATA", "No nearby customers with balance amount greater than 0")
        return
      }

      val items =
        parsed.mapIndexed { index, item ->
          item.copy(totalNearby = parsed.size, nearbyIndex = index)
        }

      CollectionOverlayManager.show(reactApplicationContext, items)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SHOW_FAILED", e.message, e)
    }
  }

  private fun parseOverlayConfig(
    root: ReadableMap,
    item: ReadableMap,
    index: Int,
    total: Int,
  ): OverlayConfig {
    val customerMap = OverlayMapReader.getMap(item, "customer")
    val loanMap = OverlayMapReader.getMap(item, "loan")

    val loanId =
      OverlayMapReader.readInt(item, "loan_id", OverlayMapReader.readInt(loanMap, "id", 0))
    val customerId =
      OverlayMapReader.readInt(
        item,
        "customer_id",
        OverlayMapReader.readInt(customerMap, "id", 0),
      )
    val collectionId = OverlayMapReader.readInt(item, "collection_id", 0)
    val paymentKind =
      OverlayMapReader.readString(item, "payment_kind", if (loanId > 0) "nip" else "collection")

    val balanceText = OverlayMapReader.readBalanceText(item)
    val balanceAmount = OverlayMapReader.readBalanceAmount(item)

    return OverlayConfig(
      loanId = loanId,
      customerId = customerId,
      collectionId = collectionId,
      remarkId = OverlayMapReader.readInt(item, "remark_id", 0),
      customerName =
        OverlayMapReader.readString(
          item,
          "customer_name",
          OverlayMapReader.readString(customerMap, "customer_name", "Customer"),
        ),
      customerNo =
        OverlayMapReader.readString(
          item,
          "customer_no",
          OverlayMapReader.readString(customerMap, "customer_no", ""),
        ),
      customerPhone =
        OverlayMapReader.readString(
          item,
          "customer_phone",
          OverlayMapReader.readString(customerMap, "customer_phone", ""),
        ),
      customerAddress =
        OverlayMapReader.readString(
          item,
          "customer_address",
          OverlayMapReader.readString(customerMap, "customer_address", ""),
        ),
      balanceAmount = balanceAmount,
      balanceAmountText = balanceText,
      distanceMeters =
        OverlayMapReader.readDouble(item, "distance_meters", OverlayMapReader.readDouble(item, "distance", 0.0)),
      loanTypeName =
        OverlayMapReader.readString(
          item,
          "loan_type_name",
          OverlayMapReader.readString(loanMap, "loan_type_name", ""),
        ),
      loanStatusName =
        OverlayMapReader.readString(
          item,
          "loan_status_name",
          OverlayMapReader.readString(loanMap, "loan_status_name", ""),
        ),
      branchName =
        OverlayMapReader.readString(
          item,
          "branch_name",
          OverlayMapReader.readString(loanMap, "branch_name", ""),
        ),
      lineName =
        OverlayMapReader.readString(
          item,
          "line_name",
          OverlayMapReader.readString(loanMap, "line_name", ""),
        ),
      paymentKind = paymentKind,
      apiBaseUrl = OverlayMapReader.readString(root, "apiBaseUrl", ""),
      authToken = OverlayMapReader.readString(root, "authToken", ""),
      userId = OverlayMapReader.readInt(root, "userId", 0),
      latitude = OverlayMapReader.readDouble(root, "latitude"),
      longitude = OverlayMapReader.readDouble(root, "longitude"),
      radiusMeters = OverlayMapReader.readInt(root, "radiusMeters", 500),
      totalNearby = total,
      nearbyIndex = index,
    )
  }
}
