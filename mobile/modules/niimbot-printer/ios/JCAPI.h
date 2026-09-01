// version 4.0.3 20251226

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

/**
 Suggested to use on iOS 9 and above systems.
 */

/**
 Barcode Format Enum.

 This enum defines different barcode formats, which can be used to identify and
 select specific barcode formats.

 - JCBarcodeFormatCodebar: CODEBAR 1D format.
 - JCBarcodeFormatCode39: Code 39 1D format.
 - JCBarcodeFormatCode93: Code 93 1D format.
 - JCBarcodeFormatCode128: Code 128 1D format.
 - JCBarcodeFormatEan8: EAN-8 1D format.
 - JCBarcodeFormatEan13: EAN-13 1D format.
 - JCBarcodeFormatITF: ITF (Interleaved Two of Five) 1D format.
 - JCBarcodeFormatUPCA: UPC-A 1D format.
 - JCBarcodeFormatUPCE: UPC-E 1D format.

 */
typedef NS_ENUM(NSUInteger, JCBarcodeMode) {
  // CODEBAR 1D format.
  JCBarcodeFormatCodebar,

  // Code 39 1D format.
  JCBarcodeFormatCode39,

  // Code 93 1D format.
  JCBarcodeFormatCode93,

  // Code 128 1D format.
  JCBarcodeFormatCode128,

  // EAN-8 1D format.
  JCBarcodeFormatEan8,

  // EAN-13 1D format.
  JCBarcodeFormatEan13,

  // ITF (Interleaved Two of Five) 1D format.
  JCBarcodeFormatITF,

  // UPC-A 1D format.
  JCBarcodeFormatUPCA,

  // UPC-E 1D format.
  JCBarcodeFormatUPCE
};

/**
 Cache Status Enum.

 This enum defines the cache status of print tasks, used to track and manage the
 execution process of print jobs.

 - JCSDKCacheWillPrinting: About to start printing.
 - JCSDKCachePrinting: Currently printing.
 - JCSDKCacheWillPause: About to pause.
 - JCSDKCachePaused: Paused.
 - JCSDKCacheWillCancel: About to cancel.
 - JCSDKCacheCanceled: Canceled.
 - JCSDKCacheWillDone: About to complete.
 - JCSDKCacheDone: Completed.
 - JCSDKCacheWillResume: About to resume.
 - JCSDKCacheResumed: Resumed.
 */
typedef NS_ENUM(NSUInteger, JCSDKCacheStatus) {
  JCSDKCacheWillPrinting,
  JCSDKCachePrinting,
  JCSDKCacheWillPause,
  JCSDKCachePaused,
  JCSDKCacheWillCancel,
  JCSDKCacheCanceled,
  JCSDKCacheWillDone,
  JCSDKCacheDone,
  JCSDKCacheWillResume,
  JCSDKCacheResumed,
};

/**
 Printer Font Type Enum.

 This enum defines available printer font types, used to set the font style of
 printed content.

 - JCSDKCammodFontTypeStandard: Standard font.
 - JCSDKCammodFontTypeFreestyleScript: Freestyle script font.
 - JCSDKCammodFontTypeOCRA: OCR A font.
 - JCSDKCammodFontTypeHelveticaNeueLTPro: Helvetica Neue LT Pro font.
 - JCSDKCammodFontTypeTimesNewRoman: Times New Roman font.
 - JCSDKCammodFontTypeMICR: MICR font (for bank checks).
 - JCSDKCammodFontTypeTerU24b: TerU24b font.
 - JCSDKCammodFontTypeSimpleChinese16Point: Simplified Chinese 16-point font.
 - JCSDKCammodFontTypeSimpleChinese24Point: Simplified Chinese 24-point font.
 */
typedef NS_ENUM(NSUInteger, JCSDKCammodFontType) {
  JCSDKCammodFontTypeStandard = 0,
  JCSDKCammodFontTypeFreestyleScript,
  JCSDKCammodFontTypeOCRA,
  JCSDKCammodFontTypeHelveticaNeueLTPro,
  JCSDKCammodFontTypeTimesNewRoman,
  JCSDKCammodFontTypeMICR,
  JCSDKCammodFontTypeTerU24b,
  JCSDKCammodFontTypeSimpleChinese16Point = 55,
  JCSDKCammodFontTypeSimpleChinese24Point
};

