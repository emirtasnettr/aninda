import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { AuthUserDto } from '../lib/api/types';

const TOKEN_KEY = 'teslimatjet_access_token';
const USER_KEY = 'teslimatjet_user';

interface AuthState {
  token: string | null;
  user: AuthUserDto | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: AuthUserDto) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    let timedOut = false;
    const finish = (token: string | null, user: AuthUserDto | null) => {
      set({ token, user, hydrated: true });
    };
    const timer = setTimeout(() => {
      // Bazı Android emülatörlerde SecureStore.getItemAsync takılı kalabiliyor; UI sonsuz döner.
      timedOut = true;
      finish(null, null);
    }, 8000);
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const raw = await SecureStore.getItemAsync(USER_KEY);
      const user = raw ? (JSON.parse(raw) as AuthUserDto) : null;
      clearTimeout(timer);
      if (!timedOut) {
        finish(token, user);
      }
    } catch {
      clearTimeout(timer);
      if (!timedOut) {
        finish(null, null);
      }
    }
  },

  setSession: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null });
  },
}));
