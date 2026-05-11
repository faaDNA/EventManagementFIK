import React, { useState } from "react";
import { EVENTS } from "../mock-data";
import { GlassCard } from "../glass-card";
import { useAuth } from "../auth-context";
import { useNavigate } from "react-router";
import { Plus, Users, Calendar, Eye, QrCode, Download, CheckCircle2, Edit3, ClipboardList } from "lucide-react";

const TABS = ["Kegiatan", "Buat Event", "Presensi Live"];

const MOCK_REGISTRANTS = [
  { id: "r1", name: "Andi Pratama", nim: "2210511001", email: "2210511001@mahasiswa.upnvj.ac.id", status: "approved" },
  { id: "r2", name: "Siti Nurhaliza", nim: "2210511015", email: "2210511015@mahasiswa.upnvj.ac.id", status: "approved" },
  { id: "r3", name: "Budi Santoso", nim: null, email: "budi@gmail.com", status: "pending" },
  { id: "r4", name: "Dewi Lestari", nim: "2210511023", email: "2210511023@mahasiswa.upnvj.ac.id", status: "approved" },
  { id: "r5", name: "John Doe", nim: null, email: "john@outlook.com", status: "approved" },
];

export function OrmawaDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Kegiatan");
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [attendees] = useState<string[]>([]);

  if (!profile || profile.role !== "ormawa") { navigate("/login"); return null; }

  const ormawaEvents = EVENTS.filter((e) => e.ormawa === "HIMTI");

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Ormawa</h1>
          <p className="text-muted-foreground text-sm">Kelola event dan presensi HIMTI</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Event", value: ormawaEvents.length, icon: Calendar, color: "#ff6900" },
          { label: "Total Peserta", value: "291", icon: Users, color: "#3b82f6" },
          { label: "Event Aktif", value: "2", icon: Eye, color: "#22c55e" },
          { label: "Sesi Presensi", value: "5", icon: ClipboardList, color: "#a855f7" },
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

      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-[#ff6900] text-white shadow" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Kegiatan" && (
        <div className="space-y-4">
          {ormawaEvents.map((event) => (
            <GlassCard key={event.id} className="p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${event.status === "upcoming" ? "bg-[#ff6900]/10 text-[#ff6900]" : event.status === "ongoing" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {event.status === "upcoming" ? "Akan Datang" : event.status === "ongoing" ? "Berlangsung" : "Selesai"}
                    </span>
                    {event.hasPresensi && <span className="px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400">Multi-Sesi</span>}
                    {!event.hasPresensi && <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">Tanpa Presensi</span>}
                  </div>
                  <h3 className="text-base font-bold text-foreground">{event.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{event.date} | {event.location} | {event.registered}/{event.quota} peserta</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)} className="px-3 py-2 rounded-xl bg-muted border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Peserta
                  </button>
                  <button className="px-3 py-2 rounded-xl bg-muted border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              </div>

              {selectedEvent === event.id && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground uppercase">
                          <th className="pb-2 pr-4">Nama</th>
                          <th className="pb-2 pr-4">NIM</th>
                          <th className="pb-2 pr-4">Email</th>
                          <th className="pb-2 pr-4">Kategori</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_REGISTRANTS.map((r) => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="py-2.5 pr-4 font-medium text-foreground">{r.name}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{r.nim || "-"}</td>
                            <td className="py-2.5 pr-4 text-xs text-muted-foreground">{r.email}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs ${r.nim ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"}`}>
                                {r.nim ? "Mahasiswa" : "Umum"}
                              </span>
                            </td>
                            <td className="py-2.5">
                              {r.status === "approved" ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Diterima</span>
                              ) : (
                                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs"><Edit3 className="w-3.5 h-3.5" /> Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {tab === "Buat Event" && (
        <GlassCard className="p-6 max-w-2xl">
          <h2 className="text-lg font-bold text-foreground mb-5">Buat Event Baru</h2>
          <div className="space-y-4">
            {[
              { label: "Judul Event", placeholder: "Masukkan judul event", type: "text" },
              { label: "Deskripsi", placeholder: "Deskripsi singkat event", type: "textarea" },
              { label: "Tanggal", placeholder: "", type: "date" },
              { label: "Waktu", placeholder: "09:00 - 12:00", type: "text" },
              { label: "Lokasi", placeholder: "Masukkan lokasi", type: "text" },
              { label: "Kuota Peserta", placeholder: "100", type: "number" },
              { label: "Cover URL", placeholder: "https://...", type: "text" },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea rows={3} placeholder={f.placeholder} className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition resize-none placeholder:text-muted-foreground/40" />
                ) : (
                  <input type={f.type} placeholder={f.placeholder} className="w-full px-4 py-2.5 rounded-xl bg-input-background border border-border text-foreground text-sm focus:border-[#ff6900]/50 focus:outline-none transition placeholder:text-muted-foreground/40" />
                )}
              </div>
            ))}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border">
              <input type="checkbox" defaultChecked className="accent-[#ff6900]" />
              <label className="text-sm text-foreground">Aktifkan Sesi Presensi</label>
            </div>
            <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20">
              <Plus className="w-4 h-4 inline mr-2" />Publish Event
            </button>
          </div>
        </GlassCard>
      )}

      {tab === "Presensi Live" && (
        <div className="space-y-6">
          <GlassCard className="p-6 text-center max-w-lg mx-auto">
            <QrCode className="w-16 h-16 text-[#ff6900] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">Mode Presensi QR Code</h2>
            <p className="text-sm text-muted-foreground mb-6">Tampilkan QR Code ini di proyektor untuk presensi peserta</p>
            <div className="w-48 h-48 mx-auto rounded-2xl bg-white dark:bg-white p-3 mb-4">
              <div className="w-full h-full rounded-xl bg-gray-900 flex items-center justify-center">
                <QrCode className="w-24 h-24 text-white" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Sesi 1 - Pembukaan | Seminar AI & Future of Work</p>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" /> <span className="font-bold">{attendees.length}</span> <span className="text-muted-foreground">hadir</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="w-4 h-4" /> <span>156 terdaftar</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
