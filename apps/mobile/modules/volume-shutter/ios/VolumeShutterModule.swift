import AVKit
import ExpoModulesCore

/// Reports volume-button presses while the camera is open, so they can take a photo
/// (CAM-03). Uses the system's capture event interaction (iOS 17.2+), which also
/// keeps the volume from changing; earlier versions simply do nothing.
public class VolumeShutterModule: Module {
  private var interaction: UIInteraction?

  public func definition() -> ModuleDefinition {
    Name("VolumeShutter")

    Events("onPress")

    Function("setEnabled") { (enabled: Bool) in
      DispatchQueue.main.async {
        if enabled {
          self.attach()
        } else {
          self.detach()
        }
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.detach()
      }
    }
  }

  private func attach() {
    guard interaction == nil else { return }
    guard #available(iOS 17.2, *) else { return }
    guard let view = appContext?.utilities?.currentViewController()?.view else { return }
    let created = AVCaptureEventInteraction { [weak self] event in
      if event.phase == .ended {
        self?.sendEvent("onPress", [:])
      }
    }
    view.addInteraction(created)
    interaction = created
  }

  private func detach() {
    guard let current = interaction else { return }
    current.view?.removeInteraction(current)
    interaction = nil
  }
}
