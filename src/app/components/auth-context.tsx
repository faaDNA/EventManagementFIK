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

// ─── Session Lifetime ────────────────────────────────────────────────────────
// Sesi maksimal 12 jam sejak login. Setelah itu, token berhenti di-refresh
// dan pengguna harus login ulang. Ini mencegah akun "nyangkut" di device
// publik (lab kampus, dll) jika pengguna lupa logout.
const MAX_SESSION_MS = 12 * 60 * 60 * 1000; // 12 jam
const LOGIN_TS_KEY = "login_timestamp";

function isSessionExpired(): boolean {
  const ts = localStorage.getItem(LOGIN_TS_KEY);
  if (!ts) return false;
  return Date.now() - parseInt(ts, 10) > MAX_SESSION_MS;
}

function stampLoginTime(): void {
  if (!localStorage.getItem(LOGIN_TS_KEY)) {
    localStorage.setItem(LOGIN_TS_KEY, Date.now().toString());
  }
}

function clearLoginTime(): void {
  localStorage.removeItem(LOGIN_TS_KEY);
}

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

      // ── Cek batas 12 jam saat pertama kali load ──
      if (s?.user && isSessionExpired()) {
        console.info("Sesi melebihi 12 jam, auto-logout.");
        clearLoginTime();
        setProfile(null);
        setSession(null);
        supabase.auth.signOut().catch(() => {});
        setLoading(false);
        return;
      }

      setSession(s);
      if (s?.user) {
        stampLoginTime(); // pastikan timestamp ada untuk sesi yang sudah ada
        const p = await fetchProfile(s.user.id, s.access_token);
        if (mounted && p) setProfile(p);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;

      // ── Catat waktu login saat SIGNED_IN (email/password & OAuth) ──
      if (event === "SIGNED_IN" && s?.user) {
        localStorage.setItem(LOGIN_TS_KEY, Date.now().toString());
      }

      // ── Cek batas 12 jam setiap kali auth state berubah (termasuk TOKEN_REFRESHED) ──
      if (s?.user && isSessionExpired()) {
        console.info("Sesi melebihi 12 jam (auth state change), auto-logout.");
        clearLoginTime();
        setProfile(null);
        setSession(null);
        supabase.auth.signOut().catch(() => {});
        return;
      }

      setSession(s);
      if (s?.user) {
        // Jangan timpa profile dengan null jika sekadar network error saat token refresh
        const p = await fetchProfile(s.user.id, s.access_token);
        if (mounted && p) {
          setProfile(p);
        }
      } else {
        setProfile(null);
        clearLoginTime();
      }
      setLoading(false);
    });

    // ── Tab Wake-Up Handler ─────────────────────────────────────────────
    // Saat user kembali ke tab setelah meninggalkannya (tab sleep),
    // segarkan sesi Supabase agar semua tombol (logout, dsb) langsung
    // responsif tanpa perlu refresh manual.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mounted) {
        // ── Cek batas 12 jam saat user kembali ke tab ──
        if (isSessionExpired()) {
          console.info("Sesi melebihi 12 jam (tab wake-up), auto-logout.");
          clearLoginTime();
          setProfile(null);
          setSession(null);
          supabase.auth.signOut().catch(() => {});
          return;
        }

        supabase.auth.getSession().then(async ({ data: { session: s } }) => {
          if (!mounted) return;
          setSession(s);
          if (s?.user) {
            const p = await fetchProfile(s.user.id, s.access_token);
            if (mounted && p) setProfile(p);
          } else {
            setProfile(null);
            setSession(null);
            clearLoginTime();
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

  // ── Auto-Logout Timer (Realtime) ──────────────────────────────────────────
  // Timer ini memastikan bahwa jika aplikasi tetap terbuka (tanpa di-refresh),
  // user akan langsung di-logout tepat pada detik ke 12 jam.
  useEffect(() => {
    if (!session?.user) return;
    
    const tsStr = localStorage.getItem(LOGIN_TS_KEY);
    if (!tsStr) return;

    const ts = parseInt(tsStr, 10);
    const elapsed = Date.now() - ts;
    const remaining = MAX_SESSION_MS - elapsed;

    if (remaining <= 0) {
      // Jika entah bagaimana sudah lewat, langsung logout
      clearLoginTime();
      setProfile(null);
      setSession(null);
      supabase.auth.signOut().catch(() => {});
    } else {
      // Pasang alarm untuk sisa waktu
      const timer = setTimeout(() => {
        console.info("Sesi melebihi 12 jam (realtime timer), auto-logout.");
        clearLoginTime();
        setProfile(null);
        setSession(null);
        supabase.auth.signOut().catch(() => {});
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [session]);

  // ── Sign In ────────────────────────────────────────────────────────────────

  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Catat waktu login
    localStorage.setItem(LOGIN_TS_KEY, Date.now().toString());

    // Verifikasi profil ada
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      if (!p) {
        clearLoginTime();
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
    // ── Validasi password ──
    if (password.length < 6) {
      return { error: "Password minimal 6 karakter." };
    }
    if (!meta.full_name.trim()) {
      return { error: "Nama lengkap wajib diisi." };
    }

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
      } as any);
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
      // Hapus timestamp login
      clearLoginTime();
      
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
