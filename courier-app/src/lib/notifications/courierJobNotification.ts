import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** app.json expo-notifications defaultChannel ile aynı olmalı */
const ANDROID_CHANNEL_ID = 'courier-jobs-v3';
/** app.json → sounds ile paketlenen dosya (native build) */
const JOB_ALERT_SOUND = 'courier_job.wav';

/**
 * Expo Go (Android) SDK 53+: `expo-notifications` yüklenince push token kaydı tetiklenir ve
 * LogBox’ta “Use a development build” hatası çıkar. Modülü hiç import etmiyoruz.
 * İş / atama uyarıları: Socket + uygulama içi banner (`CourierInAppNoticeBanner`).
 * Tam sistem bildirimi için: `npx expo run:android` development build.
 */
const skipNotificationsModule =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');

let notificationsLoad: Promise<NotificationsModule | null> | null = null;

function loadNotifications(): Promise<NotificationsModule | null> {
  if (skipNotificationsModule) {
    return Promise.resolve(null);
  }
  if (!notificationsLoad) {
    notificationsLoad = import('expo-notifications').catch(() => null);
  }
  return notificationsLoad;
}

let handlerRegistered = false;

export async function setupCourierJobNotifications(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return;
  }

  if (!handlerRegistered) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerRegistered = true;
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    /* izin penceresi açılamadı */
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'İş bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: JOB_ALERT_SOUND,
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      /* kanal / ses yok — varsayılan kanal kullanılır */
    }
  }
}

/**
 * Yerel bildirim gösterir. Expo Go veya izin yoksa false döner (uygulama içi banner kullanın).
 */
export async function showCourierJobNotification(params: {
  title: string;
  body: string;
}): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return false;
  }

  const androidTrigger = {
    channelId: ANDROID_CHANNEL_ID,
  } as const;

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      return false;
    }
  } catch {
    return false;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: JOB_ALERT_SOUND,
      },
      trigger: Platform.OS === 'android' ? androidTrigger : null,
    });
    return true;
  } catch {
    /* özel ses/kanal sorunu — sistem varsayılanı */
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: true,
      },
      trigger: Platform.OS === 'android' ? androidTrigger : null,
    });
    return true;
  } catch {
    return false;
  }
}
