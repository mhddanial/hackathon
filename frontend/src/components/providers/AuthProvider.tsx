"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { syncDraftAccount } from "@/lib/route-draft";
import { createClient } from "@/utils/supabase/client";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let authEvents = 0;
    const cleanDrafts = (session: Session | null) => {
      try {
        syncDraftAccount(session?.user.id ?? null, window.sessionStorage);
      } catch {
        /* Storage may be disabled. Auth still works. */
      }
    };
    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (disposed || authEvents) return;
        cleanDrafts(session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!disposed && !authEvents) {
          cleanDrafts(null);
          setLoading(false);
        }
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return;
      authEvents++;
      cleanDrafts(session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
