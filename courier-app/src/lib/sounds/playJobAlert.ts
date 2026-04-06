import { Audio } from 'expo-av';
import { Platform, Vibration } from 'react-native';

let primed = false;

async function ensureAudioMode(): Promise<void> {
  if (primed) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    primed = true;
  } catch {
    /* sessizce devam */
  }
}

/** Yeni iş teklifi: titreşim + kısa ses (assets/sounds/courier_job.wav) */
export async function playJobAlertFeedback(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 280, 120, 280, 120, 400]);
    } else {
      Vibration.vibrate([0, 400, 200, 400]);
    }
  } catch {
    Vibration.vibrate(400);
  }

  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      require('../../../assets/sounds/courier_job.wav'),
      { shouldPlay: true, volume: 1 },
    );
    sound.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && st.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    /* ses yoksa titreşim yeterli */
  }
}
