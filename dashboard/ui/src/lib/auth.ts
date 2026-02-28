import { create } from "zustand";
import * as api from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    await api.login(email, password);
    const user = await api.getProfile();
    set({ user, isAuthenticated: true });
  },

  register: async (email: string, name: string, password: string) => {
    await api.register(email, name, password);
    // Auto-login after registration
    await api.login(email, password);
    const user = await api.getProfile();
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Clear state even if the server call fails
    }
    set({ user: null, isAuthenticated: false });
  },

  refreshAuth: async () => {
    try {
      await api.refreshToken();
      const user = await api.getProfile();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      api.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
