import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth-context";
import { GlassCard } from "../glass-card";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";

export function ResetPasswordPage() {
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Jika tidak ada session (karena link reset tidak valid/sudah expired), kita bisa redirect atau kasih error.
  // Tapi kadang session butuh waktu sebentar untuk diproses dari URL hash oleh Supabase.
  useEffect(() => {
    // Timeout singkat untuk mengecek session
    const timer = setTimeout(() => {
      if (!session) {
        setError("Link reset password tidak valid atau sudah kadaluarsa. Silakan request link baru.");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Password baru wajib diisi");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err);
      } else {
        // Success
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#ff6900]/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#ff6900]/5 rounded-full blur-[100px]" />

      <GlassCard className="w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#ff6900]/20">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Password Baru</h1>
          <p className="text-muted-foreground text-sm mt-1">Masukkan password baru untuk akun Anda.</p>
        </div>

        {error && error.includes("kadaluarsa") ? (
          <div className="text-center">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-border text-foreground text-sm font-semibold transition"
            >
              Request Link Baru
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password Baru</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
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
              {password.length > 0 && password.length < 6 && (
                <p className="text-xs text-red-500 mt-1">Password minimal 6 karakter</p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Konfirmasi Password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !session}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan Password Baru
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
