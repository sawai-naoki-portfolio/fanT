import CoreImage
import ExpoModulesCore
import Vision

/// Cuts people out of a photo for puri backgrounds (PRI-04) with Vision's person
/// segmentation, on the device. Writes a PNG beside the photo: white, with alpha
/// the confidence that a pixel shows a person, at the photo's upright size.
public class PersonSegmentationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PersonSegmentation")

    AsyncFunction("segment") { (fileUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        promise.resolve(Self.segment(fileUri))
      }
    }
  }

  private static func segment(_ fileUri: String) -> String? {
    guard let url = URL(string: fileUri), url.isFileURL,
      let image = CIImage(contentsOf: url, options: [.applyOrientationProperty: true])
    else { return nil }
    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .accurate
    request.outputPixelFormat = kCVPixelFormatType_OneComponent8
    do {
      try VNImageRequestHandler(ciImage: image, options: [:]).perform([request])
    } catch {
      return nil
    }
    guard let buffer = request.results?.first?.pixelBuffer else { return nil }
    let extent = image.extent
    let raw = CIImage(cvPixelBuffer: buffer)
    let mask = raw.transformed(
      by: CGAffineTransform(
        scaleX: extent.width / raw.extent.width, y: extent.height / raw.extent.height))
    let person = CIImage(color: .white).cropped(to: extent).applyingFilter(
      "CIBlendWithMask",
      parameters: [
        kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: extent),
        kCIInputMaskImageKey: mask,
      ])
    let output = url.deletingPathExtension().appendingPathExtension("mask.png")
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
    do {
      try CIContext().writePNGRepresentation(
        of: person, to: output, format: .RGBA8, colorSpace: colorSpace, options: [:])
    } catch {
      return nil
    }
    return output.absoluteString
  }
}
