import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthResult {
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  isSupabaseConfigured: boolean;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    (async () => {
      const client = await getSupabase();
      if (cancelled) return;

      if (!client) {
        setIsAuthLoading(false);
        return;
      }

      const { data } = await client.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setIsAuthLoading(false);

      const { data: sub } = client.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setIsAuthLoading(false);
      });
      subscription = sub.subscription;
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const client = await getSupabase();
    if (!client) return { error: 'Supabase no está configurado.' };
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const client = await getSupabase();
    await client?.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      isAuthLoading,
      isSupabaseConfigured,
      signInWithGoogle,
      signOut,
    }),
    [session, isAuthLoading, signInWithGoogle, signOut]
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
