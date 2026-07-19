/**
 * @file forgot-password-page.tsx
 * @description Halaman lupa password — user memasukkan email untuk menerima link reset.
 *
 * Menggunakan pesan netral "Jika email terdaftar, link reset telah dikirim"
 * untuk mencegah enumerasi akun (keamanan: tidak membocorkan email mana yang terdaftar).
 */
import React, { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth-context";
import { GlassCard } from "../glass-card";
import { KeyRound, Loader2, ArrowLeft, MailCheck } from "lucide-react";

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  /**
   * Submit email untuk reset password.
   * Selalu tampilkan pesan sukses (security: jangan bocorkan apakah email terdaftar).
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Email wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await resetPassword(email);
      if (err) {
        setError(err);
      } else {
        setSuccess(true);
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
        {success ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-muted-foreground text-sm mb-2">
              Jika <span className="font-semibold text-foreground">{email}</span> terdaftar, kami telah mengirimkan link untuk me-reset password.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Jika email tidak muncul di Inbox, cek folder <span className="font-semibold">Spam</span>.
            </p>
            <Link to="/login" className="text-sm font-semibold text-[#ff6900] hover:underline">
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-4">
                <ArrowLeft className="w-4 h-4" /> Kembali
              </Link>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#ff6900]/20">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground text-center">Lupa Password</h1>
              <p className="text-muted-foreground text-sm mt-1 text-center">Masukkan email Anda untuk menerima link reset password.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Kirim Link Reset
              </button>
            </form>
          </>
        )}
      </GlassCard>
    </div>
  );
}
