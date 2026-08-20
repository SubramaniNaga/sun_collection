package com.sunapp.mobile.overlay

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputFilter
import android.text.method.DigitsKeyListener
import android.util.TypedValue
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.TextView
import com.sunapp.mobile.R
import kotlin.math.abs

object CollectionOverlayManager {
  private var overlayView: View? = null
  private var overlayLayoutParams: WindowManager.LayoutParams? = null
  private var windowManager: WindowManager? = null
  private var nearbyItems: List<OverlayConfig> = emptyList()
  private var currentIndex: Int = 0
  private var overlayImeEnabled: Boolean = false
  private var overlayCollapsed: Boolean = false
  private var savedBubbleX: Int = 0
  private var savedBubbleY: Int = 0
  private val mainHandler = Handler(Looper.getMainLooper())
  private const val BUBBLE_SIZE_DP = 48
  private const val EXPANDED_MARGIN_DP = 10

  fun canDrawOverlays(context: Context): Boolean {
    return Settings.canDrawOverlays(context.applicationContext)
  }

  fun hide(context: Context) {
    mainHandler.post {
      disableOverlayIme()
      val wm =
        windowManager
          ?: context.applicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val view = overlayView ?: return@post
      runCatching { wm.removeView(view) }
      overlayView = null
      windowManager = null
      overlayLayoutParams = null
      nearbyItems = emptyList()
      currentIndex = 0
      overlayImeEnabled = false
      overlayCollapsed = false
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
    overlayImeEnabled = false
    overlayCollapsed = false
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

    val (screenWidth, screenHeight) = screenSize(appContext)
    savedBubbleX = screenWidth - dpToPx(appContext, BUBBLE_SIZE_DP + EXPANDED_MARGIN_DP)
    savedBubbleY = dpToPx(appContext, 120).coerceAtMost(screenHeight / 3)

    val params =
      WindowManager.LayoutParams().apply {
        width = expandedOverlayWidth(appContext)
        height = WindowManager.LayoutParams.WRAP_CONTENT
        type = layoutType
        format = PixelFormat.TRANSLUCENT
        gravity = Gravity.TOP or Gravity.START
        x = dpToPx(appContext, EXPANDED_MARGIN_DP)
        y = dpToPx(appContext, 48)
        flags =
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        softInputMode =
          WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN or
            WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
      }

    overlayLayoutParams = params
    runCatching { wm.addView(view, params) }
  }

  private fun detachOverlayView() {
    val wm = windowManager ?: return
    val view = overlayView ?: return
    if (view.parent == null) return
    runCatching { wm.removeView(view) }
  }

  private fun attachOverlayView(context: Context) {
    val view = overlayView ?: return
    val params = overlayLayoutParams ?: return
    if (view.parent != null) return

    val wm =
      windowManager
        ?: context.applicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    windowManager = wm
    runCatching { wm.addView(view, params) }
  }

  /**
   * Overlay starts as FLAG_NOT_FOCUSABLE so it does not steal keys from the app below.
   * IME cannot attach until that flag is cleared, so we enable focus only while typing.
   */
  private fun setOverlayImeFocusable(focusable: Boolean) {
    val view = overlayView ?: return
    val params = overlayLayoutParams ?: return
    val wm = windowManager ?: return
    if (view.parent == null) return
    if (focusable && overlayCollapsed) return
    if (overlayImeEnabled == focusable) return

    overlayImeEnabled = focusable
    if (focusable) {
      params.flags = params.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
      params.softInputMode =
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN or
          WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
      runCatching {
        wm.removeViewImmediate(view)
        wm.addView(view, params)
      }.onFailure {
        runCatching { wm.updateViewLayout(view, params) }
      }
    } else {
      params.flags = params.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
      params.softInputMode =
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN or
          WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
      runCatching { wm.updateViewLayout(view, params) }
    }
  }

  private fun enableOverlayIme(editText: EditText) {
    setOverlayImeFocusable(true)
    editText.isFocusable = true
    editText.isFocusableInTouchMode = true
    editText.post {
      if (overlayView == null) return@post
      editText.requestFocus()
      val imm =
        editText.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        editText.windowInsetsController?.show(WindowInsets.Type.ime())
      }
      imm.showSoftInput(editText, InputMethodManager.SHOW_IMPLICIT)
    }
  }

