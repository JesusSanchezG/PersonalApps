import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSession,
  login as apiLogin,
  logout as apiLogout,
  setUnauthorizedHandler,
  type AuthUser,
} from '../services/api';

interface AuthResult {
  error: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthLoading: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // La cookie de sesión es la única fuente de verdad: al cargar la app solo
  // hay que preguntar al servidor si sigue viva.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await fetchSession();
        if (!cancelled) setUser(current);
      } catch {
        // Servidor inalcanzable: se sigue como usuario local. La app
        // funciona igual y sincronizará cuando vuelva la red.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Si el servidor responde 401 en cualquier punto (sesión caducada, cookie
  // borrada...), la sesión se cae aquí y la app vuelve al estado local.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    try {
      const authenticated = await apiLogin(username.trim(), password);
      setUser(authenticated);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo iniciar sesión' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Si el servidor no responde, la cookie caduca sola: seguir como
      // invitado es un resultado aceptable.
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isAuthLoading, signIn, signOut }),
    [user, isAuthLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
