import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/database.types";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  /** Supabase session (null = not logged in) */
  session: Session | null;
  /** Full profile row from the `profiles` table */
  profile: Profile | null;
  /** True while the initial session is being resolved */
  loading: boolean;

  /** Email + password sign-in */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Email + password sign-up; also inserts into `profiles` */
  signUp: (
    email: string,
    password: string,
    meta: { full_name: string; nim?: string; role?: string }
  ) => Promise<{ error: string | null }>;
  /** Google OAuth – redirects back to /dashboard */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  /** Reset Password */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Update Password (after following reset link) */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  /** Sign out */
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  signOut: async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string, token?: string): Promise<Profile | null> {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      
      // Gunakan token yang di-pass, atau ambil dari getSession jika tidak ada
      let accessToken = token;
      if (!accessToken) {
        accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      }
      
      const res = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${accessToken || key}`,
        },
        signal: AbortSignal.timeout(5000), // timeout to prevent indefinite hang
      });
      if (res.ok) {
        const data = await res.json();
        return data.length > 0 ? (data[0] as Profile) : null;
      }
      return null;
    } catch (error) {
      console.warn("fetchProfile error:", error);
      return null;
    }
  }

  // Bootstrap: read existing session once on mount, then subscribe to changes
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const p = await fetchProfile(s.user.id, s.access_token);
        if (mounted && p) setProfile(p);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        // Jangan timpa profile dengan null jika sekadar network error saat token refresh
        const p = await fetchProfile(s.user.id, s.access_token);
        if (mounted && p) {
          setProfile(p);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // ── Tab Wake-Up Handler ─────────────────────────────────────────────
    // Saat user kembali ke tab setelah meninggalkannya (tab sleep),
    // segarkan sesi Supabase agar semua tombol (logout, dsb) langsung
    // responsif tanpa perlu refresh manual.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mounted) {
        supabase.auth.getSession().then(async ({ data: { session: s } }) => {
          if (!mounted) return;
          setSession(s);
          if (s?.user) {
            const p = await fetchProfile(s.user.id, s.access_token);
            if (mounted && p) setProfile(p);
          } else {
            setProfile(null);
            setSession(null);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ── Sign In ────────────────────────────────────────────────────────────────

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Verifikasi profil ada
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      if (!p) {
        await supabase.auth.signOut();
        return { error: "Profil tidak ditemukan. Harap daftar ulang atau hubungi admin." };
      }
      setProfile(p);
    }
    return { error: null };
  }

  // ── Sign Up ───────────────────────────────────────────────────────────────

  async function signUp(
    email: string,
    password: string,
    meta: { full_name: string; nim?: string; role?: string }
  ): Promise<{ error: string | null }> {
    const isMahasiswa = email.endsWith("@mahasiswa.upnvj.ac.id");
    const assignedRole = meta.role || (isMahasiswa ? "mahasiswa" : "umum");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: meta.full_name,
          nim: meta.nim ?? null,
          role: assignedRole,
        },
      },
    });

    if (error) return { error: error.message };

    // If email confirmation is disabled the user object is already present
    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").upsert({
        id: userId,
        email,
        full_name: meta.full_name,
        role: assignedRole,
        nim: meta.nim ?? null,
        ormawa_id: null,
      });
    }

    return { error: null };
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async function signInWithGoogle(): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error: error?.message ?? null };
  }

  // ── Reset Password ────────────────────────────────────────────────────────

  async function resetPassword(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  // ── Sign Out ──────────────────────────────────────────────────────────────

  async function signOut(): Promise<void> {
    try {
      // Optimistic state clear (agar UI langsung berubah meski network lambat/hang)
      setProfile(null);
      setSession(null);
      
      // Jangan di-await secara blocking jika supabase-js berpotensi hang di Windows
      supabase.auth.signOut().catch(err => console.warn("Background signOut error:", err));
    } catch (err) {
      console.warn("Error saat signOut:", err);
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => useContext(AuthContext);
