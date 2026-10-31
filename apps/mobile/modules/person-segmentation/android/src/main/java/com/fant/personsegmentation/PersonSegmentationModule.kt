package com.fant.personsegmentation

import android.graphics.Bitmap
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

/**
 * Cuts people out of a photo for puri backgrounds (PRI-04) with ML Kit selfie
 * segmentation, on the device. Writes a PNG beside the photo: white, with alpha
 * the confidence that a pixel shows a person.
 */
class PersonSegmentationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PersonSegmentation")

    AsyncFunction("segment") { fileUri: String, promise: Promise ->
      val context = appContext.reactContext
      val path = Uri.parse(fileUri).path
      if (context == null || path == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      val input = File(path)
      val image = try {
        InputImage.fromFilePath(context, Uri.fromFile(input))
      } catch (error: Exception) {
        promise.resolve(null)
        return@AsyncFunction
      }
      val segmenter = Segmentation.getClient(
        SelfieSegmenterOptions.Builder()
          .setDetectorMode(SelfieSegmenterOptions.SINGLE_IMAGE_MODE)
          .build(),
      )
      segmenter.process(image)
        .addOnSuccessListener { mask ->
          try {
            val width = mask.width
            val height = mask.height
            val confidences = mask.buffer
            confidences.rewind()
            val pixels = IntArray(width * height) {
              val alpha = (confidences.float * 255f).toInt().coerceIn(0, 255)
              (alpha shl 24) or 0x00FFFFFF
            }
            val bitmap = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
            val output = File(input.parentFile, "${input.nameWithoutExtension}.mask.png")
            FileOutputStream(output).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
            promise.resolve(Uri.fromFile(output).toString())
          } catch (error: Exception) {
            promise.resolve(null)
          } finally {
            segmenter.close()
          }
        }
        .addOnFailureListener {
          segmenter.close()
          promise.resolve(null)
        }
    }
  }
}
