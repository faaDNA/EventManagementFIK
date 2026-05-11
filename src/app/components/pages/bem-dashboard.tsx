import { useEffect, useState } from "react";
import { MONTHLY_STATS, EVENTS } from "../mock-data";
import { GlassCard } from "../glass-card";
import { useAuth } from "../auth-context";
import { useTheme } from "../theme-context";
import { useNavigate } from "react-router";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Users, Calendar, TrendingUp, Award, Download, Plus, Building2, Activity, Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

const tempClient = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false, storageKey: "temp-admin-auth-token-bem" } }
);

const PIE_DATA = [
  { name: "Seminar", value: 35 },
  { name: "Workshop", value: 28 },
  { name: "Kompetisi", value: 15 },
  { name: "Oprec", value: 12 },
  { name: "Pelatihan", value: 10 },
];
const COLORS = ["#ff6900", "#ff8c3a", "#ffb366", "#3b82f6", "#22c55e"];

export function BEMDashboard() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showAddOrmawa, setShowAddOrmawa] = useState(false);
  const [newOrmawa, setNewOrmawa] = useState({ name: "", fullName: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [ormawaList, setOrmawaList] = useState<any[]>([]);

  const fetchOrmawa = async () => {
    const { data, error } = await supabase
      .from("ormawa")
      .select("*, events(count)")
      .order("created_at", { ascending: false });
    if (data) {
      setOrmawaList(
        data.map((d: any) => ({
          ...d,
          events: d.events?.[0]?.count || 0
        }))
      );
    }
  };

  useEffect(() => {
    fetchOrmawa();
  }, []);

  const handleAddOrmawa = async () => {
    setError("");
    setSuccessMsg("");
    if (!newOrmawa.name || !newOrmawa.fullName || !newOrmawa.email || !newOrmawa.password) {
      setError("Semua field wajib diisi");
      return;
    }
    
    setLoading(true);

    try {
      // 1. Insert ke tabel ormawa menggunakan supabase client (admin session)
      const { data: ormawaData, error: ormawaError } = await supabase
        .from("ormawa")
        .insert({
          name: newOrmawa.name,
          full_name: newOrmawa.fullName,
          email: newOrmawa.email,
          is_active: true
        })
        .select()
        .single();

      if (ormawaError) throw new Error(ormawaError.message);

      // 2. Buat akun auth (gunakan tempClient agar admin tidak terlogout)
      //    Trigger handle_new_user akan otomatis membuat row di profiles
      //    berdasarkan metadata (full_name, role, ormawa_id) yang kita kirim

      const { error: signUpError } = await tempClient.auth.signUp({
        email: newOrmawa.email,
        password: newOrmawa.password,
        options: {
          data: {
            full_name: newOrmawa.name,
            role: "ormawa",
            ormawa_id: ormawaData.id,
          },
        },
      });

      if (signUpError) {
        // Rollback: hapus ormawa jika pembuatan akun auth gagal
        await supabase.from("ormawa").delete().eq("id", ormawaData.id);
        throw new Error(signUpError.message);
      }

      // Profile otomatis dibuat oleh trigger handle_new_user di database
      // (dengan full_name, role='ormawa', ormawa_id dari metadata)

      setSuccessMsg("Akun ormawa berhasil dibuat!");
      setNewOrmawa({ name: "", fullName: "", email: "", password: "" });
      fetchOrmawa();
      setTimeout(() => {
        setShowAddOrmawa(false);
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error("Add Ormawa Error:", err);
      setError(err.message || "Terjadi kesalahan saat mendaftar");
    } finally {
      setLoading(false);
    }
  };

  if (!profile || profile.role !== "admin") { navigate("/login"); return null; }

  const isDark = theme === "dark";
  const axisColor = isDark ? "#ffffff50" : "#6b728080";
  const tooltipBg = isDark ? "#1a1a2e" : "#ffffff";
  const tooltipBorder = isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb";
  const tooltipColor = isDark ? "#fff" : "#1a1a2e";

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard BEM FIK</h1>
          <p className="text-muted-foreground text-sm">Monitoring & Analitik Kegiatan Ormawa</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-muted border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export Laporan
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Ormawa", value: ormawaList.length, icon: Building2, color: "#ff6900" },
          { label: "Total Event", value: EVENTS.length, icon: Calendar, color: "#3b82f6" },
          { label: "Total Peserta", value: "472", icon: Users, color: "#22c55e" },
          { label: "Pertumbuhan", value: "+23%", icon: TrendingUp, color: "#a855f7" },
        ].map((s) => (
          <GlassCard key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-[#ff6900]" /> Partisipasi Kegiatan Per Bulan</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={MONTHLY_STATS}>
              <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: "12px", color: tooltipColor, fontSize: 12 }} />
              <Bar dataKey="participants" fill="#ff6900" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#3b82f6]" /> Tren Jumlah Event</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={MONTHLY_STATS}>
              <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: "12px", color: tooltipColor, fontSize: 12 }} />
              <Line type="monotone" dataKey="events" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribusi Kategori Event</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {PIE_DATA.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: "12px", color: tooltipColor, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {PIE_DATA.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                {d.name}
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Building2 className="w-4 h-4 text-[#ff6900]" /> Daftar Ormawa</h3>
              <button onClick={() => setShowAddOrmawa(true)} className="px-3 py-1.5 rounded-lg bg-[#ff6900]/10 text-[#ff6900] text-xs font-medium hover:bg-[#ff6900]/20 transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Tambah Ormawa
              </button>
            </div>
            <div className="space-y-3">
              {ormawaList.map((o, i) => (
                <div key={o.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted border border-border">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {o.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.fullName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{o.events}</p>
                    <p className="text-xs text-muted-foreground">Events</p>
                  </div>
                  {i === 0 && <Award className="w-5 h-5 text-yellow-500 shrink-0" />}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {showAddOrmawa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6 border border-border bg-card">
            <h2 className="text-lg font-bold text-foreground mb-5">Tambah Akun Ormawa</h2>
            <div className="space-y-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {successMsg && <p className="text-sm text-emerald-500">{successMsg}</p>}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nama Ormawa</label>
                <input type="text" placeholder="Contoh: HIMTI" value={newOrmawa.name} onChange={e => setNewOrmawa({...newOrmawa, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nama Lengkap</label>
                <input type="text" placeholder="Himpunan Mahasiswa Teknik Informatika" value={newOrmawa.fullName} onChange={e => setNewOrmawa({...newOrmawa, fullName: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email Akun</label>
                <input type="email" placeholder="ormawa@upnvj.ac.id" value={newOrmawa.email} onChange={e => setNewOrmawa({...newOrmawa, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} placeholder="Masukkan password akun" value={newOrmawa.password} onChange={e => setNewOrmawa({...newOrmawa, password: e.target.value})} className="w-full px-4 py-2.5 pr-10 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddOrmawa(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition">Batal</button>
              <button onClick={handleAddOrmawa} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
