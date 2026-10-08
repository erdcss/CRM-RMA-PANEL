import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useMobileBranding } from '@/lib/branding';

export default function RootLayout() {
  const branding = useMobileBranding();
  const [showManagedSplash, setShowManagedSplash] = useState(true);

  useEffect(() => {
    if (!branding.loaded) return;
    const timer = setTimeout(() => setShowManagedSplash(false), 1600);
    return () => clearTimeout(timer);
  }, [branding.loaded, branding.b2b_mobile_splash]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AlertProvider>
          <AppAlertBridge />
          <AuthGate>
            <StatusBar style="dark" />
            <RootStack />
          </AuthGate>
        </AlertProvider>
      </AuthProvider>

      {showManagedSplash ? (
        <View style={styles.splash} pointerEvents="none">
          {branding.b2b_mobile_splash ? (
            <ImageBackground source={{uri:branding.b2b_mobile_splash}} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
          ) : <View style={[StyleSheet.absoluteFillObject, {backgroundColor:'#141414'}]} />}
          <View style={styles.splashShade} />
          <View style={styles.splashLogoBox}>
            <BrandLogo uri={branding.b2b_mobile_logo} style={styles.splashImage} />
          </View>
          <View style={styles.splashBottom}>
            <View style={styles.splashProgressTrack}><View style={styles.splashProgress} /></View>
            <Text style={styles.splashCaption}>Yükleniyor...</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  splashShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.25)'},
  splashLogoBox:{position:'absolute',top:'15%',alignItems:'center'},
  splashBottom:{position:'absolute',bottom:65,width:'68%',alignItems:'center'},
  splashProgressTrack:{height:6,width:'100%',borderRadius:5,backgroundColor:'#555',overflow:'hidden'},
  splashProgress:{height:6,width:'55%',borderRadius:5,backgroundColor:'#FFCC00'},
  splashCaption:{color:'#FFF',marginTop:12,fontSize:14},
  splashImage: {
    width: 260,
    height: 100,
  },
});
