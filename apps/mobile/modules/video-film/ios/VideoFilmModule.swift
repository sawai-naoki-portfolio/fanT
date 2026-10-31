import AVFoundation
import CoreImage
import ExpoModulesCore
import UIKit

/// Short videos made on the device: recordings coloured with a film's 3D LUT
/// (CAM-13), every frame through Core Image's colour cube while AVFoundation
/// re-encodes them with their sound and orientation, and moving photos encoded
/// from their frames (EDT-37).
public class VideoFilmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoFilm")

    AsyncFunction("applyLut") {
      (inputUri: String, outputUri: String, size: Int, rgbaBase64: String, promise: Promise) in
      guard let input = URL(string: inputUri), input.isFileURL,
        let output = URL(string: outputUri), output.isFileURL,
        let rgba = Data(base64Encoded: rgbaBase64), size >= 2, rgba.count == size * size * size * 4
      else {
        promise.reject("E_VIDEO_ARGS", "Invalid video or LUT")
        return
      }
      Self.applyLut(input: input, output: output, size: size, rgba: rgba, promise: promise)
    }

    AsyncFunction("encodeFrames") { (frameUris: [String], fps: Int, outputUri: String, promise: Promise) in
      let frames = frameUris.compactMap { URL(string: $0) }.filter { $0.isFileURL }
      guard let output = URL(string: outputUri), output.isFileURL, !frames.isEmpty,
        frames.count == frameUris.count, fps > 0
      else {
        promise.reject("E_VIDEO_ARGS", "Invalid frames")
        return
      }
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try Self.encodeFrames(frames, fps: fps, output: output)
          promise.resolve(nil)
        } catch {
          promise.reject("E_VIDEO_ENCODE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("thumbnail") { (videoUri: String, jpegUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let video = URL(string: videoUri), video.isFileURL,
          let jpeg = URL(string: jpegUri), jpeg.isFileURL
        else {
          promise.reject("E_VIDEO_ARGS", "Invalid file")
          return
        }
        let asset = AVURLAsset(url: video)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        do {
          let image = try generator.copyCGImage(at: .zero, actualTime: nil)
          guard let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.9) else {
            promise.reject("E_VIDEO_THUMBNAIL", "Could not encode the thumbnail")
            return
          }
          try data.write(to: jpeg)
          promise.resolve([
            "width": image.width,
            "height": image.height,
            "durationMs": Int(CMTimeGetSeconds(asset.duration) * 1000),
          ])
        } catch {
          promise.reject("E_VIDEO_THUMBNAIL", error.localizedDescription)
        }
      }
    }
  }

  private struct EncodeError: LocalizedError {
    let errorDescription: String?
  }

  /// Writes JPEG frames as an H.264 MP4, one per 1/`fps` second, at the first frame's size.
  private static func encodeFrames(_ frames: [URL], fps: Int, output: URL) throws {
    guard let first = UIImage(contentsOfFile: frames[0].path)?.cgImage else {
      throw EncodeError(errorDescription: "Unreadable frame")
    }
    // H.264 needs even sides.
    let width = first.width / 2 * 2
    let height = first.height / 2 * 2
    try? FileManager.default.removeItem(at: output)
    let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    let input = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
      ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ])
    guard writer.canAdd(input) else { throw EncodeError(errorDescription: "Cannot add video") }
    writer.add(input)
    guard writer.startWriting() else {
      throw writer.error ?? EncodeError(errorDescription: "Cannot start writing")
    }
    writer.startSession(atSourceTime: .zero)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    for (index, frame) in frames.enumerated() {
      guard let image = UIImage(contentsOfFile: frame.path)?.cgImage else {
        throw EncodeError(errorDescription: "Unreadable frame")
      }
      while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
      var buffer: CVPixelBuffer?
      guard let pool = adaptor.pixelBufferPool,
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess,
        let pixels = buffer
      else { throw EncodeError(errorDescription: "No pixel buffer") }
      CVPixelBufferLockBaseAddress(pixels, [])
      let context = CGContext(
        data: CVPixelBufferGetBaseAddress(pixels), width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixels), space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)
      context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      CVPixelBufferUnlockBaseAddress(pixels, [])
      let time = CMTime(value: CMTimeValue(index), timescale: CMTimeScale(fps))
      guard adaptor.append(pixels, withPresentationTime: time) else {
        throw writer.error ?? EncodeError(errorDescription: "Cannot write a frame")
      }
    }
    input.markAsFinished()
    let finished = DispatchSemaphore(value: 0)
    writer.finishWriting { finished.signal() }
    finished.wait()
    guard writer.status == .completed else {
      throw writer.error ?? EncodeError(errorDescription: "Cannot finish the video")
    }
  }

  /// The film shader's layout (x = blue slice × size + red, y = green) as Core Image's
  /// colour cube (red fastest, then green, then blue).
  private static func cubeData(size: Int, rgba: Data) -> Data {
    var cube = [Float](repeating: 0, count: size * size * size * 4)
    rgba.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
      for b in 0..<size {
        for g in 0..<size {
          for r in 0..<size {
            let source = (g * size * size + b * size + r) * 4
            let target = (b * size * size + g * size + r) * 4
            for channel in 0..<3 {
              cube[target + channel] = Float(bytes[source + channel]) / 255
            }
            cube[target + 3] = 1
          }
        }
      }
    }
    return cube.withUnsafeBufferPointer { Data(buffer: $0) }
  }

  private static func applyLut(input: URL, output: URL, size: Int, rgba: Data, promise: Promise) {
    let cube = cubeData(size: size, rgba: rgba)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
      promise.reject("E_VIDEO_LUT", "No sRGB colour space")
      return
    }
    let asset = AVURLAsset(url: input)
    let composition = AVMutableVideoComposition(asset: asset) { request in
      let source = request.sourceImage.clampedToExtent()
      let coloured = source.applyingFilter(
        "CIColorCubeWithColorSpace",
        parameters: [
          "inputCubeDimension": size,
          "inputCubeData": cube,
          "inputColorSpace": colorSpace,
        ])
      request.finish(with: coloured.cropped(to: request.sourceImage.extent), context: nil)
    }
    guard
      let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality)
    else {
      promise.reject("E_VIDEO_EXPORT", "Could not create an export session")
      return
    }
    try? FileManager.default.removeItem(at: output)
    export.videoComposition = composition
    export.outputURL = output
    export.outputFileType = .mp4
    export.shouldOptimizeForNetworkUse = true
    export.exportAsynchronously {
      switch export.status {
      case .completed:
        promise.resolve(nil)
      default:
        promise.reject(
          "E_VIDEO_EXPORT", export.error?.localizedDescription ?? "The video could not be exported")
      }
    }
  }
}
