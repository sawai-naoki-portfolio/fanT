import CoreImage
import ImageIO
import ExpoModulesCore

/// Develops a RAW photo (DNG and the camera RAW formats Core Image reads) into a
/// JPEG beside it (EDT-36), on the device, at most `maxEdge` on its long edge so a
/// large sensor's image cannot exhaust memory.
public class RawDevelopModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RawDevelop")

    AsyncFunction("develop") { (fileUri: String, maxEdge: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        promise.resolve(Self.develop(fileUri, maxEdge: maxEdge))
      }
    }
  }

  private static func develop(_ fileUri: String, maxEdge: Double) -> String? {
    guard let url = URL(string: fileUri), url.isFileURL,
      let raw = CIRAWFilter(imageURL: url)
    else { return nil }
    let size = raw.nativeSize
    let longEdge = max(size.width, size.height)
    if longEdge > 0 {
      raw.scaleFactor = Float(min(1.0, maxEdge / Double(longEdge)))
    }
    guard let image = raw.outputImage,
      let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)
    else { return nil }
    let output = url.deletingPathExtension().appendingPathExtension("developed.jpg")
    do {
      try CIContext().writeJPEGRepresentation(
        of: image, to: output, colorSpace: colorSpace,
        options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.95])
    } catch {
      return nil
    }
    return output.absoluteString
  }
}
