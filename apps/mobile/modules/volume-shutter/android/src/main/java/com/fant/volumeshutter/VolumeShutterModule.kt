package com.fant.volumeshutter

import android.app.Activity
import android.view.KeyEvent
import androidx.core.view.ViewCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reports volume-key presses while the camera is open, so they can take a photo
 * (CAM-03). The keys are consumed only while enabled, so the volume does not change
 * when shooting; everywhere else they work as usual.
 */
class VolumeShutterModule : Module() {
  private var listener: ViewCompat.OnUnhandledKeyEventListenerCompat? = null

  override fun definition() = ModuleDefinition {
    Name("VolumeShutter")

    Events("onPress")

    Function("setEnabled") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        if (enabled) attach(activity) else detach(activity)
      }
    }

    OnActivityDestroys {
      listener = null
    }
  }

  private fun attach(activity: Activity) {
    if (listener != null) return
    val created = ViewCompat.OnUnhandledKeyEventListenerCompat { _, event ->
      val volumeKey = event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || event.keyCode == KeyEvent.KEYCODE_VOLUME_UP
      if (volumeKey && event.action == KeyEvent.ACTION_UP && event.repeatCount == 0) {
        sendEvent("onPress", mapOf<String, Any?>())
      }
      volumeKey
    }
    ViewCompat.addOnUnhandledKeyEventListener(activity.window.decorView, created)
    listener = created
  }

  private fun detach(activity: Activity) {
    val current = listener ?: return
    ViewCompat.removeOnUnhandledKeyEventListener(activity.window.decorView, current)
    listener = null
  }
}
