import Foundation

enum NiimbotNativeError: LocalizedError {
  case bluetoothOff
  case permissionDenied
  case printerNotFound
  case connectionFailed(String)
  case notConnected
  case printFailed(String)
  case printBusy
  case invalidBarcode(String)
  case sdkSetup(String)

  var errorDescription: String? {
    switch self {
    case .bluetoothOff:
      return "Bluetooth kapalı. Yazıcıya bağlanmak için Bluetooth'u açın."
    case .permissionDenied:
      return "Bluetooth izni gerekli. Ayarlar'dan Çalışkan RMA için Bluetooth erişimini açın."
    case .printerNotFound:
      return "NIIMBOT D110-M bulunamadı. Yazıcının açık ve yakında olduğundan emin olun."
    case .connectionFailed(let detail):
      return detail.isEmpty ? "Yazıcı bağlantısı kurulamadı." : detail
    case .notConnected:
      return "NIIMBOT yazıcı bağlı değil. Barkod Ayarlarından yazıcı seçin."
    case .printFailed(let detail):
      return detail.isEmpty ? "Barkod yazdırılamadı. Yazıcı bağlantısını kontrol edin." : detail
    case .printBusy:
      return "Önceki yazdırma işlemi tamamlanıyor."
    case .invalidBarcode(let detail):
      return detail
    case .sdkSetup(let detail):
      return detail
    }
  }

  var code: String {
    switch self {
    case .bluetoothOff: return "BLUETOOTH_OFF"
    case .permissionDenied: return "PERMISSION_DENIED"
    case .printerNotFound: return "PRINTER_NOT_FOUND"
    case .connectionFailed: return "CONNECTION_FAILED"
    case .notConnected: return "PRINTER_NOT_FOUND"
    case .printFailed: return "PRINT_FAILED"
    case .printBusy: return "PRINT_BUSY"
    case .invalidBarcode: return "PRINT_FAILED"
    case .sdkSetup: return "NIIMBOT_SETUP"
    }
  }

  static func mapPrintingErrorCode(_ code: String?) -> NiimbotNativeError? {
    guard let code, !code.isEmpty, code != "19" else { return nil }
    switch code {
    case "1":
      return .printFailed("Yazıcının kapağı açık.")
    case "2":
      return .printFailed("Yazıcıda etiket bulunamadı.")
    case "3":
      return .printFailed("Pil seviyesi düşük.")
    case "5":
      return .printFailed("Yazdırma durduruldu.")
    case "9":
      return .printBusy
    case "22", "23":
      return .connectionFailed("Yazıcı bağlantısı kesildi.")
    default:
      return .printFailed("Barkod yazdırılamadı. Yazıcı bağlantısını kontrol edin. (Kod: \(code))")
    }
  }

  static func inferModel(from name: String) -> String? {
    let upper = name.uppercased()
    if upper.contains("D110") { return "D110-M" }
    if upper.contains("D11") { return "D11" }
    return nil
  }
}
