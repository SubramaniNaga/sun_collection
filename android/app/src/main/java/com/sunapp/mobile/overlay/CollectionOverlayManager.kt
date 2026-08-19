package com.sunapp.mobile.overlay

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputFilter
import android.text.method.DigitsKeyListener
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.TextView
import com.sunapp.mobile.R

object CollectionOverlayManager {
  private var overlayView: View? = null
  private var windowManager: WindowManager? = null
  private var nearbyItems: List<OverlayConfig> = emptyList()
  private var currentIndex: Int = 0
  private val mainHandler = Handler(Looper.getMainLooper())

  fun canDrawOverlays(context: Context): Boolean {
    return Settings.canDrawOverlays(context.applicationContext)
  }

  fun hide(context: Context) {
    mainHandler.post {
      val wm =
        windowManager
          ?: context.applicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val view = overlayView ?: return@post
      runCatching { wm.removeView(view) }
      overlayView = null
      windowManager = null
      nearbyItems = emptyList()
      currentIndex = 0
    }
  }

  fun show(context: Context, items: List<OverlayConfig>) {
    mainHandler.post {
      showInternal(context.applicationContext, items)
    }
  }

  private fun showInternal(appContext: Context, items: List<OverlayConfig>) {
    if (!canDrawOverlays(appContext) || items.isEmpty()) {
      return
    }

    val wm = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    overlayView?.let { existing ->
      runCatching { wm.removeView(existing) }
    }
    overlayView = null
    nearbyItems = items
    currentIndex = 0
    windowManager = wm

    val inflater = LayoutInflater.from(appContext)
    val view = inflater.inflate(R.layout.overlay_collection_popup, null)
    overlayView = view

    bindView(view, appContext)

    val layoutType =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      }

