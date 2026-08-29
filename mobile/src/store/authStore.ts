import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  companyId: string;
  companyName: string;
  branchId?: string;
  branchName?: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  selectedBranchId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  appMode: 'TAILOR' | 'FACTORY';
  setAuth: (token: string, user: UserProfile) => Promise<void>;
  setSelectedBranch: (branchId: string) => void;
  setAppMode: (mode: 'TAILOR' | 'FACTORY') => void;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  selectedBranchId: null,
  isAuthenticated: false,
  isLoading: true,
  appMode: 'TAILOR',

  setAuth: async (token: string, user: UserProfile) => {
    await AsyncStorage.setItem('crm_token', token);
    await AsyncStorage.setItem('crm_user', JSON.stringify(user));
    set({
      token,
      user,
      selectedBranchId: user.branchId || null,
      isAuthenticated: true,
      isLoading: false
    });
  },

  setSelectedBranch: (branchId: string) => {
    set({ selectedBranchId: branchId });
  },

  setAppMode: (mode: 'TAILOR' | 'FACTORY') => {
    set({ appMode: mode });
  },

  logout: async () => {
    await AsyncStorage.removeItem('crm_token');
    await AsyncStorage.removeItem('crm_user');
    set({
      token: null,
      user: null,
      selectedBranchId: null,
      isAuthenticated: false,
      isLoading: false
    });
  },

  loadStoredAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('crm_token');
      const userStr = await AsyncStorage.getItem('crm_user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({
          token,
          user,
          selectedBranchId: user.branchId || null,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false });
    }
  }
}));
