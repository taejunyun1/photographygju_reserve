import UIKit
import Capacitor

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // Main.storyboard is assigned by UISceneStoryboardFile in Info.plist.
        // Keep the storyboard-created window attached during scene restoration.
        window?.windowScene = windowScene

        for context in connectionOptions.urlContexts {
            forward(urlContext: context)
        }
        for activity in connectionOptions.userActivities {
            _ = forward(userActivity: activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            forward(urlContext: context)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) -> Bool {
        forward(userActivity: userActivity)
    }

    private func forward(urlContext: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
        if let sourceApplication = urlContext.options.sourceApplication {
            options[.sourceApplication] = sourceApplication
        }
        if let annotation = urlContext.options.annotation {
            options[.annotation] = annotation
        }
        if urlContext.options.openInPlace {
            options[.openInPlace] = true
        }

        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: urlContext.url,
            options: options
        )
    }

    private func forward(userActivity: NSUserActivity) -> Bool {
        ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}
