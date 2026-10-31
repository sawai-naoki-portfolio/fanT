package com.fant.instagramstories

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val INSTAGRAM_PACKAGE = "com.instagram.android"

/**
 * Shares a photo to Instagram Stories (SHR-03) with Instagram's ADD_TO_STORY intent:
 * the image as a sticker over background colours, read-only through this module's
 * file provider and granted to Instagram alone.
 */
class InstagramStoriesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InstagramStories")

    AsyncFunction("share") { fileUri: String, appId: String, topColor: String, bottomColor: String ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val path = Uri.parse(fileUri).path ?: return@AsyncFunction false
      val uri = FileProvider.getUriForFile(
        activity,
        "${activity.packageName}.instagramstories",
        File(path),
      )
      val intent = Intent("com.instagram.share.ADD_TO_STORY").apply {
        setPackage(INSTAGRAM_PACKAGE)
        type = "image/jpeg"
        putExtra("source_application", appId)
        putExtra("interactive_asset_uri", uri)
        putExtra("top_background_color", topColor)
        putExtra("bottom_background_color", bottomColor)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      if (activity.packageManager.resolveActivity(intent, 0) == null) return@AsyncFunction false
      activity.grantUriPermission(INSTAGRAM_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      activity.startActivity(intent)
      true
    }
  }
}
