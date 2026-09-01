#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^NiimbotBoolCallback)(BOOL success);
typedef void (^NiimbotStringListCallback)(NSArray<NSString *> *names);
typedef void (^NiimbotDictionaryCallback)(NSDictionary * _Nullable info);
typedef void (^NiimbotStringCallback)(NSString * _Nullable value);

@interface NiimbotJCAPIBridge : NSObject

+ (void)scanBluetoothPrinters:(NiimbotStringListCallback)completion;
+ (void)openPrinter:(NSString *)printerName completion:(NiimbotBoolCallback)completion;
+ (void)closePrinter;
+ (NSString * _Nullable)connectingPrinterName;
+ (int)connectingState;
+ (void)setTotalQuantityOfPrints:(NSInteger)total;
+ (void)startJobWithDensity:(int)density
                 paperStyle:(int)paperStyle
                 completion:(NiimbotBoolCallback)completion;
+ (void)initDrawingBoardWithWidth:(float)width
                           height:(float)height
                  horizontalShift:(float)horizontalShift
                    verticalShift:(float)verticalShift
                           rotate:(int)rotate;
+ (BOOL)drawBarcodeAt:(float)x
                     y:(float)y
                 width:(float)width
                height:(float)height
                  text:(NSString *)text
              fontSize:(float)fontSize
                rotate:(int)rotate
              codeType:(int)codeType
            textHeight:(float)textHeight
          textPosition:(int)textPosition;
+ (NSString * _Nullable)generateLabelJson;
+ (void)sendLabelJson:(NSString *)json
        withCopyCount:(int)copyCount
           completion:(NiimbotBoolCallback)completion;
+ (void)getPrintingCountInfo:(NiimbotDictionaryCallback)completion;
+ (void)endPrint:(NiimbotBoolCallback)completion;
+ (void)getPrintingErrorInfo:(NiimbotStringCallback)completion;
+ (nullable NSError *)configureImageProcessingAtPath:(NSString *)fontFamilyPath;

@end

NS_ASSUME_NONNULL_END
