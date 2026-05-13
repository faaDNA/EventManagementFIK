import React, { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth-context";
import { GlassCard } from "../glass-card";
import {
  Flame, ArrowLeft, ArrowRight, CheckCircle2,
  Eye, EyeOff, Mail, User, GraduationCap,
  KeyRound, ShieldCheck, Loader2,
} from "lucide-react";

type Step = "email" | "profile" | "password";

export function SignupPage() {
  const { signUp } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [nim, setNim] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const isMahasiswa = email.endsWith("@mahasiswa.upnvj.ac.id");
  const extractedNim = isMahasiswa ? email.split("@")[0] : "";

  // Step indicator (no OTP step — Supabase handles email verification natively)
  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: "email",   label: "Email",    icon: <Mail className="w-4 h-4" /> },
    { key: "profile", label: "Profil",   icon: <User className="w-4 h-4" /> },
    { key: "password", label: "Password", icon: <KeyRound className="w-4 h-4" /> },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleEmailNext = () => {
    setError("");
    if (!email) { setError("Email wajib diisi"); return; }
    if (!email.includes("@")) { setError("Format email tidak valid"); return; }
    if (isMahasiswa) setNim(extractedNim);
    setStep("profile");
  };

  const handleProfileNext = () => {
    setError("");
    if (!name.trim()) { setError("Nama wajib diisi"); return; }
    if (isMahasiswa && !nim.trim()) { setError("NIM wajib diisi"); return; }
    setStep("password");
  };

  const handleSignup = async () => {
    setError("");
    if (password.length < 6) { setError("Password minimal 6 karakter"); return; }
    if (password !== confirmPw) { setError("Konfirmasi password tidak cocok"); return; }

    setLoading(true);
    const { error: err } = await signUp(email, password, {
      full_name: name.trim(),
      nim: isMahasiswa ? nim.trim() : undefined,
    });
    setLoading(false);

    if (err) {
      if (err.toLowerCase().includes("user already registered")) {
        setError("Email ini sudah terdaftar. Silakan login.");
      } else if (err.toLowerCase().includes("password")) {
        setError("Password terlalu lemah. Gunakan kombinasi huruf dan angka.");
      } else {
        setError(err);
      }
      return;
    }

    setDone(true);
  };

  // ── Success screen ─────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <GlassCard className="w-full max-w-md p-10 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Akun Dibuat!</h2>
          <p className="text-muted-foreground text-sm mb-1">
            Kami mengirim link verifikasi ke:
          </p>
          <p className="text-[#ff6900] font-semibold mb-6">{email}</p>
          <p className="text-xs text-muted-foreground mb-8">
            Buka email-mu dan klik link konfirmasi sebelum login.
            Cek folder <span className="font-medium">Spam</span> jika tidak muncul.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20"
          >
            Ke Halaman Login
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#ff6900]/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#ff6900]/5 rounded-full blur-[100px]" />

      <GlassCard className="w-full max-w-md p-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#ff6900]/20">
            <Flame className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat Akun</h1>
          <p className="text-muted-foreground text-sm mt-1">Daftar ke OrmawaEvent FIK</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    i < stepIndex
                      ? "bg-emerald-500 text-white"
                      : i === stepIndex
                      ? "bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] text-white shadow-md shadow-[#ff6900]/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
                </div>
                <span className={`text-[10px] font-medium ${i <= stepIndex ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 rounded mx-2 mb-5 transition-all ${i < stepIndex ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Email ────────────────────────────────────────────── */}
        {step === "email" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Alamat Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com atau NIM@mahasiswa.upnvj.ac.id"
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
                autoFocus
              />
            </div>

            {email && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                  isMahasiswa
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                    : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                {isMahasiswa
                  ? `Terdeteksi sebagai Mahasiswa UPNVJ (NIM: ${extractedNim})`
                  : "Akan didaftarkan sebagai Masyarakat Umum"}
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleEmailNext}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center justify-center gap-2"
            >
              Lanjutkan <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Profile ──────────────────────────────────────────── */}
        {step === "profile" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted border border-border">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{email}</p>
              <p className={`text-xs mt-1 font-medium ${isMahasiswa ? "text-blue-500" : "text-purple-500"}`}>
                {isMahasiswa ? "Mahasiswa UPNVJ" : "Masyarakat Umum"}
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
                autoFocus
              />
            </div>

            {isMahasiswa && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">NIM</label>
                <input
                  type="text"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  placeholder="Contoh: 2210511001"
                  className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
                />
                <p className="text-[10px] text-muted-foreground mt-1">NIM otomatis terdeteksi dari email, bisa diubah jika diperlukan</p>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("email"); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali
              </button>
              <button
                onClick={handleProfileNext}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-1"
              >
                Lanjutkan <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Password ─────────────────────────────────────────── */}
        {step === "password" && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <div className="w-14 h-14 rounded-2xl bg-[#ff6900]/10 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-7 h-7 text-[#ff6900]" />
              </div>
              <p className="text-sm text-foreground font-medium">Buat password untuk akunmu</p>
              <p className="text-xs text-muted-foreground mt-1">
                Setelah daftar, cek email untuk konfirmasi akun
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none focus:ring-2 focus:ring-[#ff6900]/10 transition placeholder:text-muted-foreground/40"
                  autoFocus
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
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Ulangi password"
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
              {confirmPw && password !== confirmPw && (
                <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("profile"); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali
              </button>
              <button
                onClick={handleSignup}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Buat Akun
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-[#ff6900] font-semibold hover:underline">
            Login
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}