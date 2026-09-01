#import "NiimbotJCAPIBridge.h"
#import "JCAPI.h"

@implementation NiimbotJCAPIBridge

+ (void)scanBluetoothPrinters:(NiimbotStringListCallback)completion {
  [JCAPI scanBluetoothPrinter:^(NSArray *scanedPrinterNames) {
    NSMutableArray<NSString *> *names = [NSMutableArray array];
    for (id item in scanedPrinterNames ?: @[]) {
      if (![item isKindOfClass:[NSString class]]) {
        continue;
      }
      NSString *trimmed = [((NSString *)item) stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      if (trimmed.length > 0) {
        [names addObject:trimmed];
      }
    }
    completion(names ?: @[]);
  }];
}

+ (void)openPrinter:(NSString *)printerName completion:(NiimbotBoolCallback)completion {
  [JCAPI openPrinter:printerName completion:completion];
}

+ (void)closePrinter {
  [JCAPI closePrinter];
}

+ (NSString *)connectingPrinterName {
  return [JCAPI connectingPrinterName];
}

+ (int)connectingState {
  return [JCAPI isConnectingState];
}

+ (void)setTotalQuantityOfPrints:(NSInteger)total {
  [JCAPI setTotalQuantityOfPrints:total];
}

+ (void)startJobWithDensity:(int)density
                 paperStyle:(int)paperStyle
                 completion:(NiimbotBoolCallback)completion {
  [JCAPI startJob:density withPaperStyle:paperStyle withCompletion:completion];
}

+ (void)initDrawingBoardWithWidth:(float)width
                           height:(float)height
                  horizontalShift:(float)horizontalShift
                    verticalShift:(float)verticalShift
                           rotate:(int)rotate {
  [JCAPI initDrawingBoard:width
               withHeight:height
      withHorizontalShift:horizontalShift
        withVerticalShift:verticalShift
                   rotate:rotate
                fontArray:@[]];
}

+ (BOOL)drawBarcodeAt:(float)x
                     y:(float)y
                 width:(float)width
                height:(float)height
                  text:(NSString *)text
              fontSize:(float)fontSize
                rotate:(int)rotate
              codeType:(int)codeType
            textHeight:(float)textHeight
          textPosition:(int)textPosition {
  return [JCAPI drawLableBarCode:x
                           withY:y
                       withWidth:width
                      withHeight:height
                      withString:text
                    withFontSize:fontSize
                      withRotate:rotate
                    withCodeType:codeType
                  withTextHeight:textHeight
                withTextPosition:textPosition];
}

+ (NSString *)generateLabelJson {
  return [JCAPI GenerateLableJson];
}

+ (void)sendLabelJson:(NSString *)json withCopyCount:(int)copyCount completion:(NiimbotBoolCallback)completion {
  [JCAPI commit:json withOnePageNumbers:copyCount withComplete:completion];
}

+ (void)getPrintingCountInfo:(NiimbotDictionaryCallback)completion {
  [JCAPI getPrintingCountInfo:completion];
}

+ (void)endPrint:(NiimbotBoolCallback)completion {
  [JCAPI endPrint:completion];
}

+ (void)getPrintingErrorInfo:(NiimbotStringCallback)completion {
  [JCAPI getPrintingErrorInfo:completion];
}

+ (nullable NSError *)configureImageProcessingAtPath:(NSString *)fontFamilyPath {
  NSError *error = nil;
  [JCAPI initImageProcessing:fontFamilyPath error:&error];
  return error;
}

@end
