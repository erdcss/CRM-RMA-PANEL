import ExpoModulesCore
import TikTokBusinessSDK

/// The SDK is never initialized until the user expressly opts into TikTok measurement.
/// App Secret is sourced from EAS environment -> Info.plist, never from JS or GitHub.
public class CaliskanTiktokAppEventsModule: Module {
  private var initialized = false

  public func definition() -> ModuleDefinition {
    Name("CaliskanTiktokAppEvents")

    AsyncFunction("isConfigured") { () -> Bool in
      self.configuration() != nil
    }

    AsyncFunction("initializeWithConsent") { (promise: Promise) in
      guard !self.initialized else { promise.resolve(true); return }
      guard let (appleId, tiktokId, accessToken) = self.configuration() else {
        promise.resolve(false)
        return
      }
      guard let config = TikTokConfig(accessToken: accessToken, appId: appleId, tiktokAppId: tiktokId) else {
        promise.resolve(false)
        return
      }
      // Manual launch, install, purchase and identity events only, avoiding
      // pre-consent auto-logging and duplicate e-commerce conversions.
      config.disableAutomaticTracking()
      config.disableInstallTracking()
      config.disableLaunchTracking()
      config.disableRetentionTracking()
      config.disablePaymentTracking()
      config.disableAutoEnhancedDataPostbackEvent()
      TikTokBusiness.initializeSdk(config) { success, _ in
        self.initialized = success
        if success { TikTokBusiness.setTrackingEnabled(true) }
        promise.resolve(success)
      }
    }

    AsyncFunction("stopTracking") { () in
      TikTokBusiness.setTrackingEnabled(false)
      // The SDK cannot be un-initialized; sending events is disabled here.
    }

    AsyncFunction("trackEvent") { (name: String) -> Bool in
      guard self.initialized, !name.isEmpty,
        ["LaunchAPP", "ViewContent", "Search", "AddToCart", "Checkout", "Purchase"].contains(name) else { return false }
      TikTokBusiness.trackEvent(name)
      return true
    }
  }

  private func configuration() -> (String, String, String)? {
    guard let appleId = Bundle.main.object(forInfoDictionaryKey: "CaliskanTikTokAppleAppId") as? String,
      let tiktokId = Bundle.main.object(forInfoDictionaryKey: "CaliskanTikTokAppId") as? String,
      let accessToken = Bundle.main.object(forInfoDictionaryKey: "CaliskanTikTokAppSecret") as? String,
      !appleId.isEmpty, !tiktokId.isEmpty, !accessToken.isEmpty
    else { return nil }
    return (appleId, tiktokId, accessToken)
  }
}
