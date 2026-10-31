package com.fant.rawdevelop

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max

/**
 * Develops a RAW photo (DNG) into a JPEG beside it (EDT-36), on the device, with
 * the platform's own decoder, at most `maxEdge` on its long edge so a large
 * sensor's image cannot exhaust memory.
 */
class RawDevelopModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RawDevelop")

    AsyncFunction("develop") { fileUri: String, maxEdge: Double ->
      val path = Uri.parse(fileUri).path ?: return@AsyncFunction null
      val input = File(path)
      val bitmap = try {
        decode(input, maxEdge.toInt())
      } catch (error: Exception) {
        null
      } ?: return@AsyncFunction null
      try {
        val output = File(input.parentFile, "${input.nameWithoutExtension}.developed.jpg")
        FileOutputStream(output).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        Uri.fromFile(output).toString()
      } catch (error: Exception) {
        null
      } finally {
        bitmap.recycle()
      }
    }
  }

  private fun decode(input: File, maxEdge: Int): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      return ImageDecoder.decodeBitmap(ImageDecoder.createSource(input)) { decoder, info, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        val longEdge = max(info.size.width, info.size.height)
        if (longEdge > maxEdge) {
          val scale = maxEdge.toDouble() / longEdge
          decoder.setTargetSize(
            (info.size.width * scale).toInt().coerceAtLeast(1),
            (info.size.height * scale).toInt().coerceAtLeast(1),
          )
        }
      }
    }
    // Before Android 9: measure first, then decode at a power-of-two reduction.
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(input.path, bounds)
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxEdge) sample *= 2
    return BitmapFactory.decodeFile(input.path, BitmapFactory.Options().apply { inSampleSize = sample })
  }
}