/**
 Rotation Angle Enum.

 This enum defines the rotation angles for printed content, used to control the
 print direction.

 - JCSDKCammodRotationDefault: Default angle (0 degrees).
 - JCSDKCammodRotation90: 90 degrees rotation.
 - JCSDKCammodRotation180: 180 degrees rotation.
 - JCSDKCammodRotation270: 270 degrees rotation.
 */
typedef NS_ENUM(NSUInteger, JCSDKCammodRotation) {
  JCSDKCammodRotationDefault = 0,
  JCSDKCammodRotation90 = 90,
  JCSDKCammodRotation180 = 180,
  JCSDKCammodRotation270 = 270
};

/**
 Graphics Type Enum.

 This enum defines different graphics print types, used to specify the
 arrangement of graphics.

 - JCSDKCammodGraphicsTypeHorizontalExt: Horizontal extension.
 - JCSDKCammodGraphicsTypeVerticalExt: Vertical extension.
 - JCSDKCammodGraphicsTypeHorizontalZip: Horizontal compression.
 - JCSDKCammodGraphicsTypeVerticalZip: Vertical compression.
 */
typedef NS_ENUM(NSUInteger, JCSDKCammodGraphicsType) {
  JCSDKCammodGraphicsTypeHorizontalExt,
  JCSDKCammodGraphicsTypeVerticalExt,
  JCSDKCammodGraphicsTypeHorizontalZip,
  JCSDKCammodGraphicsTypeVerticalZip
};

/**
 Printer Connection Status Callback.

 This callback is invoked when the printer connection succeeds or fails.
 @param isSuccess YES indicates successful connection, NO indicates connection
 failure.
 */
typedef void (^DidOpened_Printer_Block)(BOOL isSuccess);

/**
 Print Completion Callback.

 This callback is invoked when a print job completes.
 @param isSuccess YES indicates successful print, NO indicates print failure.
 */
typedef void (^DidPrinted_Block)(BOOL isSuccess);

/**
 Print Information Callback.

 This callback is invoked when print-related information needs to be passed.
 @param printInfo Print information string.
 */
typedef void (^PRINT_INFO)(NSString *printInfo);

/**
 Print Status Callback.

 This callback is invoked when the print status changes.
 @param isSuccess YES indicates normal status, NO indicates abnormal status.
 */
typedef void (^PRINT_STATE)(BOOL isSuccess);

/**
 Print Dictionary Information Callback.

 This callback is invoked when print information containing multiple fields
 needs to be passed.
 @param printDicInfo Dictionary containing print information.
 */
typedef void (^PRINT_DIC_INFO)(NSDictionary *printDicInfo);

/**
 Cache Status Callback.

 This callback is invoked when the print job cache status changes.
 @param status Current cache status.
 */
typedef void (^JCSDKCACHE_STATE)(JCSDKCacheStatus status);

@interface JCAPI : NSObject

/**
 Scan for nearby Bluetooth printers.

 This method scans for nearby Bluetooth printers and returns the discovered
 printer names via a callback.

 @param completion Completion callback block. After scanning is complete, this
 callback will be invoked with an array of discovered Bluetooth printer names.
        The `scanedPrinterNames` array contains the names of discovered
 Bluetooth printers. If no printers are found, the array will be empty.
 */
+ (void)scanBluetoothPrinter:(void (^)(NSArray *scanedPrinterNames))completion;

/**
 Connect to a Bluetooth printer with the specified name.

 This method establishes a connection with a Bluetooth printer of the specified
 name. Connection state changes will be notified through the provided callback.

 @param printerName The name of the Bluetooth printer to connect to.
 @param completion Connection state callback block. When the connection state
 changes, this callback will be invoked with the connection result. The
 `isSuccess` parameter indicates whether the printer was successfully connected.
 YES means connection successful, NO means connection failed.
 */
+ (void)openPrinter:(NSString *)printerName
         completion:(DidOpened_Printer_Block)completion;

/**
 Scan for nearby Wi-Fi printers.

 This method scans for nearby Wi-Fi printers and returns the discovered printer
 information via a callback.

 @param completion Completion callback block. After scanning is complete, this
 callback will be invoked with an array of discovered Wi-Fi printer information.
        The `scanedPrinterNames` array contains information about discovered
 Wi-Fi printers. Each element is a dictionary containing the following fields:
        - `ipAdd`: The printer's IP address.
        - `bleName`: Bluetooth name.
        - `port`: Connection port.
        - `availableClient`: Number of available client connections.
 */