    val params =
      WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.WRAP_CONTENT,
          layoutType,
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
          PixelFormat.TRANSLUCENT,
        )
        .apply {
          gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
          y = 48
        }

    runCatching { wm.addView(view, params) }
  }

  private fun bindView(view: View, context: Context) {
    val title = view.findViewById<TextView>(R.id.overlay_title)
    val subtitle = view.findViewById<TextView>(R.id.overlay_subtitle)
    val customerIndex = view.findViewById<TextView>(R.id.overlay_customer_index)
    val customerName = view.findViewById<TextView>(R.id.overlay_customer_name)
    val customerPhone = view.findViewById<TextView>(R.id.overlay_customer_phone)
    val btnCall = view.findViewById<ImageButton>(R.id.overlay_btn_call)
    val loanInfo = view.findViewById<TextView>(R.id.overlay_loan_info)
    val balanceAmount = view.findViewById<TextView>(R.id.overlay_balance_amount)
    val distance = view.findViewById<TextView>(R.id.overlay_distance)
    val close = view.findViewById<TextView>(R.id.overlay_close)

    val panelMain = view.findViewById<LinearLayout>(R.id.overlay_panel_main)
    val panelAmount = view.findViewById<LinearLayout>(R.id.overlay_panel_amount)
    val panelReason = view.findViewById<LinearLayout>(R.id.overlay_panel_reason)

    val btnPrev = view.findViewById<Button>(R.id.overlay_btn_prev)
    val btnNext = view.findViewById<Button>(R.id.overlay_btn_next)
    val btnCollect = view.findViewById<Button>(R.id.overlay_btn_collect)
    val btnNotCollect = view.findViewById<Button>(R.id.overlay_btn_not_collect)

    val amountInput = view.findViewById<EditText>(R.id.overlay_amount_input)
    amountInput.keyListener = DigitsKeyListener.getInstance("0123456789.")
    amountInput.filters =
      arrayOf(
        InputFilter { source, _, _, _, _, _ ->
          if (source.toString().contains("-")) "" else null
        },
      )
    val amountHint = view.findViewById<TextView>(R.id.overlay_amount_hint)
    val paymentCash = view.findViewById<RadioButton>(R.id.overlay_payment_cash)
    val paymentOnline = view.findViewById<RadioButton>(R.id.overlay_payment_online)
    val amountBack = view.findViewById<Button>(R.id.overlay_amount_back)
    val amountSubmit = view.findViewById<Button>(R.id.overlay_amount_submit)

    val reasonInput = view.findViewById<EditText>(R.id.overlay_reason_input)
    val reasonBack = view.findViewById<Button>(R.id.overlay_reason_back)
    val reasonSubmit = view.findViewById<Button>(R.id.overlay_reason_submit)

    val status = view.findViewById<TextView>(R.id.overlay_status)
    val progress = view.findViewById<ProgressBar>(R.id.overlay_progress)

    fun isActive(): Boolean = overlayView === view

    fun currentConfig(): OverlayConfig? = nearbyItems.getOrNull(currentIndex)

    fun showPanel(target: String) {
      if (!isActive()) return
      panelMain.visibility = if (target == "main") View.VISIBLE else View.GONE
      panelAmount.visibility = if (target == "amount") View.VISIBLE else View.GONE
      panelReason.visibility = if (target == "reason") View.VISIBLE else View.GONE
      status.visibility = View.GONE
    }

    fun setBusy(busy: Boolean) {
      if (!isActive()) return
      progress.visibility = if (busy) View.VISIBLE else View.GONE
      val config = currentConfig()
      val canCollect = !busy && config != null && effectiveBalance(config) > 0
      btnCollect.isEnabled = canCollect
      btnCollect.alpha = if (canCollect) 1f else 0.45f
      btnNotCollect.isEnabled = !busy
      btnPrev.isEnabled = !busy
      btnNext.isEnabled = !busy
      amountSubmit.isEnabled = !busy
      reasonSubmit.isEnabled = !busy
    }

    fun showMessage(message: String, isError: Boolean) {
      if (!isActive()) return
      status.text = message
      status.setTextColor(if (isError) Color.parseColor("#DC2626") else Color.parseColor("#059669"))
      status.visibility = View.VISIBLE
    }

    fun effectiveBalance(config: OverlayConfig): Double = config.effectiveBalance()

    fun validateCollectionAmount(amount: Double?, balance: Double): String? {
      if (balance <= 0) {
        return "Balance amount must be greater than 0"
      }
      if (amount == null) {
        return "Enter a valid amount"
      }
      if (amount <= 0) {
        return "Amount must be greater than 0"
      }
      if (amount > balance + 0.0001) {
        return "Amount cannot exceed balance of ₹${formatAmount(balance)}"
      }
      return null
    }

    fun renderCustomer() {
      val config = currentConfig() ?: return
      title.text = "Payment Collection Nearby"
      subtitle.text = "Customer within ${config.radiusMeters}m radius"

      if (config.totalNearby > 1) {
        customerIndex.visibility = View.VISIBLE
        customerIndex.text = "Customer ${currentIndex + 1} of ${config.totalNearby}"
        btnPrev.visibility = View.VISIBLE
        btnNext.visibility = View.VISIBLE
      } else {
        customerIndex.visibility = View.GONE
        btnPrev.visibility = View.GONE
        btnNext.visibility = View.GONE
      }

      val customerLabel =
        buildString {
          append(config.customerName)
          if (config.customerNo.isNotBlank()) {
            append(" (#")
            append(config.customerNo)
            append(')')
          }
        }
      customerName.text = customerLabel
      customerPhone.text =
        if (config.customerPhone.isNotBlank()) {
          config.customerPhone
        } else {
          "Phone not available"
        }

      val hasPhone = config.customerPhone.isNotBlank()
      btnCall.isEnabled = hasPhone
      btnCall.alpha = if (hasPhone) 1f else 0.4f
      btnCall.setOnClickListener {
        dialCustomer(context, config.customerPhone)
      }

      val loanParts =
        listOf(config.loanStatusName, config.loanTypeName, config.lineName, config.branchName)
          .filter { it.isNotBlank() }
      val idLine = "Loan ID: ${config.loanId} · Customer ID: ${config.customerId}"
      loanInfo.text =
        if (loanParts.isNotEmpty()) {
          "$idLine\n${loanParts.joinToString(" · ")}"
        } else {
          idLine
        }
      loanInfo.visibility = View.VISIBLE

      val balanceLabel =
        config.balanceAmountText.ifBlank { formatAmount(config.balanceAmount) }
      balanceAmount.text = "Balance Amount: ₹$balanceLabel"
      distance.text = "${formatDistance(config.distanceMeters)} away"
      if (config.customerAddress.isNotBlank()) {
        distance.text = "${distance.text}\n${config.customerAddress}"
      }

      val balance = effectiveBalance(config)
      val canCollect = balance > 0
      btnCollect.isEnabled = canCollect
      btnCollect.alpha = if (canCollect) 1f else 0.45f
    }

    renderCustomer()

    close.setOnClickListener { hide(context) }

    btnPrev.setOnClickListener {
      if (currentIndex > 0) {
        currentIndex -= 1
        renderCustomer()
        showPanel("main")
      }
    }

    btnNext.setOnClickListener {
      if (currentIndex < nearbyItems.lastIndex) {
        currentIndex += 1
        renderCustomer()
        showPanel("main")
      }
    }

    btnCollect.setOnClickListener {
      val config = currentConfig() ?: return@setOnClickListener
      val balance = effectiveBalance(config)
      if (balance <= 0) {
        showMessage("Balance amount must be greater than 0", true)
        return@setOnClickListener
      }

      amountHint.text = "Enter amount up to ₹${formatAmount(balance)}"
      amountInput.hint = "Max ₹${formatAmount(balance)}"
      amountInput.setText(formatAmount(balance))
      paymentCash.isChecked = true
      showPanel("amount")
    }

    btnNotCollect.setOnClickListener {
      reasonInput.setText("")
      showPanel("reason")
    }

    amountBack.setOnClickListener { showPanel("main") }
    reasonBack.setOnClickListener { showPanel("main") }

    amountSubmit.setOnClickListener {
      runCatching {
        val config = currentConfig() ?: return@setOnClickListener
        val balance = effectiveBalance(config)
        val raw = amountInput.text?.toString()?.trim().orEmpty()
        val amount = raw.toDoubleOrNull()

        val validationError = validateCollectionAmount(amount, balance)
        if (validationError != null || amount == null) {
          showMessage(validationError ?: "Enter a valid amount", true)
          return@setOnClickListener
        }

        val paymentType = if (paymentOnline.isChecked) "Online" else "Cash"
        setBusy(true)
        CollectionOverlayApi.submitPayment(
          config = config,
          amountPaid = amount,
          paymentType = paymentType,
          onSuccess = {
            mainHandler.post {
              if (!isActive()) return@post
              setBusy(false)
              showMessage("Payment submitted successfully", false)
              mainHandler.postDelayed({ hide(context) }, 900)
            }
          },
          onError = { msg ->
            mainHandler.post {
              if (!isActive()) return@post
              setBusy(false)
              showMessage(msg, true)
            }
          },
        )
      }.onFailure { err ->
        showMessage(err.message ?: "Submit failed", true)
        setBusy(false)
      }
    }

    reasonSubmit.setOnClickListener {
      runCatching {
        val config = currentConfig() ?: return@setOnClickListener
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        if (reason.length < 3) {
          showMessage("Please enter a reason", true)
          return@setOnClickListener
        }

        setBusy(true)
        CollectionOverlayApi.submitDecline(
          config = config,
          reason = reason,
          onSuccess = {
            mainHandler.post {
              if (!isActive()) return@post
              setBusy(false)
              showMessage("Reason submitted successfully", false)
              mainHandler.postDelayed({ hide(context) }, 900)
            }
          },
          onError = { msg ->
            mainHandler.post {
              if (!isActive()) return@post
              setBusy(false)
              showMessage(msg, true)
            }
          },
        )
      }.onFailure { err ->
        showMessage(err.message ?: "Submit failed", true)
        setBusy(false)
      }
    }
  }

  private fun formatAmount(value: Double): String {
    return if (value % 1.0 == 0.0) {
      value.toInt().toString()
    } else {
      String.format("%.2f", value)
    }
  }

  private fun formatDistance(value: Double): String {
    return if (value % 1.0 == 0.0) {
      "${value.toInt()}m"
    } else {
      String.format("%.1fm", value)
    }
  }

  private fun dialCustomer(context: Context, phone: String) {
    val sanitized = phone.filter { it.isDigit() || it == '+' }
    if (sanitized.isBlank()) return

    runCatching {
      val intent =
        Intent(Intent.ACTION_DIAL, Uri.parse("tel:$sanitized")).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      context.startActivity(intent)
    }
  }
}
