import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  // Only block the UI with a loading state when we have a token but no cached
  // user yet. If a cached user exists we render it immediately and revalidate
  // in the background (below), so refreshes don't flash a spinner.
  const [loading, setLoading] = useState(
    () => !!localStorage.getItem('token') && !localStorage.getItem('user')
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return undefined;
    }
    // Always revalidate against /me on load. This is what makes the dashboard
    // role-driven: if an admin changed this user's role, /me returns the new
    // role (and a fresh token when the old one is stale), so the layout and
    // permissions automatically adjust on the next load -- no re-login needed.
    let cancelled = false;
    api.get('/me')
      .then((res) => {
        if (cancelled) return;
        const { token: refreshedToken, ...userData } = res.data;
        if (refreshedToken) localStorage.setItem('token', refreshedToken);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  // Account Creation Policy: registration no longer auto-logs the new
  // account in -- it starts 'pending' and needs an admin (or, for admin-role
  // requests, the developer account specifically) to approve it first. The
  // backend returns a plain message rather than a token, so just hand that
  // back to the caller (Register.js) to display.
  const register = useCallback(async (payload) => {
    const res = await api.post('/register', payload);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
