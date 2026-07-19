/**
 * @file profile-page.tsx
 * @description Halaman profil user di dashboard.
 *
 * Menampilkan informasi akun (nama, email, NIM, role) dan menyediakan fitur:
 * - Edit nama lengkap (inline edit dengan tombol Edit/Simpan/Batal)
 * - Ganti password (form expandable dengan validasi)
 *
 * NIM ditampilkan read-only karena di-extract otomatis dari email mahasiswa.
 */
import React, { useState } from "react";
import { useAuth } from "../../auth-context";
import { GlassCard } from "../../glass-card";
import { User, Mail, CreditCard, KeyRound, Loader2, Eye, EyeOff, Edit2, X, Check, GraduationCap, BookOpen } from "lucide-react";

export function DashboardProfilePage() {
  const { profile, updatePassword, updateProfile } = useAuth();
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState("");

  const [isEditingAkademik, setIsEditingAkademik] = useState(false);
  const [editFakultas, setEditFakultas] = useState(profile?.fakultas || "");
  const [editJurusan, setEditJurusan] = useState(profile?.jurusan || "");
  const [akademikLoading, setAkademikLoading] = useState(false);
  const [akademikSuccess, setAkademikSuccess] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (!profile) return null;

  /** Handler submit ganti password. Validasi: wajib diisi, minimal 6 karakter, konfirmasi cocok. */
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

  /** Handler submit edit nama. Validasi: tidak boleh kosong. Toast success selama 3 detik. */
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setError("Nama lengkap tidak boleh kosong");
      return;
    }

    setNameLoading(true);
    try {
      const { error: err } = await updateProfile({ full_name: editName.trim() });
      if (err) {
        setError(err);
      } else {
        setNameSuccess("Nama berhasil diubah");
        setIsEditingName(false);
        setTimeout(() => setNameSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setNameLoading(false);
    }
  };

  /** Handler submit edit akademik. Validasi: tidak boleh kosong. Toast success selama 3 detik. */
  const handleAkademikSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFakultas || !editJurusan.trim()) {
      setError("Fakultas dan Jurusan wajib diisi");
      return;
    }

    setAkademikLoading(true);
    try {
      const { error: err } = await updateProfile({ 
        fakultas: editFakultas,
        jurusan: editJurusan.trim()
      });
      if (err) {
        setError(err);
      } else {
        setAkademikSuccess("Data akademik berhasil diubah");
        setIsEditingAkademik(false);
        setTimeout(() => setAkademikSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setAkademikLoading(false);
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
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Nama Lengkap</p>
              {isEditingName ? (
                <form onSubmit={handleNameSubmit} className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-input-background border border-border text-sm text-foreground focus:border-[#ff6900]/50 focus:outline-none focus:ring-1 focus:ring-[#ff6900]/50 transition"
                    autoFocus
                  />
                  <button type="submit" disabled={nameLoading} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition disabled:opacity-50">
                    {nameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => { setIsEditingName(false); setEditName(profile.full_name); }} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition">
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
                  <button onClick={() => setIsEditingName(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#ff6900] bg-[#ff6900]/10 hover:bg-[#ff6900]/20 transition">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>
              )}
              {nameSuccess && <p className="text-[10px] text-emerald-500 mt-0.5">{nameSuccess}</p>}
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
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NIM</p>
                  <p className="text-sm font-medium text-foreground">{profile.nim}</p>
                </div>
              </div>

              {/* Data Akademik (Fakultas & Jurusan) */}
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Fakultas & Jurusan</p>
                    {!isEditingAkademik && (
                      <button onClick={() => setIsEditingAkademik(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#ff6900] bg-[#ff6900]/10 hover:bg-[#ff6900]/20 transition">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                  
                  {isEditingAkademik ? (
                    <form onSubmit={handleAkademikSubmit} className="mt-2 space-y-3">
                      <div>
                        <select
                          value={editFakultas}
                          onChange={(e) => setEditFakultas(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm text-foreground focus:border-[#ff6900]/50 focus:outline-none focus:ring-1 focus:ring-[#ff6900]/50 transition"
                        >
                          <option value="">-- Pilih Fakultas --</option>
                          <option value="FIK">Fakultas Ilmu Komputer (FIK)</option>
                          <option value="FEB">Fakultas Ekonomi dan Bisnis (FEB)</option>
                          <option value="FK">Fakultas Kedokteran (FK)</option>
                          <option value="FT">Fakultas Teknik (FT)</option>
                          <option value="FISIP">Fakultas Ilmu Sosial dan Ilmu Politik (FISIP)</option>
                          <option value="FH">Fakultas Hukum (FH)</option>
                          <option value="FIKES">Fakultas Ilmu Kesehatan (FIKES)</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={editJurusan}
                          onChange={(e) => setEditJurusan(e.target.value)}
                          placeholder="Contoh: D3 Sistem Informasi"
                          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border text-sm text-foreground focus:border-[#ff6900]/50 focus:outline-none focus:ring-1 focus:ring-[#ff6900]/50 transition"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={akademikLoading} className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-sm font-medium hover:bg-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {akademikLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Simpan
                        </button>
                        <button type="button" onClick={() => { setIsEditingAkademik(false); setEditFakultas(profile.fakultas || ""); setEditJurusan(profile.jurusan || ""); }} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition text-sm font-medium">
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">{profile.fakultas || <span className="text-muted-foreground italic">Fakultas belum diisi</span>}</p>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        {profile.jurusan || <span className="text-muted-foreground italic">Jurusan belum diisi</span>}
                      </p>
                    </div>
                  )}
                  {akademikSuccess && <p className="text-[10px] text-emerald-500 mt-1">{akademikSuccess}</p>}
                </div>
              </div>
            </>
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
