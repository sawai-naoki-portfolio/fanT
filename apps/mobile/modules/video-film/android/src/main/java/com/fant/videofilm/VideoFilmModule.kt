package com.fant.videofilm

import android.graphics.Bitmap
import android.graphics.Color
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.SingleColorLut
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

/**
 * Short videos made on the device with Media3 Transformer: recordings coloured
 * with a film's 3D LUT (CAM-13), keeping their sound and orientation, and moving
 * photos encoded from their frames (EDT-37).
 */
class VideoFilmModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VideoFilm")

    AsyncFunction("applyLut") { inputUri: String, outputUri: String, size: Int, rgbaBase64: String, promise: Promise ->
      val rgba = Base64.decode(rgbaBase64, Base64.DEFAULT)
      if (size < 2 || rgba.size != size * size * size * 4) {
        promise.reject("E_VIDEO_ARGS", "Invalid LUT", null)
        return@AsyncFunction
      }
      applyLut(fileOf(inputUri), fileOf(outputUri), cubeOf(size, rgba), promise)
    }

    AsyncFunction("encodeFrames") { frameUris: List<String>, fps: Int, outputUri: String, promise: Promise ->
      if (frameUris.isEmpty() || fps <= 0) {
        promise.reject("E_VIDEO_ARGS", "No frames", null)
        return@AsyncFunction
      }
      encodeFrames(frameUris.map(::fileOf), fps, fileOf(outputUri), promise)
    }

    AsyncFunction("thumbnail") { videoUri: String, jpegUri: String, promise: Promise ->
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(fileOf(videoUri).path)
        // Frames come back upright (the retriever applies the rotation metadata).
        val frame = retriever.getFrameAtTime(0) ?: throw IllegalStateException("No frame")
        FileOutputStream(fileOf(jpegUri)).use { frame.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        val duration =
          retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        promise.resolve(mapOf("width" to frame.width, "height" to frame.height, "durationMs" to duration))
        frame.recycle()
      } catch (error: Exception) {
        promise.reject("E_VIDEO_THUMBNAIL", error.message, error)
      } finally {
        retriever.release()
      }
    }
  }

  private fun fileOf(uri: String): File = File(Uri.parse(uri).path ?: uri)

  /** The film shader's layout (x = blue slice × size + red, y = green) as cube[r][g][b]. */
  private fun cubeOf(size: Int, rgba: ByteArray): Array<Array<IntArray>> =
    Array(size) { r ->
      Array(size) { g ->
        IntArray(size) { b ->
          val i = (g * size * size + b * size + r) * 4
          Color.rgb(rgba[i].toInt() and 0xff, rgba[i + 1].toInt() and 0xff, rgba[i + 2].toInt() and 0xff)
        }
      }
    }

  @OptIn(UnstableApi::class)
  private fun applyLut(input: File, output: File, cube: Array<Array<IntArray>>, promise: Promise) {
    val item =
      EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(input)))
        .setEffects(Effects(listOf(), listOf(SingleColorLut.createFromCube(cube))))
        .build()
    export(Composition.Builder(EditedMediaItemSequence(listOf(item))).build(), output, promise)
  }

  /** Each frame is an image shown for one frame's time, in order. */
  @OptIn(UnstableApi::class)
  private fun encodeFrames(frames: List<File>, fps: Int, output: File, promise: Promise) {
    val frameMs = (1000L / fps).coerceAtLeast(1L)
    val items =
      frames.map { frame ->
        EditedMediaItem.Builder(
            MediaItem.Builder().setUri(Uri.fromFile(frame)).setImageDurationMs(frameMs).build())
          .setFrameRate(fps)
          .build()
      }
    export(Composition.Builder(EditedMediaItemSequence(items)).build(), output, promise)
  }

  @OptIn(UnstableApi::class)
  private fun export(composition: Composition, output: File, promise: Promise) {
    // Transformer runs on a thread with a Looper; the main one is simplest.
    Handler(Looper.getMainLooper()).post {
      output.delete()
      val transformer =
        Transformer.Builder(context)
          .addListener(
            object : Transformer.Listener {
              override fun onCompleted(composition: Composition, result: ExportResult) {
                promise.resolve(null)
              }

              override fun onError(composition: Composition, result: ExportResult, exception: ExportException) {
                promise.reject("E_VIDEO_EXPORT", exception.message, exception)
              }
            })
          .build()
      transformer.start(composition, output.path)
    }
  }
}