+ (void)scanWifiPrinter:(void (^)(NSArray *scanedPrinterNames))completion;

/**
 Scan for nearby Wi-Fi printers within a specified timeout.

 This method scans for nearby Wi-Fi printers within the specified timeout
 duration and returns the discovered printer names via a callback.

 @param timeout Scanning timeout duration in seconds. The scanning operation
 will be performed within this time period.
 @param completion Completion callback block. After scanning is complete, this
 callback will be invoked with an array of discovered Wi-Fi printer names. The
 `scanedPrinterNames` array contains the names of discovered Wi-Fi printers. If
 no printers are found, the array will be empty.
 */
+ (void)scanWifiPrinter:(float)timeout
         withCompletion:(void (^)(NSArray *scanedPrinterNames))completion;

/**
 Configure the printer to connect to the Wi-Fi network currently connected to
 the phone.

 @param   wifiName        Wi-Fi network name (optional).
 @param   password        Wi-Fi password.
 @param   completion      Callback indicating whether the printer Wi-Fi
 configuration was successful.
 */
+ (void)configurationWifi:(NSString *)wifiName
                 password:(NSString *)password
               completion:(PRINT_DIC_INFO)completion;

/**
 Get Wi-Fi configuration information.

 This method is used to obtain Wi-Fi configuration information, typically
 returning the Wi-Fi name.

 @param completion Callback for Wi-Fi name.
 */
+ (void)getWifiConfiguration:(PRINT_DIC_INFO)completion;

/**
 Get the name of the Wi-Fi network currently connected to the phone.

 This method is used to obtain the name of the Wi-Fi network the phone is
 currently connected to.

 @return Returns the name of the Wi-Fi network currently connected to the phone.
 */
+ (NSString *)connectingWifiName;

/**
 Connect to a Wi-Fi printer with the specified name.

 @param   host              Printer name.
 @param   completion      Callback indicating whether the printer connection was
 successful. (Connection state changes will be returned via this callback)
 */
+ (void)openPrinterHost:(NSString *)host
             completion:(DidOpened_Printer_Block)completion;

/**
 Connect to a printer with the specified IP address via Wi-Fi connection.

 This method establishes a Wi-Fi connection with a printer at the specified IP
 address. Connection state changes will be notified through the provided
 callback.

 @param host The IP address of the printer to connect to.
 @param completion Connection state callback block. When the connection state
 changes, this callback will be invoked with the connection result. The
 `isSuccess` parameter indicates whether the printer was successfully connected.
 YES means connection successful, NO means connection failed.
 */
+ (void)openPrinterHost:(NSString *)host
                   port:(uint16_t)port
             completion:(DidOpened_Printer_Block)completion;

/**
 Close the currently opened printer connection.

 This method is used to close the currently opened printer connection. After
 executing this operation, the `completion(NO)` callback of the
 `openPrinter:completion:` method will be triggered.

 Note: Calling this method will interrupt the connection to the printer.
 */
+ (void)closePrinter;

/**
 Get the name of the currently connected printer (Bluetooth or Wi-Fi).

 This method is used to obtain the name of the currently connected printer. For
 Wi-Fi connections, the printer's IP address is returned.

 @return The name of the currently connected printer. Returns nil if no printer
 is connected.
 */
+ (NSString *)connectingPrinterName;

/**
 Get the current Bluetooth/Wi-Fi connection status.

 This method is used to obtain the Bluetooth and Wi-Fi connection status of the
 current device.

 @return Returns an integer value indicating the connection status. 0 means no
 connection, 1 means Bluetooth connected, 2 means Wi-Fi connected.
 */
+ (int)isConnectingState;

/**
 Monitor printer status changes.

 @param   completion
 @{
    @"1": Cover status - 0 open/1 closed
    @"2": Battery level change - 1/2/3/4
    @"3": Paper presence - 0 no/1 yes
    @"5": Ribbon status - 0 no ribbon/1 has ribbon
    @"6": Wi-Fi signal strength
 }
 @return  Whether monitoring printer status changes is supported: YES:
 supported, NO: not supported
 */
