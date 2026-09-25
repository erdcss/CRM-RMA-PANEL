import ExpoModulesCore

public class NiimbotPrinterModule: Module {
  private let engine = NiimbotPrintEngine.shared

  public func definition() -> ModuleDefinition {
    Name("NiimbotPrinter")

    AsyncFunction("isIntegrationAvailable") { () -> Bool in
      self.engine.isIntegrationAvailable()
    }

    AsyncFunction("scanPrinters") { (promise: Promise) in
      self.engine.scanPrinters { result in
        switch result {
        case .success(let printers):
          promise.resolve(printers)
        case .failure(let error):
          promise.reject(self.asException(error))
        }
      }
    }

    AsyncFunction("connectPrinter") { (printerId: String, promise: Promise) in
      self.engine.connect(printerId: printerId) { result in
        switch result {
        case .success:
          promise.resolve(nil)
        case .failure(let error):
          promise.reject(self.asException(error))
        }
      }
    }

    AsyncFunction("disconnectPrinter") { () in
      self.engine.disconnect()
    }

    AsyncFunction("getConnectionStatus") { () -> [String: Any?] in
      self.engine.connectionStatus()
    }

    AsyncFunction("printBarcodeLabel") { (options: [String: Any], promise: Promise) in
      guard let value = options["value"] as? String else {
        promise.reject(self.asException(NiimbotNativeError.invalidBarcode("Barkod değeri gerekli.")))
        return
      }

      let widthMm = (options["widthMm"] as? NSNumber)?.doubleValue ?? 40
      let heightMm = (options["heightMm"] as? NSNumber)?.doubleValue ?? 12
      let copies = (options["copies"] as? NSNumber)?.intValue ?? 1
      let modeRaw = (options["mode"] as? String) ?? "product"
      let mode = NiimbotBarcodePrintMode(rawValue: modeRaw) ?? .product

      self.engine.printBarcodeLabel(
        value: value,
        mode: mode,
        widthMm: widthMm,
        heightMm: heightMm,
        copies: copies
      ) { result in
        switch result {
        case .success:
          promise.resolve(nil)
        case .failure(let error):
          promise.reject(self.asException(error))
        }
      }
    }
  }

  private func asException(_ error: Error) -> Exception {
    if let native = error as? NiimbotNativeError {
      return Exception(name: native.code, description: native.localizedDescription, code: native.code)
    }
    return Exception(
      name: "PRINT_FAILED",
      description: error.localizedDescription,
      code: "PRINT_FAILED"
    )
  }
}
