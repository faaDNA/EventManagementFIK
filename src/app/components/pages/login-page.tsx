import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth-context";
import { GlassCard } from "../glass-card";
import { Flame, Chrome, Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginPage() {
  const { signIn, signInWithGoogle, session, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Rejection:", event.reason);
      setError("System Error: " + (event.reason?.message || event.reason));
      setLoading(false);
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    if (session && profile) {
      navigate("/dashboard");
    }

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [session, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await signIn(email, password);
      if (err) {
        // Localise common Supabase error messages
        if (err.toLowerCase().includes("invalid login credentials")) {
          setError("Email atau password salah");
        } else if (err.toLowerCase().includes("email not confirmed")) {
          setError("Email belum diverifikasi. Cek inbox-mu dan klik link konfirmasi.");
        } else {
          setError(err);
        }
        return;
      }
      // Success! Profile is already verified in AuthContext.
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || "Terjadi kesalahan yang tidak terduga.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setGoogleLoading(false);
      setError(err);
    }
    // On success the browser will redirect to /dashboard via OAuth callback
    // If user cancels popup or comes back, reset loading
    const handleFocus = () => { setGoogleLoading(false); window.removeEventListener("focus", handleFocus); };
    window.addEventListener("focus", handleFocus);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#ff6900]/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#ff6900]/5 rounded-full blur-[100px]" />

      <GlassCard className="w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#ff6900]/20">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Login</h1>
          <p className="text-muted-foreground text-sm mt-1">Masuk ke akun OrmawaEvent FIK</p>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted transition mb-4 shadow-sm disabled:opacity-60"
        >
          {googleLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          Login dengan Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">atau login dengan email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end mt-1.5">
              <Link to="/forgot-password" className="text-xs text-[#ff6900] hover:underline">
                Lupa Password?
              </Link>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Login
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Belum punya akun?{" "}
          <Link to="/signup" className="text-[#ff6900] font-semibold hover:underline">
            Daftar Sekarang
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}