+ (BOOL)getPrintStatusChange:(PRINT_DIC_INFO)completion;

/**
 Get the label size installed in the printer (currently only supports M2 models
 with firmware version V1.24 and above) Note: The read parameters are valid when
 statusCode is 0 and paperType parameter is not 0
 @{@"statusCode":@"0",
    @"result":@{@"gapHeightPixel":arrs[0],//Gap height (black mark height) in
 pixels
            @"totalHeightPixel":arrs[1],//Paper height (including gap) in pixels
            @"paperType":arrs[2],//Paper type: 1-gap paper; 2-black mark paper;
 3-continuous paper; 4-fixed hole paper; 5-transparent paper; 6-sign;
            @"gapHeight":arrs[3],//Gap height (black mark height) in millimeters
            @"totalHeight":arrs[4],//Paper height (including gap) in millimeters
            @"paperWidthPixel":arrs[5],//Paper width (including gap) in pixels
            @"paperWidth":arrs[6],//Paper width (including gap) in millimeters
            @"direction":arrs[7], //Tail direction 1-up 2-down 3-left 4-right
 (not yet supported)
            @"tailLengthPixel":arrs[8],//Tail length in pixels
            @"tailLength":arrs[9]}} //Tail length in millimeters
 */
+ (void)getPaperInfo:(PRINT_DIC_INFO)completion;

/**
 Affects cache and pause functionality, with a maximum of 5 tasks in cache, used
 to improve print continuity and enhance printing experience Whether to enable
 SDK cache: YES: enable, NO: disable
 */
+ (void)setPrintWithCache:(BOOL)startCache;

/**
 Pass the total print quantity before printing

 @param totalQuantityOfPrints Set the total print quantity, representing the sum
 of print copies for all pages. For example, if you have 3 pages to print, the
 first page prints 3 copies, the second page prints 2 copies, and the third page
 prints 5 copies, then the value of count should be 10 (3+2+5).
 */
+ (void)setTotalQuantityOfPrints:(NSInteger)totalQuantityOfPrints;

/**
 Bluetooth/Wi-Fi cancel printing (call when printing is not complete).

 @param   completion      Print completion callback (will not return after an
 exception occurs)
 */
+ (void)cancelJob:(DidPrinted_Block)completion;

/**
 Bluetooth/Wi-Fi print completion (call after printing is complete).

 @param   completion      Print completion callback (will not return after an
 exception occurs)
 */
+ (void)endPrint:(DidPrinted_Block)completion;

/**
 Bluetooth/Wi-Fi price tag printer completed count (only valid for price tag
 printers, may be partially lost, app should do timeout reset state).

 @param   count           Completed print count (will not return after an
 exception occurs)
 @{
    @"totalCount":@"Total printed sheets count" //Required key in return
    @"pageCount":@"Current print count for page PageNo" //Optional
    @"pageNO":@"Current page number being printed". //Optional
    @"tid":@"TID code returned from RFID write"  //Optional
    @"carbonUsed":@"Ribbon usage in millimeters"  //Optional
 }
 */
+ (void)getPrintingCountInfo:(PRINT_DIC_INFO)count;

/**
Bluetooth/Wi-Fi exception receiving (call after successful connection).

@param error Print exceptions:
1 — Cover open
2 — Out of paper
3 — Low battery
4 — Battery exception
5 — Manual stop
6 — Data error (submit print data failed / image generation failed / send data error / printer verification failed)
7 — Temperature too high
8 — Paper ejection exception
9 — Printer busy (motor rotating or firmware upgrading)
10 — Print head not detected
11 — Ambient temperature too low
12 — Print head not locked
13 — Ribbon not detected
14 — Incompatible ribbon
15 — Exhausted ribbon
16 — Unsupported paper type
17 — Paper setting failed
18 — Print mode setting failed
19 — Print density setting failed (printing allowed, exception reported only)
20 — RFID write failed
21 — Margin setting error (margins must be > 0 and within canvas bounds)
22 — Communication exception (timeout / commands rejected)
23 — Printer disconnected
24 — Canvas parameter setting error
25 — Rotation angle parameter error
26 — JSON parameter error (PC)
27 — Paper ejection exception (cover detection closed)
28 — Check paper type
29 — RFID tag printed in non-RFID mode
30 — Density setting not supported
31 — Print mode not supported
32 — Tag material setting failed (non-blocking)
33 — Unsupported tag material setting (blocks printing)
50 — Invalid tag
51 — Invalid ribbon and tag
52 — Firmware receive data timeout
53 — Non-dedicated ribbon
58 — Non-genuine consumables (label & ribbon not recognized) *(select new models)*
59 — Non-genuine ribbon (ribbon not recognized) *(select new models)*
60 — Consumables over limit (label & ribbon exceed usage) *(select new models)*
61 — Ribbon over limit *(select new models)*
62 — Non-genuine label (label not recognized) *(select new models)*
63 — Label over limit *(select new models)*
*/
+ (void)getPrintingErrorInfo:(PRINT_INFO)error;

