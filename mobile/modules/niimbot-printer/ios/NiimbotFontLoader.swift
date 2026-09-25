import Foundation

enum NiimbotFontLoader {
  private static var prepared = false

  private static let bundledFontNames = ["ZT001.ttf", "ZT002.otf"]

  static func ensureFontsReady() throws {
    if prepared { return }

    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    let fontDir = documents.appendingPathComponent("font", isDirectory: true)
    try FileManager.default.createDirectory(at: fontDir, withIntermediateDirectories: true)

    guard let bundleFontJson = locateBundledResource(named: "FONT", extension: "json") else {
      throw NiimbotNativeError.sdkSetup("NIIMBOT font bundle missing (FONT.json).")
    }

    let jsonData = try Data(contentsOf: bundleFontJson)
    guard
      let root = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
      let fonts = root["fonts"] as? [[String: Any]]
    else {
      throw NiimbotNativeError.sdkSetup("NIIMBOT FONT.json invalid.")
    }

    var copiedCount = 0

    for entry in fonts {
      guard let fileName = entry["url"] as? String else { continue }
      let target = fontDir.appendingPathComponent(fileName)
      if FileManager.default.fileExists(atPath: target.path) {
        copiedCount += 1
        continue
      }

      guard let source = locateBundledResource(named: fileName) else {
        continue
      }

      try FileManager.default.copyItem(at: source, to: target)
      copiedCount += 1
    }

    if copiedCount == 0 {
      for fileName in bundledFontNames {
        let target = fontDir.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: target.path) {
          copiedCount += 1
          continue
        }
        guard let source = locateBundledResource(named: fileName) else { continue }
        try FileManager.default.copyItem(at: source, to: target)
        copiedCount += 1
      }
    }

    guard copiedCount > 0 else {
      throw NiimbotNativeError.sdkSetup("NIIMBOT font files missing from app bundle.")
    }

    if let error = NiimbotJCAPIBridge.configureImageProcessing(atPath: fontDir.path) {
      throw NiimbotNativeError.sdkSetup(error.localizedDescription)
    }

    prepared = true
  }

  static func hasBundledFonts() -> Bool {
    if locateBundledResource(named: "FONT", extension: "json") == nil {
      return false
    }

    for fileName in bundledFontNames {
      if locateBundledResource(named: fileName) != nil {
        return true
      }
    }

    return false
  }

  private static func locateBundledResource(named name: String, extension ext: String? = nil) -> URL? {
    let bundles = [Bundle.main, Bundle(for: NiimbotPrintEngine.self)]
    let subdirectories = ["font", "NiimbotSDK/font", nil]

    for bundle in bundles {
      for subdirectory in subdirectories {
        if let ext {
          if let url = bundle.url(forResource: name, withExtension: ext, subdirectory: subdirectory) {
            return url
          }
        } else {
          let base = (name as NSString).deletingPathExtension
          let fileExt = (name as NSString).pathExtension
          if !fileExt.isEmpty,
             let url = bundle.url(forResource: base, withExtension: fileExt, subdirectory: subdirectory) {
            return url
          }
          if let url = bundle.url(forResource: name, withExtension: nil, subdirectory: subdirectory) {
            return url
          }
        }
      }
    }

    return nil
  }
}
