import Constants from 'expo-constants';
import { getExpoGoProjectConfig } from 'expo';
import { Platform } from 'react-native';

function resolveDevMachineLanHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  const fromUri = hostUri ? hostUri.split(':')[0] : null;
  if (fromUri && isUsableDevHost(fromUri)) {
    return fromUri;
  }
  const dbg = getExpoGoProjectConfig()?.debuggerHost;
  if (dbg) {
    const h = dbg.split(':')[0];
    if (h && isUsableDevHost(h)) {
      return h;
    }
  }
  return null;
}

function isUsableDevHost(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1') {
    return false;
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return true;
  }
  if (/\.local$/i.test(host)) {
    return true;
  }
  return false;
}

function parseUrl(base: string): URL {
  return new URL(base.startsWith('http') ? base : `http://${base}`);
}

function replaceLocalHostWith(base: string, hostname: string): string {
  const u = parseUrl(base);
  u.hostname = hostname;
  return u.toString().replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  const trimmed = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  const isEmulator = Constants.isDevice === false;

  let base =
    trimmed ??
    (Platform.OS === 'android'
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000');

  if (Platform.OS === 'android' && isEmulator) {
    try {
      const u = parseUrl(base);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        base = replaceLocalHostWith(base, '10.0.2.2');
      }
    } catch {
      /* ignore */
    }
  }

  if (__DEV__ && !isEmulator) {
    const lan = resolveDevMachineLanHost();
    if (lan) {
      try {
        const u = parseUrl(base);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          base = replaceLocalHostWith(base, lan);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return base;
}
