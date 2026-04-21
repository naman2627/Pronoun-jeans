import { create } from 'zustand';
import api from '../api/axios';
import { jwtDecode } from 'jwt-decode';

const decodeToken = (token) => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: decodeToken(localStorage.getItem('accessToken')),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  initAuth: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp * 1000 < Date.now()) {
      localStorage.clear();
      set({ user: null, isAuthenticated: false });
      return;
    }
    set({ user: decoded, isAuthenticated: true });
  },

  login: async (email, password) => {
    const res = await api.post('auth/token/', { email, password });
    localStorage.setItem('accessToken', res.data.access);
    localStorage.setItem('refreshToken', res.data.refresh);
    const decoded = decodeToken(res.data.access);
    set({ user: decoded, isAuthenticated: true });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    // Blacklist the refresh token on the backend — fire and forget
    if (refreshToken) {
      try {
        await api.post('auth/logout/', { refresh: refreshToken });
      } catch {
        // Proceed regardless — local session must always be cleared
      }
    }
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
    // Use replace so the user can't navigate back to a protected page
    window.location.replace('/login');
  },
}));