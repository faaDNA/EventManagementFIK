import React, { useState, useEffect } from "react";
import { GlassCard } from "../../glass-card";
import { useTheme } from "../../theme-context";
import { useAuth } from "../../auth-context";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Users, Calendar, TrendingUp, CheckCircle2, Activity, Loader2 } from "lucide-react";

const COLORS = ["#ff6900", "#3b82f6", "#22c55e", "#a855f7", "#eab308", "#ec4899", "#64748b"];

export function DashboardAnalitik() {
  const { theme } = useTheme();
  const { profile, session } = useAuth();
  const isDark = theme === "dark";
  const axisColor = isDark ? "#ffffff50" : "#6b728080";
  const tooltipBg = isDark ? "#1a1a2e" : "#ffffff";
  const tooltipBorder = isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb";
  const tooltipColor = isDark ? "#fff" : "#1a1a2e";

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEvents: 0, totalRegistrants: 0, totalAttendees: 0, attendanceRate: 0 });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAnalitik() {
      if (!session?.access_token || !profile) return;
      setLoading(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const headers = { "apikey": key, "Authorization": `Bearer ${session.access_token}` };

        // 1. Fetch Events
        let eventQuery = `${url}/rest/v1/events?select=id,category,created_at,date`;
        if (profile.role === "ormawa" && profile.ormawa_id) {
          eventQuery += `&ormawa_id=eq.${profile.ormawa_id}`;
        }
        const resEvents = await fetch(eventQuery, { headers });
        const events = resEvents.ok ? await resEvents.json() : [];

        let registrations: any[] = [];
        let attendances: any[] = [];
        const sessionToEvent = new Map<string, string>();

        if (events.length > 0) {
          const eventIds = new Set(events.map((e: any) => e.id));

          // 2. Fetch Registrations
          let regQuery = `${url}/rest/v1/event_registrations?select=id,registered_at,event_id`;
          const resRegs = await fetch(regQuery, { headers });
          if (resRegs.ok) {
            const rawRegs = await resRegs.json();
            registrations = rawRegs.filter((r: any) => eventIds.has(r.event_id));
          }

          // 3. Fetch Attendances
          let sessQuery = `${url}/rest/v1/attendance_sessions?select=id,event_id`;
          const resSess = await fetch(sessQuery, { headers });
          if (resSess.ok) {
            const rawSess = await resSess.json();
            rawSess.forEach((s: any) => {
              if (eventIds.has(s.event_id)) {
                sessionToEvent.set(s.id, s.event_id);
              }
            });
            
            if (sessionToEvent.size > 0) {
              const resAtt = await fetch(`${url}/rest/v1/attendance_records?select=id,session_id,user_id`, { headers });
              if (resAtt.ok) {
                const rawAtt = await resAtt.json();
                attendances = rawAtt.filter((a: any) => sessionToEvent.has(a.session_id));
              }
            }
          }
        }

        // Hitung Stat
        const tEvents = events.length;
        const tRegs = registrations.length;
        const tAtt = new Set(attendances.map((a: any) => `${sessionToEvent.get(a.session_id)}_${a.user_id}`)).size;
        let rate = tRegs > 0 ? Math.round((tAtt / tRegs) * 100) : 0;
        if (rate > 100) rate = 100; // fallback just in case
        setStats({ totalEvents: tEvents, totalRegistrants: tRegs, totalAttendees: tAtt, attendanceRate: rate });

        // Hitung Kategori
        const catMap: Record<string, number> = {};
        events.forEach((e: any) => {
          const c = e.category || "Lainnya";
          catMap[c] = (catMap[c] || 0) + 1;
        });
        setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })));

        // Hitung Bulanan (6 bulan terakhir)
        const mData = [];
        const now = new Date();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mName = monthNames[d.getMonth()];
          const y = d.getFullYear();

          const evCount = events.filter((e: any) => {
            const ed = new Date(e.created_at);
            return ed.getMonth() === d.getMonth() && ed.getFullYear() === y;
          }).length;

          const regCount = registrations.filter((r: any) => {
            const rd = new Date(r.registered_at);
            return rd.getMonth() === d.getMonth() && rd.getFullYear() === y;
          }).length;

          mData.push({ month: mName, events: evCount, participants: regCount });
        }
        setMonthlyData(mData);

      } catch (err) {
        console.error("Analitik error:", err);
      }
      setLoading(false);
    }
    fetchAnalitik();
  }, [profile, session]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
        <p className="text-sm">Memuat analitik...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard Analitik</h1>
      <p className="text-muted-foreground text-sm mb-6">Monitoring & analitik kegiatan {profile?.role === "ormawa" ? "Ormawa" : "FIK"}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Kegiatan", value: stats.totalEvents, icon: Calendar, color: "#3b82f6" },
          { label: "Total Pendaftar", value: stats.totalRegistrants, icon: Users, color: "#ff6900" },
          { label: "Total Hadir", value: stats.totalAttendees, icon: CheckCircle2, color: "#22c55e" },
          { label: "Persentase Hadir", value: `${stats.attendanceRate}%`, icon: TrendingUp, color: "#a855f7" },
        ].map((s) => (
          <GlassCard key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-[#ff6900]" /> Pendaftar Per Bulan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: "12px", color: tooltipColor, fontSize: 12 }} />
              <Bar dataKey="participants" name="Pendaftar" fill="#ff6900" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#3b82f6]" /> Kegiatan Per Bulan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: "12px", color: tooltipColor, fontSize: 12 }} />
              <Line type="monotone" dataKey="events" name="Kegiatan" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Distribusi Kategori Kegiatan</h3>
        {categoryData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data kegiatan</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <PieChart width={200} height={200}>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: "12px", color: tooltipColor, fontSize: 12 }} />
            </PieChart>
            <div className="flex flex-wrap gap-3">
              {categoryData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
