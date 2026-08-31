import { Audio } from 'expo-av';

let audioReady = false;

async function ensureAudioMode() {
  if (audioReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  });
  audioReady = true;
}

async function playAsset(source: number) {
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 1 });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // ignore playback errors
  }
}

export function playScanSuccess() {
  void playAsset(require('../assets/sounds/scan-success.wav'));
}

export function playScanError() {
  void playAsset(require('../assets/sounds/scan-error.wav'));
}
