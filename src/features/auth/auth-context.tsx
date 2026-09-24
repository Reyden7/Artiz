import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase/client';

type AuthState = { session: Session | null; loading: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    let restored = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active || !restored || event === 'INITIAL_SESSION') return;
      setSession(nextSession);
    });
    async function restoreSession() {
      try {
        const { data: { session: storedSession } } = await client.auth.getSession();
        if (!storedSession) return;
        // A cached session does not prove the account is still valid.
        const { data: { user }, error } = await client.auth.getUser();
        if (active && !error && user) setSession({ ...storedSession, user });
      } finally {
        restored = true;
        if (active) setLoading(false);
      }
    }
    restoreSession().catch(() => { restored = true; if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
