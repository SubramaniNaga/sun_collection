package com.sunapp.mobile.overlay

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.widget.LinearLayout
import kotlin.math.abs

/**
 * Lets the overlay card be dragged from anywhere. Children still receive taps;
 * a drag starts only after the touch moves past the system slop.
 */
class OverlayDragLayout @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
  defStyleAttr: Int = 0,
) : LinearLayout(context, attrs, defStyleAttr) {

  fun interface DragListener {
    fun onDrag(rawX: Float, rawY: Float, downRawX: Float, downRawY: Float, ended: Boolean)
  }

  var dragListener: DragListener? = null

  private val slop = ViewConfiguration.get(context).scaledTouchSlop
  private var downRawX = 0f
  private var downRawY = 0f
  private var dragging = false

  init {
    isClickable = true
  }

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    when (ev.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        dragging = false
        downRawX = ev.rawX
        downRawY = ev.rawY
        return false
      }
      MotionEvent.ACTION_MOVE -> {
        if (dragging) return true
        if (abs(ev.rawX - downRawX) > slop || abs(ev.rawY - downRawY) > slop) {
          dragging = true
          parent?.requestDisallowInterceptTouchEvent(true)
          dragListener?.onDrag(ev.rawX, ev.rawY, downRawX, downRawY, false)
          return true
        }
      }
    }
    return false
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downRawX = event.rawX
        downRawY = event.rawY
        dragging = false
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        if (!dragging && (abs(event.rawX - downRawX) > slop || abs(event.rawY - downRawY) > slop)) {
          dragging = true
        }
        if (dragging) {
          dragListener?.onDrag(event.rawX, event.rawY, downRawX, downRawY, false)
        }
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (dragging) {
          dragging = false
          dragListener?.onDrag(event.rawX, event.rawY, downRawX, downRawY, true)
          return true
        }
      }
    }
    return super.onTouchEvent(event)
  }
}
