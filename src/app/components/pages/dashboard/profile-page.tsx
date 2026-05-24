import React, { useState } from "react";
import { useAuth } from "../../auth-context";
import { GlassCard } from "../../glass-card";
import { User, Mail, CreditCard, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";

export function DashboardProfilePage() {
  const { profile, updatePassword } = useAuth();
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!profile) return null;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

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
        setSuccess("Password berhasil diubah!");
        setPassword("");
        setConfirmPassword("");
        setIsChangingPassword(false);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profil Saya</h1>
        <p className="text-muted-foreground text-sm mt-1">Informasi akun Anda</p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-[#ff6900]/20 shrink-0">
            {profile.full_name[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{profile.full_name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-xs capitalize">
                {profile.role}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nama Lengkap</p>
              <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{profile.email}</p>
            </div>
          </div>

          {profile.role === "mahasiswa" && profile.nim && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NIM</p>
                <p className="text-sm font-medium text-foreground">{profile.nim}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          {!isChangingPassword ? (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-muted hover:bg-border text-foreground font-semibold transition text-sm"
            >
              <KeyRound className="w-4 h-4" /> Ganti Password
            </button>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#ff6900]" /> Ganti Password
                </h3>
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Batal
                </button>
              </div>

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
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2 disabled:opacity-60 text-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Password Baru
              </button>
            </form>
          )}
          
          {success && (
            <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center">
              {success}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
