import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { insforge, APP_URL } from '../lib/insforge';
import { api } from '../lib/api';
import { getGuest, setGuest, clearGuest } from '../lib/guest';

export interface AuthUser { id: string; email?: string; name?: string; profile?: { name?: string; avatar_url?: string }; guest?: boolean }
interface AuthCtx {
  user: AuthUser | null; loading: boolean; displayName: string;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ needsCode: boolean }>;
  verifyCode(email: string, otp: string): Promise<void>;
  resend(email: string): Promise<void>;
  oauth(provider: 'github' | 'google'): Promise<void>;
  /** Play without an account: the nickname is vetted by the server and remembered on this device. */
  playAsGuest(name: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

const msg = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const { data, error } = await insforge.auth.getCurrentUser();
    const signedIn = error ? null : ((data?.user as AuthUser | undefined) ?? null);
    const guest = signedIn ? null : getGuest();
    setUser(signedIn ?? (guest ? { id: guest.id, name: guest.name, guest: true } : null));
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const value: AuthCtx = {
    user, loading,
    displayName: user?.guest ? (user.name ?? 'Guest') : (user?.profile?.name ?? user?.name ?? user?.email?.split('@')[0] ?? 'villager'),
    async signIn(email, password) {
      const { error } = await insforge.auth.signInWithPassword({ email, password });
      if (error) throw new Error(msg(error));
      await refresh();
    },
    async signUp(email, password, name) {
      const { data, error } = await insforge.auth.signUp({ email, password, name, redirectTo: `${APP_URL}/login` });
      if (error) throw new Error(msg(error));
      if (data?.requireEmailVerification) return { needsCode: true };
      await refresh();
      return { needsCode: false };
    },
    async verifyCode(email, otp) {
      const { error } = await insforge.auth.verifyEmail({ email, otp });
      if (error) throw new Error(msg(error));
      await refresh();
    },
    async resend(email) { await insforge.auth.resendVerificationEmail({ email, redirectTo: `${APP_URL}/login` }); },
    async oauth(provider) { await insforge.auth.signInWithOAuth(provider, { redirectTo: `${APP_URL}/` }); },
    async playAsGuest(name) {
      const r = await api.guest(name);
      if (!r.guest) throw new Error('The tavern keeper is not answering. Try again.');
      setGuest(r.guest);
      setUser({ id: r.guest.id, name: r.guest.name, guest: true });
    },
    async signOut() { clearGuest(); if (!user?.guest) await insforge.auth.signOut(); setUser(null); },
    refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
