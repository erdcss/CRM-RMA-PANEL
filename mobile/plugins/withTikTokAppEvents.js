const {withInfoPlist} = require('@expo/config-plugins');

const APPLE_APP_ID = '6802286663';
const TIKTOK_APP_ID = '7706102756574396437';

/**
 * TikTok App Events SDK is only configured for native iOS release builds when
 * its App Secret exists in the EAS environment. We intentionally do not put
 * that credential in Expo extra / JS bundles or in the source repository.
 *
 * Info.plist values are embedded in the signed binary and can ultimately be
 * extracted from an app. Do not treat the TikTok App Secret as a server secret.
 */
module.exports = function withTikTokAppEvents(config) {
  return withInfoPlist(config, ios => {
    const secret = String(process.env.TIKTOK_APP_EVENTS_SECRET || '').trim();
    const isDevelopment = process.env.APP_VARIANT === 'development';
    // App Store privacy-safe default: no native advertising measurement.
    // Enable only for builds whose App Privacy declares tracking and whose
    // users can grant ATT authorization before any tracking starts.
    const trackingEnabled = process.env.EXPO_PUBLIC_B2B_AD_TRACKING === '1';
    if (!trackingEnabled || !secret || isDevelopment) {
      delete ios.modResults.NSUserTrackingUsageDescription;
      delete ios.modResults.CaliskanTikTokAppleAppId;
      delete ios.modResults.CaliskanTikTokAppId;
      delete ios.modResults.CaliskanTikTokAppSecret;
      return ios;
    }
    ios.modResults.CaliskanTikTokAppleAppId = APPLE_APP_ID;
    ios.modResults.CaliskanTikTokAppId = TIKTOK_APP_ID;
    ios.modResults.CaliskanTikTokAppSecret = secret;
    ios.modResults.NSUserTrackingUsageDescription =
      'İzin verirseniz Çalışkan B2B, reklamların etkinliğini ölçmek için uygulama kullanımına ilişkin kimlik verilerini kullanabilir. İzin vermek zorunda değilsiniz.';
    return ios;
  });
};
