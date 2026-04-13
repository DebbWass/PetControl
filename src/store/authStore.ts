import { create } from 'zustand';
import { AppUser, Family } from '../types';

interface AuthState {
  user: AppUser | null;
  family: Family | null;
  isLoading: boolean;
  setUser: (user: AppUser | null) => void;
  setFamily: (family: Family | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  family: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setFamily: (family) => set({ family }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, family: null, isLoading: false }),
}));