/**
 Convert pixels to millimeters (will process the pixels).

 @param   pixel           Pixels
 @return  Drawing parameters
 */
+ (CGFloat)pixelToMm:(CGFloat)pixel;

/**
 Convert millimeters to pixels (will process the millimeters).

 @param  mm       Millimeters
 @return  Drawing parameters
 */
+ (CGFloat)mmToPixel:(CGFloat)mm;

/**
 Generate print preview image.

 This method is used to generate print preview images based on the provided JSON
 data along with resolution and print multiple parameters.

 @param generatePrintPreviewImageJson JSON data containing print information.
 @param displayMultiple Display multiple, used to specify the resolution of the
 generated image.
 @param printMultiple Printer multiple, used to specify the print multiple of
 the generated image.
 @param printPreviewImageType Preview image type, usually a fixed value of 1.
 @param error Pointer to an NSError object to receive error information. If an
 error occurs during preview image generation, the corresponding error
 information will be returned.

 @return Returns the generated preview image, or nil if generation fails.
 */
+ (UIImage *)generatePrintPreviewImage:(NSString *)generatePrintPreviewImageJson
                       displayMultiple:(float)displayMultiple
                         printMultiple:(float)printMultiple
                 printPreviewImageType:(int)printPreviewImageType
                                 error:(NSError **)error;

/**
 Initialize the image library.

 This method is used to set the path of the font folder for subsequent image
 processing operations. The image library must be initialized before text
 drawing and barcode text drawing.

 @param fontFamilyPath Full path to the font folder.
 @param error Pointer to an NSError object to receive error information. If an
 error occurs when setting the font path, the corresponding error information
 will be returned.

 @note
 Before performing text drawing and barcode text drawing, ensure to call this
 method to initialize the image library. If initialization fails, the error
 information will be returned via the `error` parameter.
 */
+ (void)initImageProcessing:(NSString *)fontFamilyPath error:(NSError **)error;

/**
 Prepare print job.

 This method is used to prepare a print job, setting print density and paper
 type, and notifying the result via callback after printing is complete.

 @param blackRules Print density setting. The specific value depends on the
 printer model, please refer to the following rules:
   - H1/H1S/D11/D110/D101/B16/D110_M/D11_H/H1/H1S/D110_M/D11_H: Support range
 1~3, default value 2.
   - B21/B21S/B21_Pro/B11/B1/B203/B3S/B3S_P/B31/B4/K2/K3/K3_W: Support range
 1~5, default value 3.
   - B50&B50W/B32&B32R&Z401: Support range 1~15, default value 8.
   - M2_H/M3: Support range 1~5, default value 3.
   - N1(B18): Support range 1~3, default value 2.

 @param paperStyle Paper type setting. The specific value depends on the printer
 model, please refer to the following rules:
   - H1/H1S/D11/D110/D101/B16/D110_M/D11_H/B21/B21S/B21_Pro/B1/B203/B3S/B3S_P/B31/B4/N1(B18)/B32&B32R&Z401/M2_H/M3/K2/K3/K3_W:
     1: Gap paper;
     2: Black-marked paper;
     3: Continuous paper;
     4: Perforated paper;
     5: Transparent paper;
     6: Label;
     10: Black Label Gap Paper;

   - B11/B50/B50W series:
     0: Continuous paper;
     1: Registration hole (automatically switches to gap paper if not supported);
     2: Gap paper;
     3: Black mark paper;

 @param completion Print completion callback block. When the print job
 completes, this callback will be invoked with the print result.
 */
+ (void)startJob:(int)blackRules
    withPaperStyle:(int)paperStyle
    withCompletion:(DidPrinted_Block)completion;