  private fun disableOverlayIme() {
    val view = overlayView
    if (view != null) {
      val imm = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
      imm.hideSoftInputFromWindow(view.windowToken, 0)
      view.clearFocus()
    }
    setOverlayImeFocusable(false)
  }

  private fun wireOverlayEditText(editText: EditText) {
    editText.isFocusable = true
    editText.isFocusableInTouchMode = true
    editText.showSoftInputOnFocus = true
    editText.setOnTouchListener { v, event ->
      if (event.action == MotionEvent.ACTION_DOWN) {
        enableOverlayIme(v as EditText)
      }
      false
    }
  }

  /** Remove overlay from screen before opening camera/dialer; run action after window is gone. */
  private fun suspendOverlayForExternalUi(afterHidden: () -> Unit) {
    mainHandler.post {
      disableOverlayIme()
      detachOverlayView()
      mainHandler.post(afterHidden)
    }
  }

  private fun dpToPx(context: Context, dp: Int): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      dp.toFloat(),
      context.resources.displayMetrics,
    ).toInt()
  }

  private fun screenSize(context: Context): Pair<Int, Int> {
    val metrics = context.resources.displayMetrics
    return metrics.widthPixels to metrics.heightPixels
  }

  private fun expandedOverlayWidth(context: Context): Int {
    val (screenWidth, _) = screenSize(context)
    return (screenWidth - dpToPx(context, EXPANDED_MARGIN_DP * 2)).coerceAtLeast(dpToPx(context, 240))
  }

  private fun clampOverlayPosition(context: Context, params: WindowManager.LayoutParams) {
    val view = overlayView
    val (screenWidth, screenHeight) = screenSize(context)
    val viewWidth =
      when {
        view != null && view.width > 0 -> view.width
        params.width > 0 -> params.width
        overlayCollapsed -> dpToPx(context, BUBBLE_SIZE_DP)
        else -> expandedOverlayWidth(context)
      }
    val viewHeight =
      when {
        view != null && view.height > 0 -> view.height
        params.height > 0 -> params.height
        overlayCollapsed -> dpToPx(context, BUBBLE_SIZE_DP)
        else -> dpToPx(context, 200)
      }
    val maxX = (screenWidth - viewWidth).coerceAtLeast(0)
    val maxY = (screenHeight - viewHeight).coerceAtLeast(0)
    params.x = params.x.coerceIn(0, maxX)
    params.y = params.y.coerceIn(0, maxY)
  }

  private fun snapBubbleToEdge(context: Context) {
    val params = overlayLayoutParams ?: return
    val view = overlayView ?: return
    val wm = windowManager ?: return
    val (screenWidth, _) = screenSize(context)
    val bubbleWidth = if (view.width > 0) view.width else dpToPx(context, BUBBLE_SIZE_DP)
    params.x = if (params.x + bubbleWidth / 2 < screenWidth / 2) {
      dpToPx(context, EXPANDED_MARGIN_DP)
    } else {
      screenWidth - bubbleWidth - dpToPx(context, EXPANDED_MARGIN_DP)
    }
    clampOverlayPosition(context, params)
    savedBubbleX = params.x
    savedBubbleY = params.y
    if (view.parent != null) {
      runCatching { wm.updateViewLayout(view, params) }
    }
  }

  private fun applyOverlayCollapsed(context: Context, collapsed: Boolean) {
    val view = overlayView ?: return
    val params = overlayLayoutParams ?: return
    val wm = windowManager ?: return
    val bubble = view.findViewById<View>(R.id.overlay_bubble) ?: return
    val card = view.findViewById<View>(R.id.overlay_card) ?: return

    overlayCollapsed = collapsed
    if (collapsed) {
      disableOverlayIme()
      savedBubbleY = params.y
      card.visibility = View.GONE
      bubble.visibility = View.VISIBLE
      val size = dpToPx(context, BUBBLE_SIZE_DP)
      params.width = size
      params.height = size
      params.x = savedBubbleX
      params.y = savedBubbleY
      clampOverlayPosition(context, params)
      savedBubbleX = params.x
      savedBubbleY = params.y
    } else {
      bubble.visibility = View.GONE
      card.visibility = View.VISIBLE
      params.width = expandedOverlayWidth(context)
      params.height = WindowManager.LayoutParams.WRAP_CONTENT
      params.x = dpToPx(context, EXPANDED_MARGIN_DP)
      params.y = savedBubbleY.coerceAtLeast(dpToPx(context, 24))
      clampOverlayPosition(context, params)
    }

    if (view.parent != null) {
      runCatching { wm.updateViewLayout(view, params) }
    }
  }

  private fun attachCardDrag(card: OverlayDragLayout, context: Context) {
    var startX = 0
    var startY = 0
    var gestureStarted = false
    card.dragListener =
      OverlayDragLayout.DragListener { rawX, rawY, downRawX, downRawY, ended ->
        val params = overlayLayoutParams ?: return@DragListener
        val wm = windowManager ?: return@DragListener
        val overlay = overlayView ?: return@DragListener
        if (!gestureStarted) {
          gestureStarted = true
          startX = params.x
          startY = params.y
        }
        params.x = startX + (rawX - downRawX).toInt()
        params.y = startY + (rawY - downRawY).toInt()
        clampOverlayPosition(context, params)
        runCatching { wm.updateViewLayout(overlay, params) }
        if (ended) {
          savedBubbleY = params.y
          gestureStarted = false
        }
      }
  }

  private fun attachMoveAndClick(target: View, onClick: (() -> Unit)? = null) {
    val slop = ViewConfiguration.get(target.context).scaledTouchSlop
    var startX = 0
    var startY = 0
    var downRawX = 0f
    var downRawY = 0f
    var dragging = false

    target.setOnTouchListener { _, event ->
      val params = overlayLayoutParams ?: return@setOnTouchListener false
      val wm = windowManager ?: return@setOnTouchListener false
      val overlay = overlayView ?: return@setOnTouchListener false

      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          dragging = false
          startX = params.x
          startY = params.y
          downRawX = event.rawX
          downRawY = event.rawY
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - downRawX).toInt()
          val dy = (event.rawY - downRawY).toInt()
          if (!dragging && (abs(dx) > slop || abs(dy) > slop)) {
            dragging = true
          }
          if (dragging) {
            params.x = startX + dx
            params.y = startY + dy
            clampOverlayPosition(target.context, params)
            runCatching { wm.updateViewLayout(overlay, params) }
          }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (dragging) {
            if (overlayCollapsed) {
              snapBubbleToEdge(target.context)
            } else {
              savedBubbleY = params.y
            }
            true
          } else if (event.actionMasked == MotionEvent.ACTION_UP && onClick != null) {
            onClick()
            true
          } else {
            onClick != null
          }
        }
        else -> false
      }
    }
  }

  private fun bindView(view: View, context: Context) {
    val title = view.findViewById<TextView>(R.id.overlay_title)
    //val subtitle = view.findViewById<TextView>(R.id.overlay_subtitle)
    val customerIndex = view.findViewById<TextView>(R.id.overlay_customer_index)
    val customerName = view.findViewById<TextView>(R.id.overlay_customer_name)
    val btnCall = view.findViewById<ImageButton>(R.id.overlay_btn_call)
    val loanInfo = view.findViewById<TextView>(R.id.overlay_loan_info)
    val balanceAmount = view.findViewById<TextView>(R.id.overlay_balance_amount)
    val distance = view.findViewById<TextView>(R.id.overlay_distance)
    val close = view.findViewById<TextView>(R.id.overlay_close)
    val collapse = view.findViewById<TextView>(R.id.overlay_btn_collapse)
    val card = view.findViewById<OverlayDragLayout>(R.id.overlay_card)
    val bubble = view.findViewById<View>(R.id.overlay_bubble)
    val bubbleBadge = view.findViewById<TextView>(R.id.overlay_bubble_badge)

    val panelMain = view.findViewById<LinearLayout>(R.id.overlay_panel_main)
    val panelAmount = view.findViewById<LinearLayout>(R.id.overlay_panel_amount)
    val panelReason = view.findViewById<LinearLayout>(R.id.overlay_panel_reason)

    val btnPrev = view.findViewById<Button>(R.id.overlay_btn_prev)
    val btnNext = view.findViewById<Button>(R.id.overlay_btn_next)
    val btnCollect = view.findViewById<Button>(R.id.overlay_btn_collect)
    val btnNotCollect = view.findViewById<Button>(R.id.overlay_btn_not_collect)

    val amountInput = view.findViewById<EditText>(R.id.overlay_amount_input)
    wireOverlayEditText(amountInput)
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
    wireOverlayEditText(reasonInput)
    val photoStatus = view.findViewById<TextView>(R.id.overlay_photo_status)
    val photoPreview = view.findViewById<ImageView>(R.id.overlay_photo_preview)
    val btnCapturePhoto = view.findViewById<Button>(R.id.overlay_btn_capture_photo)
    val reasonBack = view.findViewById<Button>(R.id.overlay_reason_back)
    val reasonSubmit = view.findViewById<Button>(R.id.overlay_reason_submit)

    val status = view.findViewById<TextView>(R.id.overlay_status)
    val progress = view.findViewById<ProgressBar>(R.id.overlay_progress)

    var capturedPhotoPath: String? = null

    fun isActive(): Boolean = overlayView === view

    fun currentConfig(): OverlayConfig? = nearbyItems.getOrNull(currentIndex)

    fun showPanel(target: String) {
      if (!isActive()) return
      panelMain.visibility = if (target == "main") View.VISIBLE else View.GONE
      panelAmount.visibility = if (target == "amount") View.VISIBLE else View.GONE
      panelReason.visibility = if (target == "reason") View.VISIBLE else View.GONE
      status.visibility = View.GONE
      if (target == "main") {
        disableOverlayIme()
      } else {
        setOverlayImeFocusable(true)
      }
    }

    fun showMessage(message: String, isError: Boolean) {
      if (!isActive()) return
      status.text = message
      status.setTextColor(if (isError) Color.parseColor("#FFD0D0") else Color.parseColor("#C8F5D4"))
      status.visibility = View.VISIBLE
    }

    fun setBusy(busy: Boolean) {
      if (!isActive()) return
      progress.visibility = if (busy) View.VISIBLE else View.GONE
      val config = currentConfig()
      val canCollect = !busy && config != null && config.effectiveBalance() > 0
      btnCollect.isEnabled = canCollect
      btnCollect.alpha = if (canCollect) 1f else 0.45f
      btnNotCollect.isEnabled = !busy
      btnPrev.isEnabled = !busy
      btnNext.isEnabled = !busy
      amountSubmit.isEnabled = !busy
      reasonSubmit.isEnabled = !busy
      btnCapturePhoto.isEnabled = !busy
    }

    fun updatePhotoUi() {
      if (capturedPhotoPath.isNullOrBlank()) {
        photoPreview.visibility = View.GONE
        photoStatus.text = "Photo required"
        photoStatus.setTextColor(Color.parseColor("#D4E6F8"))
        btnCapturePhoto.text = "Photo"
        return
      }

      photoPreview.visibility = View.VISIBLE
      photoStatus.text = "Photo captured"
      photoStatus.setTextColor(Color.parseColor("#C8F5D4"))
      btnCapturePhoto.text = "Retake"
      runCatching {
        val bitmap = BitmapFactory.decodeFile(capturedPhotoPath)
        if (bitmap != null) {
          photoPreview.setImageBitmap(bitmap)
        }
      }
    }

    fun launchPhotoCapture(onDone: (Boolean) -> Unit) {
      OverlayCameraBridge.requestCapture { path ->
        mainHandler.post {
          attachOverlayView(context)
          if (!isActive()) {
            onDone(false)
            return@post
          }
          if (path.isNullOrBlank()) {
            showMessage("Photo capture cancelled", true)
            onDone(false)
            return@post
          }
          capturedPhotoPath = path
          updatePhotoUi()
          onDone(true)
        }
      }

      val intent =
        Intent(context, OverlayCaptureActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

      suspendOverlayForExternalUi {
        runCatching { context.startActivity(intent) }
          .onFailure {
            OverlayCameraBridge.cancelPending()
            attachOverlayView(context)
            showMessage("Unable to open camera", true)
            onDone(false)
          }
      }
    }

    fun submitDelayRemarkRequest(config: OverlayConfig, description: String, photoPath: String) {
      setBusy(true)
      CollectionOverlayApi.submitDelayRemark(
        config = config,
        description = description,
        photoPath = photoPath,
        onSuccess = {
          mainHandler.post {
            if (!isActive()) return@post
            setBusy(false)
            showMessage("Delay remark submitted successfully", false)
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
    }

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
      title.text = "Nearby Collection"

      if (config.totalNearby > 1) {
        customerIndex.visibility = View.VISIBLE
        customerIndex.text = "${currentIndex + 1}/${config.totalNearby}"
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

      val balance = config.effectiveBalance()
      val canCollect = balance > 0
      btnCollect.isEnabled = canCollect
      btnCollect.alpha = if (canCollect) 1f else 0.45f

      val nearbyCount = nearbyItems.size.coerceAtLeast(1)
      bubbleBadge.text = if (nearbyCount > 9) "9+" else nearbyCount.toString()
      bubbleBadge.visibility = View.VISIBLE
    }

    renderCustomer()

    close.setOnClickListener { hide(context) }
    collapse.setOnClickListener { applyOverlayCollapsed(context, true) }
    attachCardDrag(card, context)
    attachMoveAndClick(bubble) { applyOverlayCollapsed(context, false) }

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
      val balance = config.effectiveBalance()
      if (balance <= 0) {
        showMessage("Balance amount must be greater than 0", true)
        return@setOnClickListener
      }

      amountHint.text = "Max ₹${formatAmount(balance)}"
      amountInput.hint = "Max ₹${formatAmount(balance)}"
      amountInput.setText(formatAmount(balance))
      paymentCash.isChecked = true
      showPanel("amount")
    }

    btnNotCollect.setOnClickListener {
      reasonInput.setText("")
      capturedPhotoPath = null
      updatePhotoUi()
      showPanel("reason")
    }

    amountBack.setOnClickListener { showPanel("main") }
    reasonBack.setOnClickListener { showPanel("main") }

    amountSubmit.setOnClickListener {
      runCatching {
        val config = currentConfig() ?: return@setOnClickListener
        val balance = config.effectiveBalance()
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

    btnCapturePhoto.setOnClickListener {
      launchPhotoCapture { }
    }

    reasonSubmit.setOnClickListener {
      runCatching {
        val config = currentConfig() ?: return@setOnClickListener
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        if (reason.length < 3) {
          showMessage("Please enter a reason", true)
          return@setOnClickListener
        }
        if (config.remarkId <= 0) {
          showMessage("Invalid remark id for this customer", true)
          return@setOnClickListener
        }

        val photoPath = capturedPhotoPath
        if (photoPath.isNullOrBlank()) {
          launchPhotoCapture { captured ->
            if (captured && !capturedPhotoPath.isNullOrBlank()) {
              submitDelayRemarkRequest(config, reason, capturedPhotoPath!!)
            }
          }
          return@setOnClickListener
        }

        submitDelayRemarkRequest(config, reason, photoPath)
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
