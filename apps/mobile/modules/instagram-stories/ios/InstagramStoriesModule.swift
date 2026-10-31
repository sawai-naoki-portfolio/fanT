import ExpoModulesCore
import UIKit

/// Shares a photo to Instagram Stories (SHR-03): the image goes on the pasteboard
/// as a sticker with background colours, for five minutes, and Instagram opens its
/// story composer with it. Needs `instagram-stories` in LSApplicationQueriesSchemes.
public class InstagramStoriesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("InstagramStories")

    AsyncFunction("share") {
      (fileUri: String, appId: String, topColor: String, bottomColor: String, promise: Promise) in
      DispatchQueue.main.async {
        var components = URLComponents()
        components.scheme = "instagram-stories"
        components.host = "share"
        components.queryItems = [URLQueryItem(name: "source_application", value: appId)]
        guard let url = components.url, UIApplication.shared.canOpenURL(url),
          let file = URL(string: fileUri), file.isFileURL,
          let data = try? Data(contentsOf: file)
        else {
          promise.resolve(false)
          return
        }
        UIPasteboard.general.setItems(
          [[
            "com.instagram.sharedSticker.stickerImage": data,
            "com.instagram.sharedSticker.backgroundTopColor": topColor,
            "com.instagram.sharedSticker.backgroundBottomColor": bottomColor,
          ]],
          options: [.expirationDate: Date().addingTimeInterval(5 * 60)]
        )
        UIApplication.shared.open(url, options: [:]) { opened in
          promise.resolve(opened)
        }
      }
    }
  }
}
