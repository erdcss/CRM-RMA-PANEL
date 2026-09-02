import Foundation

enum NiimbotBarcodePrintMode: String {
  case product
  case package
}

private struct D110LabelLayout {
  // T12*40-155WHITE — 40 mm × 12 mm landscape. NIIMBOT app Direction Left ←
  // maps to getPaperInfo direction=3 → JCSDKCammodRotation270 per JCAPI.h rotation enum.
  static let boardWidth: Float = 40
  static let boardHeight: Float = 12
  static let boardRotate = 270
  static let productCodeType = 20 // CODE128 — fits 40×12 mm product labels
  static let packageCodeType = 20 // CODE128
  // JCAPI.h drawLableBarCode textPosition: 0=below, 1=above, 2=hidden
  static let textPositionBelow = 0
  static let shipmentEanPrefix = "869"

  static func shipmentEan13(from nineDigit: String) -> String? {
    guard nineDigit.range(of: "^\\d{9}$", options: .regularExpression) != nil else { return nil }
    let body = shipmentEanPrefix + nineDigit
    var sum = 0
    for (index, character) in body.enumerated() {
      guard let digit = character.wholeNumberValue else { return nil }
      sum += (index % 2 == 0) ? digit : digit * 3
    }
    let check = (10 - (sum % 10)) % 10
    return body + String(check)
  }

  static func productMetrics() -> (marginX: Float, marginY: Float, contentWidth: Float, fontSize: Float, textHeight: Float, blockHeight: Float) {
    let marginX: Float = 1.25
    let marginY: Float = 0.35
    let contentWidth = max(1, boardWidth - marginX * 2)
    let textHeight: Float = 2.2
    let fontSize: Float = 2.1
    let blockHeight = boardHeight - marginY * 2
    return (marginX, marginY, contentWidth, fontSize, textHeight, blockHeight)
  }

  static func packageMetrics(for value: String) -> (marginX: Float, marginY: Float, contentWidth: Float, fontSize: Float, textHeight: Float, blockHeight: Float, textPosition: Int) {
    let marginX: Float = 1.1
    let marginY: Float = 0.3
    let contentWidth = max(1, boardWidth - marginX * 2)
    let length = value.count

    var fontSize: Float = 2.0
    var textHeight: Float = 2.0
    if length > 18 {
      fontSize = 1.65
      textHeight = 1.75
    }
    if length > 24 {
      fontSize = 1.4
      textHeight = 1.55
    }
    if length > 32 {
      fontSize = 1.2
      textHeight = 1.35
    }

    let blockHeight = boardHeight - marginY * 2
    return (marginX, marginY, contentWidth, fontSize, textHeight, blockHeight, textPositionBelow)
  }
}

private final class PrintSession {
  let id = UUID()
  let expectedCopies: Int
  var completion: ((Result<Void, Error>) -> Void)?
  private(set) var finished = false
  private var timeoutWorkItem: DispatchWorkItem?

  init(expectedCopies: Int, completion: @escaping (Result<Void, Error>) -> Void) {
    self.expectedCopies = expectedCopies
    self.completion = completion
  }

  func finish(_ result: Result<Void, Error>, on engine: NiimbotPrintEngine) {
    guard !finished else { return }
    finished = true
    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil
    engine.clearActiveSessionIfMatches(self)
    completion?(result)
    completion = nil
  }

  func scheduleFallbackTimeout(on engine: NiimbotPrintEngine) {
    let work = DispatchWorkItem { [weak self, weak engine] in
      guard let self, let engine, !self.finished else { return }
      NiimbotJCAPIBridge.endPrint { _ in
        self.finish(.success(()), on: engine)
      }
    }
    timeoutWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 12, execute: work)
  }
}

final class NiimbotPrintEngine {
  static let shared = NiimbotPrintEngine()

  private let queue = DispatchQueue(label: "com.caliskangroup.rma.niimbot", qos: .userInitiated)
  private var printBusy = false
  private var connectedPrinterName: String?
  private var activeSession: PrintSession?

  private init() {}

