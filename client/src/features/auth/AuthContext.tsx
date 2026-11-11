import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setCsrfToken } from '../../api/client';
import { authApi } from '../../api/endpoints';
import type { AuthResponse, SelfUser } from '../../api/types';

interface AuthContextValue {
  user: SelfUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; displayName: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: SelfUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<SelfUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check active session on initial mount
  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((data) => {
        if (!active) return;
        setCsrfToken(data.csrfToken);
        setUserState(data.user);
        queryClient.setQueryData(ME_QUERY_KEY, data);
      })
      .catch(() => {
        if (!active) return;
        setCsrfToken(null);
        setUserState(null);
        queryClient.setQueryData(ME_QUERY_KEY, null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [queryClient]);

  const login = useCallback<AuthContextValue['login']>(
    async (identifier, password) => {
      const data = await authApi.login({ identifier, password });
      setCsrfToken(data.csrfToken);
      setUserState(data.user);
      queryClient.setQueryData(ME_QUERY_KEY, data);
      // Remove stale domain queries (posts, messages, notifications) from previous session
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    },
    [queryClient],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (input) => {
      const data = await authApi.register(input);
      setCsrfToken(data.csrfToken);
      setUserState(data.user);
      queryClient.setQueryData(ME_QUERY_KEY, data);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setCsrfToken(null);
      setUserState(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const setUser = useCallback(
    (updatedUser: SelfUser) => {
      setUserState(updatedUser);
      queryClient.setQueryData<AuthResponse | null>(ME_QUERY_KEY, (prev) =>
        prev ? { ...prev, user: updatedUser } : prev,
      );
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      setUser,
    }),
    [user, isLoading, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
