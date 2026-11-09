import ExpoModulesCore
import TikTokBusinessSDK
import AppTrackingTransparency

/// The SDK is never initialized until the user expressly opts into TikTok measurement.
/// App Secret is sourced from EAS environment -> Info.plist, never from JS or GitHub.
public class CaliskanTiktokAppEventsModule: Module {
  private var initialized = false
  private var consentActive = false

  public func definition() -> ModuleDefinition {
    Name("CaliskanTiktokAppEvents")

    AsyncFunction("isConfigured") { () -> Bool in
      self.configuration() != nil
    }

    AsyncFunction("initializeWithConsent") { (promise: Promise) in
      self.consentActive = true
      guard !self.initialized else { TikTokBusiness.setTrackingEnabled(self.consentActive); promise.resolve(true); return }
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
        if success { TikTokBusiness.setTrackingEnabled(self.consentActive) }
        promise.resolve(success)
      }
    }

    // The OS tracking request is separate from the in-app TikTok consent.
    // It is triggered only by an explicit tap in Settings, never automatically.
    AsyncFunction("requestAppleTrackingAuthorization") { (promise: Promise) in
      guard self.initialized, self.consentActive else { promise.resolve(-1); return }
      if #available(iOS 14.0, *) {
        ATTrackingManager.requestTrackingAuthorization { status in
          promise.resolve(Int(status.rawValue))
        }
      } else {
        promise.resolve(-1)
      }
    }

    AsyncFunction("stopTracking") { () in
      self.consentActive = false
      TikTokBusiness.setTrackingEnabled(false)
      // The SDK cannot be un-initialized; sending events is disabled here.
    }

    // Only standard TikTok commerce properties. No email, phone, user ID,
    // address, payment method, or financial-account identifiers are accepted.
    AsyncFunction("trackCommerceEvent") { (name: String, data: [String: Any]) -> Bool in
      guard self.initialized, self.consentActive else { return false }
      guard ["ViewContent", "Search", "AddToCart", "Checkout", "Purchase"].contains(name) else { return false }
      let eventId = data["eventId"] as? String ?? ""
      let query = data["query"] as? String ?? ""
      if name == "Search" {
        guard !query.isEmpty, query.count <= 120 else { return false }
        let search = TikTokBaseEvent(eventName: "Search")
        search.addProperty(withKey: "query", value: query)
        TikTokBusiness.trackTTEvent(search)
        return true
      }
      let rawItems = data["contents"] as? [[String: Any]] ?? []
      guard !rawItems.isEmpty, rawItems.count <= 50 else { return false }
      var products: [TikTokContentParams] = []
      for row in rawItems {
        guard let id = row["contentId"] as? String, !id.isEmpty, id.count <= 128,
              let price = row["price"] as? Double, price.isFinite, price >= 0,
              let quantity = row["quantity"] as? Int, quantity > 0 else { return false }
        let item = TikTokContentParams()
        item.contentId = id
        item.price = NSNumber(value: price)
        item.quantity = quantity
        if let title = row["contentName"] as? String { item.contentName = String(title.prefix(160)) }
        if let brand = row["brand"] as? String { item.brand = String(brand.prefix(80)) }
        if let category = row["contentCategory"] as? String { item.contentCategory = String(category.prefix(80)) }
        products.append(item)
      }
      let value = data["value"] as? Double ?? 0
      guard value.isFinite, value >= 0 else { return false }
      let event: TikTokContentsEvent
      switch name {
      case "ViewContent": event = TikTokViewContentEvent()
      case "AddToCart": event = TikTokAddToCartEvent()
      case "Checkout": event = TikTokCheckoutEvent()
      case "Purchase":
        guard !eventId.isEmpty, eventId.count <= 128 else { return false }
        event = TikTokPurchaseEvent(eventId: eventId)
      default: return false
      }
      event.setCurrency(TTCurrency.TRY)
      event.setValue(String(format: "%.2f", value))
      event.setContentType("product")
      event.setContents(products)
      TikTokBusiness.trackTTEvent(event)
      return true
    }

    AsyncFunction("trackEvent") { (name: String) -> Bool in
      guard self.initialized, self.consentActive, !name.isEmpty,
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