  func isIntegrationAvailable() -> Bool {
    NiimbotFontLoader.hasBundledFonts()
  }

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
    mode: NiimbotBarcodePrintMode,
    widthMm: Double,
    heightMm: Double,
    copies: Int,
    completion: @escaping (Result<Void, Error>) -> Void
  ) {
    let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)

    switch mode {
    case .product:
      guard cleaned.range(of: "^\\d{9}$", options: .regularExpression) != nil else {
        completion(.failure(NiimbotNativeError.invalidBarcode("Ürün barkodu 9 haneli olmalıdır.")))
        return
      }
      guard cleaned.uppercased().hasPrefix("RMA") == false else {
        completion(.failure(NiimbotNativeError.invalidBarcode("Ürün barkodu RMA/koli formatında olamaz.")))
        return
      }
    case .package:
      guard validatePackageBarcode(cleaned) else {
        completion(.failure(NiimbotNativeError.invalidBarcode("Geçersiz koli barkodu.")))
        return
      }
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
      let labelWidth = Float(widthMm > 0 ? widthMm : Double(D110LabelLayout.boardWidth))
      let labelHeight = Float(heightMm > 0 ? heightMm : Double(D110LabelLayout.boardHeight))

      guard labelWidth == D110LabelLayout.boardWidth, labelHeight == D110LabelLayout.boardHeight else {
        self.printBusy = false
        completion(.failure(NiimbotNativeError.printFailed("D110-M etiket boyutu 40×12 mm olmalıdır.")))
        return
      }

      let session = PrintSession(expectedCopies: totalCopies, completion: completion)
      self.activeSession = session

      self.runOnMain {
        self.registerPrintMonitoring(session: session)

        NiimbotJCAPIBridge.setTotalQuantityOfPrints(totalCopies)
        NiimbotJCAPIBridge.startJob(withDensity: 2, paperStyle: 1, completion: { [weak self] started in
          guard let self else { return }
          guard started else {
            session.finish(.failure(NiimbotNativeError.printFailed("Yazdırma işi başlatılamadı.")), on: self)
            return
          }

          NiimbotJCAPIBridge.initDrawingBoard(
            withWidth: D110LabelLayout.boardWidth,
            height: D110LabelLayout.boardHeight,
            horizontalShift: 0,
            verticalShift: 0,
            rotate: Int32(D110LabelLayout.boardRotate)
          )

          let metrics: (marginX: Float, marginY: Float, contentWidth: Float, fontSize: Float, textHeight: Float, blockHeight: Float, textPosition: Int)
          let barcodeText = cleaned
          let codeType: Int

          switch mode {
          case .product:
            let product = D110LabelLayout.productMetrics()
            metrics = (product.marginX, product.marginY, product.contentWidth, product.fontSize, product.textHeight, product.blockHeight, D110LabelLayout.textPositionBelow)
            codeType = D110LabelLayout.productCodeType
          case .package:
            metrics = D110LabelLayout.packageMetrics(for: cleaned)
            codeType = D110LabelLayout.packageCodeType
          }

          let drawn = NiimbotJCAPIBridge.drawBarcode(
            at: metrics.marginX,
            y: metrics.marginY,
            width: metrics.contentWidth,
            height: metrics.blockHeight,
            text: barcodeText,
            fontSize: metrics.fontSize,
            rotate: Int32(0),
            codeType: Int32(codeType),
            textHeight: metrics.textHeight,
            textPosition: Int32(metrics.textPosition)
          )

          guard drawn else {
            session.finish(.failure(NiimbotNativeError.printFailed("Code 128 etiketi oluşturulamadı.")), on: self)
            return
          }

          guard let json = NiimbotJCAPIBridge.generateLabelJson(), !json.isEmpty else {
            session.finish(.failure(NiimbotNativeError.printFailed("Etiket verisi oluşturulamadı.")), on: self)
            return
          }

          session.scheduleFallbackTimeout(on: self)

          NiimbotJCAPIBridge.sendLabelJson(json, withCopyCount: Int32(totalCopies)) { [weak self] success in
            guard let self else { return }
            if !success {
              session.finish(.failure(NiimbotNativeError.printFailed("Barkod yazdırılamadı. Yazıcı bağlantısını kontrol edin.")), on: self)
            }
          }
        })
      }
    }
  }

  fileprivate func clearActiveSessionIfMatches(_ session: PrintSession) {
    if activeSession?.id == session.id {
      activeSession = nil
    }
    printBusy = false
  }

  private func validatePackageBarcode(_ value: String) -> Bool {
    if value.isEmpty || value.count < 8 || value.count > 64 { return false }
    if value.range(of: "^\\d{9}$", options: .regularExpression) != nil { return false }
    return value.range(of: "^[A-Za-z0-9\\-_]+$", options: .regularExpression) != nil
  }

  private func registerPrintMonitoring(session: PrintSession) {
    NiimbotJCAPIBridge.getPrintingCountInfo { [weak self] info in
      guard let self, self.activeSession?.id == session.id, !session.finished else { return }
      guard
        let dict = info as? [String: Any],
        let totalCountRaw = dict["totalCount"],
        let totalCount = Int("\(totalCountRaw)"),
        totalCount >= session.expectedCopies,
        session.expectedCopies > 0
      else {
        return
      }

      NiimbotJCAPIBridge.endPrint { success in
        if success {
          session.finish(.success(()), on: self)
        } else {
          session.finish(.failure(NiimbotNativeError.printFailed("Yazdırma tamamlanamadı.")), on: self)
        }
      }
    }

    NiimbotJCAPIBridge.getPrintingErrorInfo { [weak self] code in
      guard let self, self.activeSession?.id == session.id, !session.finished else { return }
      guard let mapped = NiimbotNativeError.mapPrintingErrorCode(code) else { return }
      session.finish(.failure(mapped), on: self)
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