/**
 Print binarized image bitmap data.

 This method is used to submit binarized image data to the printer, allowing
 setting of print count, dash line presence, and completion callback.

 @param data NSData object containing binarized image data.
 @param width Image width.
 @param height Image height.
 @param count Print count.
 @param epc EPC code (for RFID printing).
 @param hasDashLine Whether to include dashed line.
 @param completion Print completion callback block. When the print job
 completes, this callback will be invoked with the print result.
 */
+ (void)print:(nonnull NSData *)data
       dataWidth:(unsigned int)width
      dataHeight:(unsigned int)height
       withCount:(unsigned int)count
         withEpc:(nullable NSString *)epcCode
    withComplete:(DidPrinted_Block)completion;




/**
 Print binary bitmap image data.
 
 This method is used to submit binary image data to the printer, allowing setting of print copies, EPC code, whether to include dashed lines, and a callback after printing is completed.

 @param data NSData object containing binary image data.
 @param width Image width.
 @param height Image height.
 @param count Number of copies to print.
 @param epcCode EPC code (optional).
 @param hasDashLine Whether to include dashed lines.
 @param completion Completion block called when printing task finishes, passing the print result.
 */
+ (void)print:(nonnull NSData *)data
    dataWidth:(unsigned int)width
   dataHeight:(unsigned int)height
    withCount:(unsigned int)count
      withEpc:(nullable NSString *)epcCode
 withDashLine:(BOOL)hasDashLine
 withComplete:(DidPrinted_Block)completion;


/**
 Get display multiple.
 
 This method is used to calculate the display multiple by combining screen physical size with screen resolution.

 @param templatePhysical Screen physical size in millimeters.
 @param screenDisplaySize Screen resolution width in pixels.
 @return Returns a float representing the calculated display multiple.
 */
+ (float)getDisplayMultiple:(float)templatePhysical templateDisplayWidth:(int)screenDisplaySize;


/**
 Convert millimeters to inches.
 
 This method is used to convert length from millimeters to inches.

 @param mm Value in millimeters.
 @return Returns a float representing the converted value in inches.
 */
+(float) mmToInch:(float) mm;

/**
 Convert inches to millimeters.
 
 This method is used to convert length from inches to millimeters.

 @param inch Value in inches.
 @return Returns a float representing the converted value in millimeters.
 */
+(float) inchToMm:(float) inch;


/// Check if RFID writing is supported.
+(BOOL)isSupportWriteRFID;


/**
 Initialize drawing board.
 
 This method is used to initialize a drawing board with specified width, height, horizontal shift, vertical shift, rotation angle, and optional font path.

 @param width Board width in millimeters.
 @param height Board height in millimeters.
 @param horizontalShift Board horizontal shift in millimeters (currently not effective).
 @param verticalShift Board vertical shift in millimeters (currently not effective).
 @param rotate Board rotation angle, typically 0.
 @param font Font name (currently not effective)
 */
+(void)initDrawingBoard:(float)width
             withHeight:(float)height
    withHorizontalShift:(float)horizontalShift
      withVerticalShift:(float)verticalShift
                 rotate:(int) rotate
                   font:(NSString*)font;


/**
 Initialize drawing board.
 
 This method is used to initialize a drawing board with specified width, height, horizontal shift, vertical shift, rotation angle, and optional font array.

 @param width Board width in millimeters.
 @param height Board height in millimeters.
 @param horizontalShift Board horizontal shift in millimeters (currently not effective).
 @param verticalShift Board vertical shift in millimeters (currently not effective).
 @param rotate Board rotation angle, typically 0.
 @param fonts Array of font names
 */
+(void)initDrawingBoard:(float)width
             withHeight:(float)height
    withHorizontalShift:(float)horizontalShift
      withVerticalShift:(float)verticalShift
                 rotate:(int) rotate
              fontArray:(NSArray<NSString*> *)fonts;

