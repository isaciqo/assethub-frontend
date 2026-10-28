import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/api';
import { REFRESH_KEY, TOKEN_KEY, USER_KEY, isOfflineError } from '@/services/http';
import type { ApiError, User } from '@/types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: User['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authService.login(email, password);
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    const profile = await authService.me();
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    setUser(profile);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    authService.logout().catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Atualiza o perfil ao abrir. Sem internet, segue com o perfil guardado —
  // derrubar a sessão aqui impediria justamente a conferência offline.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    authService.me()
      .then(profile => {
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        setUser(profile);
      })
      .catch((err: ApiError) => {
        if (!isOfflineError(err) && err.statusCode === 401) logout();
      });
  }, [logout]);

  const can = useCallback((...roles: User['role'][]) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
