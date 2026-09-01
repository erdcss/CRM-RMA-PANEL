import Foundation

enum NiimbotFontLoader {
  private static var prepared = false

  static func ensureFontsReady() throws {
    if prepared { return }

    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    let fontDir = documents.appendingPathComponent("font", isDirectory: true)
    try FileManager.default.createDirectory(at: fontDir, withIntermediateDirectories: true)

    guard let bundleFontJson = Bundle.main.url(forResource: "FONT", withExtension: "json", subdirectory: "font")
      ?? Bundle.main.url(forResource: "FONT", withExtension: "json")
    else {
      throw NiimbotNativeError.sdkSetup("NIIMBOT font bundle missing (FONT.json).")
    }

    let jsonData = try Data(contentsOf: bundleFontJson)
    guard
      let root = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
      let fonts = root["fonts"] as? [[String: Any]]
    else {
      throw NiimbotNativeError.sdkSetup("NIIMBOT FONT.json invalid.")
    }

    for entry in fonts {
      guard let fileName = entry["url"] as? String else { continue }
      let target = fontDir.appendingPathComponent(fileName)
      if FileManager.default.fileExists(atPath: target.path) { continue }

      let source =
        Bundle.main.url(forResource: (fileName as NSString).deletingPathExtension, withExtension: (fileName as NSString).pathExtension, subdirectory: "font")
        ?? Bundle.main.url(forResource: fileName, withExtension: nil, subdirectory: "font")

      guard let source else {
        throw NiimbotNativeError.sdkSetup("NIIMBOT font file missing: \(fileName)")
      }

      try FileManager.default.copyItem(at: source, to: target)
    }

    if let error = NiimbotJCAPIBridge.configureImageProcessing(atPath: fontDir.path) {
      throw NiimbotNativeError.sdkSetup(error.localizedDescription)
    }

    prepared = true
  }
}