/**
 Draw text on label.
 
 This method is used to draw text on the drawing board, allowing specification of text position, size, content, font family, font size, rotation angle, alignment, line mode, and font styles.

 @param x Horizontal starting position in millimeters.
 @param y Vertical starting position in millimeters.
 @param w Width in millimeters.
 @param h Height in millimeters.
 @param text Text content to draw.
 @param fontFamily Font family name.
 @param fontSize Font size.
 @param rotate Rotation angle.
 @param textAlignHorizonral Horizontal text alignment: 0 (left), 1 (center), 2 (right).
 @param textAlignVertical Vertical text alignment: 0 (top), 1 (middle), 2 (bottom).
 @param lineMode Line wrapping mode.
 @param letterSpacing Letter spacing.
 @param lineSpacing Line spacing.
 @param fontStyles Font styles as an array of boolean values, typically including italic, bold, underline, and strikethrough.

 @return Returns a boolean indicating whether the text was successfully drawn.
 
 @note
 Before drawing text, ensure you have called the appropriate method to initialize the image library.
 */
+(BOOL)drawLableText:(float)x
               withY:(float)y
           withWidth:(float)w
          withHeight:(float)h
          withString:(NSString *)text
      withFontFamily:(NSString *)fontFamily
        withFontSize:(float)fontSize
          withRotate:(int)rotate
withTextAlignHorizonral:(int)textAlignHorizonral
withTextAlignVertical:(int)textAlignVertical
        withLineMode:(int)lineMode
   withLetterSpacing:(float)letterSpacing
     withLineSpacing:(float)lineSpacing
       withFontStyle:(NSArray <NSNumber *>*)fontStyles;


/**
 Draw barcode on label.
 
 This method is used to draw a barcode on the drawing board, allowing specification of barcode position, size, content, font size, rotation angle, type, and related text information.

 @param x Horizontal coordinate in millimeters.
 @param y Vertical coordinate in millimeters.
 @param w Barcode width in millimeters.
 @param h Barcode height in millimeters (including text height).
 @param text Barcode content.
 @param fontSize Text font size.
 @param rotate Rotation angle, only supports 0, 90, 180, 270.
 @param codeType Barcode type:
   - 20: CODE128
   - 21: UPC-A
   - 22: UPC-E
   - 23: EAN8
   - 24: EAN13
   - 25: CODE93
   - 26: CODE39
   - 27: CODEBAR
   - 28: ITF25
 @param textHeight Text height in millimeters.
 @param textPosition Barcode text display position:
   - 0: Display below
   - 1: Display above
   - 2: Not displayed

 @return Returns a boolean indicating whether the barcode was successfully drawn.
 
 @note
 Before drawing a barcode, ensure you have called the appropriate method to initialize the image library.
 */
+(BOOL)drawLableBarCode:(float)x
                  withY:(float)y
              withWidth:(float)w
             withHeight:(float)h
             withString:(NSString *)text
           withFontSize:(float)fontSize
             withRotate:(int)rotate
           withCodeType:(int)codeType
         withTextHeight:(float)textHeight
       withTextPosition:(int)textPosition;


/**
 Draw QR code on label.
 
 This method is used to draw a QR code on the drawing board, allowing specification of QR code position, size, content, rotation angle, and type.

 @param x Horizontal coordinate in millimeters.
 @param y Vertical coordinate in millimeters.
 @param w QR code width in millimeters.
 @param h QR code height in millimeters.
 @param text QR code content.
 @param rotate Rotation angle, only supports 0, 90, 180, 270.
 @param codeType QR code type:
   - 31: QR_CODE
   - 32: PDF417
   - 33: DATA_MATRIX
   - 34: AZTEC

 @return Returns a boolean indicating whether the QR code was successfully drawn.
 */
+(BOOL)drawLableQrCode:(float)x
                 withY:(float)y
             withWidth:(float)w
            withHeight:(float)h
            withString:(NSString *)text
            withRotate:(int)rotate
          withCodeType:(int)codeType;


/**
 Draw line on label.
 
 This method is used to draw a line on the drawing board, allowing specification of line position, size, rotation angle, type, and dashed line width and style.

 @param x Horizontal coordinate in millimeters.
 @param y Vertical coordinate in millimeters.
 @param w Line width in millimeters.
 @param h Line height in millimeters.
 @param rotate Rotation angle, only supports 0, 90, 180, 270.
 @param lineType Line type:
   - 1: Solid line
   - 2: Dashed line with 1:1 ratio of solid to empty segments.
 @param dashWidth Dashed line width, an array containing two numbers representing solid segment length and empty segment length.

 @return Returns a boolean indicating whether the line was successfully drawn.
 */
