import Foundation

final class NiimbotPrintEngine {
  static let shared = NiimbotPrintEngine()

  private let queue = DispatchQueue(label: "com.caliskangroup.rma.niimbot", qos: .userInitiated)
  private var printBusy = false
  private var connectedPrinterName: String?

  private init() {}

  func isIntegrationAvailable() -> Bool { true }

  func scanPrinters(completion: @escaping (Result<[[String: Any?]], Error>) -> Void) {
    runOnMain {
      NiimbotJCAPIBridge.scanBluetoothPrinters { names in
        var results: [[String: Any?]] = []
        var seen = Set<String>()

        for name in names {
          let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
          guard !trimmed.isEmpty, !seen.contains(trimmed) else { continue }
          seen.insert(trimmed)
          results.append([
            "id": trimmed,
            "name": trimmed,
            "model": NiimbotNativeError.inferModel(from: trimmed),
            "rssi": nil,
          ])
        }

        completion(.success(results))
      }
    }
  }

  func connect(printerId: String, completion: @escaping (Result<Void, Error>) -> Void) {
    let printerName = printerId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !printerName.isEmpty else {
      completion(.failure(NiimbotNativeError.printerNotFound))
      return
    }

    runOnMain {
      NiimbotJCAPIBridge.openPrinter(printerName) { [weak self] success in
        if success {
          self?.connectedPrinterName = printerName
          completion(.success(()))
        } else {
          completion(.failure(NiimbotNativeError.connectionFailed("Yazıcı bağlantısı kurulamadı.")))
        }
      }
    }
  }

  func disconnect() {
    runOnMain {
      NiimbotJCAPIBridge.closePrinter()
      self.connectedPrinterName = nil
    }
  }

  func connectionStatus() -> [String: Any?] {
    let state = NiimbotJCAPIBridge.connectingState()
    let name = NiimbotJCAPIBridge.connectingPrinterName()?.trimmingCharacters(in: .whitespacesAndNewlines)
    let connected = state == 1 && !(name ?? "").isEmpty

    if connected, let name {
      connectedPrinterName = name
      return [
        "connected": true,
        "printer": [
          "id": name,
          "name": name,
          "model": NiimbotNativeError.inferModel(from: name),
          "rssi": nil,
        ],
      ]
    }

    return ["connected": false, "printer": nil]
  }

  func printBarcodeLabel(
    value: String,
    widthMm: Double,
    heightMm: Double,
    copies: Int,
    completion: @escaping (Result<Void, Error>) -> Void
  ) {
    let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard cleaned.range(of: "^\\d{9}$", options: .regularExpression) != nil else {
      completion(.failure(NiimbotNativeError.invalidBarcode("Barkod tam 9 haneli rakam olmalıdır.")))
      return
    }

    let status = connectionStatus()
    guard (status["connected"] as? Bool) == true else {
      completion(.failure(NiimbotNativeError.notConnected))
      return
    }

    queue.async { [weak self] in
      guard let self else { return }
      if self.printBusy {
        completion(.failure(NiimbotNativeError.printBusy))
        return
      }
      self.printBusy = true

      do {
        try NiimbotFontLoader.ensureFontsReady()
      } catch {
        self.printBusy = false
        completion(.failure(error))
        return
      }

      let totalCopies = max(1, min(copies, 100))
      let labelWidth = Float(widthMm > 0 ? widthMm : 40)
      let labelHeight = Float(heightMm > 0 ? heightMm : 12)

      self.runOnMain {
        self.registerPrintMonitoring(expectedTotal: totalCopies)

        NiimbotJCAPIBridge.setTotalQuantityOfPrints(totalCopies)
        NiimbotJCAPIBridge.startJob(withDensity: 2, paperStyle: 1, completion: { started in
          guard started else {
            self.printBusy = false
            completion(.failure(NiimbotNativeError.printFailed("Yazdırma işi başlatılamadı.")))
            return
          }

          NiimbotJCAPIBridge.initDrawingBoard(
            withWidth: labelWidth,
            height: labelHeight,
            horizontalShift: 0,
            verticalShift: 0,
            rotate: 0
          )

          let marginX: Float = 1.2
          let marginY: Float = 0.25
          let contentWidth = max(1, labelWidth - marginX * 2)
          let textHeight: Float = 2.6
          let barcodeHeight = max(4, labelHeight - marginY - textHeight - 0.25)

          let drawn = NiimbotJCAPIBridge.drawBarcode(
            at: marginX,
            y: marginY,
            width: contentWidth,
            height: barcodeHeight + textHeight,
            text: cleaned,
            fontSize: 2.2,
            rotate: 0,
            codeType: 20,
            textHeight: textHeight,
            textPosition: 0
          )

          guard drawn else {
            self.printBusy = false
            completion(.failure(NiimbotNativeError.printFailed("Code 128 etiketi oluşturulamadı.")))
            return
          }

          guard let json = NiimbotJCAPIBridge.generateLabelJson(), !json.isEmpty else {
            self.printBusy = false
            completion(.failure(NiimbotNativeError.printFailed("Etiket verisi oluşturulamadı.")))
            return
          }

          NiimbotJCAPIBridge.sendLabelJson(json, withCopyCount: Int32(totalCopies)) { success in
            if success {
              completion(.success(()))
            } else {
              completion(.failure(NiimbotNativeError.printFailed("Barkod yazdırılamadı. Yazıcı bağlantısını kontrol edin.")))
            }
            self.printBusy = false
          }
        })
      }
    }
  }

  private func registerPrintMonitoring(expectedTotal: Int) {
    NiimbotJCAPIBridge.getPrintingCountInfo { info in
      guard
        let dict = info as? [String: Any],
        let totalCountRaw = dict["totalCount"],
        let totalCount = Int("\(totalCountRaw)"),
        totalCount >= expectedTotal,
        expectedTotal > 0
      else {
        return
      }

      NiimbotJCAPIBridge.endPrint { _ in }
    }

    NiimbotJCAPIBridge.getPrintingErrorInfo { code in
      guard let mapped = NiimbotNativeError.mapPrintingErrorCode(code) else { return }
      NSLog("NIIMBOT print error: \(mapped.localizedDescription)")
    }
  }

  private func runOnMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }
}
