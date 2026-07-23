import { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService';

export const AuthContext = createContext(null);

const TOKEN_KEY = 'citi_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Without a token there is nothing to bootstrap, so the initial value already
  // answers the question and the effect never has to set it synchronously.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    authService
      .fetchCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await authService.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