+(BOOL)DrawLableLine:(float)x
               withY:(float)y
           withWidth:(float)w
          withHeight:(float)h
          withRotate:(int)rotate
        withLineType:(int)lineType
       withDashWidth:(NSArray <NSNumber *>*)dashWidth;


/**
 Draw shape on label.
 
 This method is used to draw a shape on the drawing board, allowing specification of shape position, size, line width, corner radius, rotation angle, type, and line style.

 @param x Horizontal coordinate in millimeters.
 @param y Vertical coordinate in millimeters.
 @param w Shape width in millimeters.
 @param h Shape height in millimeters.
 @param lineWidth Line width in millimeters.
 @param cornerRadius Corner radius in millimeters.
 @param rotate Rotation angle, only supports 0, 90, 180, 270.
 @param graphType Shape type.
 @param lineType Line type:
   - 1: Solid line
   - 2: Dashed line with 1:1 ratio of solid to empty segments.
 @param dashWidth Line width, an array containing two numbers representing solid segment length and empty segment length.

 @return Returns a boolean indicating whether the shape was successfully drawn.
 */
+(BOOL)DrawLableGraph:(float)x
                withY:(float)y
            withWidth:(float)w
           withHeight:(float)h
        withLineWidth:(float)lineWidth
     withCornerRadius:(float)cornerRadius
           withRotate:(int)rotate
        withGraphType:(int)graphType
         withLineType:(int)lineType
        withDashWidth:(NSArray <NSNumber *>*)dashWidth;


/**
 Draw image on label.
 
 This method is used to draw an image on the drawing board, allowing specification of image position, size, image data, rotation angle, processing algorithm, and threshold.

 @param x Horizontal coordinate in millimeters.
 @param y Vertical coordinate in millimeters.
 @param w Image width in millimeters.
 @param h Image height in millimeters.
 @param imageData Base64 encoded image data.
 @param rotate Rotation angle, only supports 0, 90, 180, 270.
 @param imageProcessingType Image processing algorithm (default 1).
 @param imageProcessingValue Threshold value (default 127).

 @return Returns a boolean indicating whether the image was successfully drawn.
 */
+(BOOL)DrawLableImage:(float)x
                withY:(float)y
            withWidth:(float)w
           withHeight:(float)h
        withImageData:(NSString *)imageData
           withRotate:(int)rotate
withImageProcessingType:(int)imageProcessingType
withImageProcessingValue:(float)imageProcessingValue;

/**
 Generate JSON string of label data.

 This method is used to generate a JSON string of label data for submission to the printer for printing.

 @return Returns the generated JSON string of label data.
 */
+(NSString *)GenerateLableJson;


/**
 Get label preview image.

 This method is used to generate a preview image of the label, allowing specification of display scale and error code.

 @param displayScale Display scale.
 @param error Returned error code, nil if successful.

 @return Returns the generated label preview image.
 */
+(UIImage *)generateImagePreviewImage:(float)displayScale error:(NSError **)error;


/**
 Start label printing task.

 This method is used to submit print data, specifying the number of copies and callback handling.

 @param printData Print data, typically a JSON string of label data.
 @param onePageNumbers Specifies the number of copies to print for the current page. For example, if you need to print 3 pages with 3 copies of the first page, 2 copies of the second page, and 5 copies of the third page, you would set onePageNumbers to 3, 2, and 5 respectively in the three commit calls.
 @param completion Completion callback for handling the print task result.

 */
+ (void)commit:(NSString *)printData
withOnePageNumbers:(int)onePageNumbers
  withComplete:(DidPrinted_Block)completion;

/**
 Start label printing task.

 This method is used to submit print data, specifying the number of copies, RFID data to write, and callback handling.

 @param printData Print data, typically a JSON string of label data.
 @param onePageNumbers Specifies the number of copies to print for the current page. For example, if you need to print 3 pages with 3 copies of the first page, 2 copies of the second page, and 5 copies of the third page, you would set onePageNumbers to 3, 2, and 5 respectively in the three commit calls.
 @param epcCode RFID data to write. Can be nil to skip writing RFID data. (Only supported on B32R models)
 @param completion Completion callback for handling the print task result.
 */
+ (void)commit:(NSString *)printData
withOnePageNumbers:(int)onePageNumbers
       withEpc:(nullable NSString *)epcCode
  withComplete:(DidPrinted_Block)completion;
@end
