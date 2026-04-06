import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { AuthUserDto } from '../lib/api/types';

const TOKEN_KEY = 'teslimatjet_customer_token';
const USER_KEY = 'teslimatjet_customer_user';

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
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const raw = await SecureStore.getItemAsync(USER_KEY);
      const user = raw ? (JSON.parse(raw) as AuthUserDto) : null;
      set({ token, user, hydrated: true });
    } catch {
      set({ token: null, user: null, hydrated: true });
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
