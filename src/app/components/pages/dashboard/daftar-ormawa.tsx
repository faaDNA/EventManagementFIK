import { useEffect, useState } from "react";
import { GlassCard } from "../../glass-card";
import { Plus, Award, Building2, Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../../lib/supabase";

const tempClient = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false, storageKey: "temp-admin-auth-token-daftar" } }
);

export function DashboardDaftarOrmawa() {
  const [showAdd, setShowAdd] = useState(false);
  const [newOrmawa, setNewOrmawa] = useState({ name: "", fullName: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [ormawaList, setOrmawaList] = useState<any[]>([]);

  const fetchOrmawa = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      
      // Need auth token? Admin page usually requires it, but ormawa list might be public if RLS allows, 
      // otherwise we can fetch session from localStorage or use key.
      const res = await fetch(`${url}/rest/v1/ormawa?select=*,events(count)&order=created_at.desc`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrmawaList(
          data.map((d: any) => ({
            ...d,
            events: d.events?.[0]?.count || 0
          }))
        );
      }
    } catch (err) {
      console.error("Fetch ormawa error:", err);
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
      // 1. Insert ke tabel ormawa menggunakan admin client (main supabase)
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
        setShowAdd(false);
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error("Add Ormawa Error:", err);
      setError(err.message || "Terjadi kesalahan saat mendaftar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daftar Ormawa</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola organisasi mahasiswa FIK</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tambah Ormawa
        </button>
      </div>

      <div className="space-y-3">
        {ormawaList.map((o, i) => (
          <GlassCard key={o.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center text-white font-bold text-lg shrink-0">
                {o.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{o.name}</p>
                <p className="text-xs text-muted-foreground truncate">{o.full_name}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{o.events}</p>
                  <p className="text-[10px] text-muted-foreground">Events</p>
                </div>
              </div>
              {i === 0 && <Award className="w-5 h-5 text-yellow-500 shrink-0" />}
            </div>
          </GlassCard>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6 bg-card border border-border">
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
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition">Batal</button>
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
