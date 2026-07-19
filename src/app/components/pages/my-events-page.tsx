/**
 * @file my-events-page.tsx
 * @description Halaman "Kegiatan Saya" versi publik (di luar dashboard).
 *
 * Menggunakan mock data untuk menampilkan kegiatan yang didaftari user.
 * Halaman ini merupakan versi awal sebelum migrasi ke Supabase —
 * versi aktif yang digunakan user sekarang ada di kegiatan-saya.tsx (dashboard).
 */
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { EVENTS } from "../mock-data";
import { GlassCard } from "../glass-card";
import { useAuth } from "../auth-context";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Calendar, FileText, ScanLine, CheckCircle2, Clock } from "lucide-react";

export function MyEventsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const myEvents = EVENTS.slice(0, 3);
  const [scanned, setScanned] = useState<Record<string, boolean>>({});

  if (!profile) { navigate("/login"); return null; }

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Kegiatan Saya</h1>
      <p className="text-muted-foreground text-sm mb-8">Event yang telah kamu daftarkan</p>

      <div className="space-y-4">
        {myEvents.map((event) => (
          <GlassCard key={event.id} className="p-0 overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-48 h-32 md:h-auto shrink-0 relative cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                <ImageWithFallback src={event.cover} alt={event.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/40 hidden md:block" />
              </div>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${event.status === "upcoming" ? "bg-[#ff6900]/10 text-[#ff6900]" : event.status === "ongoing" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {event.status === "upcoming" ? "Akan Datang" : event.status === "ongoing" ? "Berlangsung" : "Selesai"}
                    </span>
                    <h3 className="text-base font-bold text-foreground">{event.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{event.date} | {event.ormawa}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Terdaftar</span>
                  </div>
                </div>

                {event.hasPresensi && event.sessions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Presensi</p>
                    <div className="flex flex-wrap gap-2">
                      {event.sessions.map((s) => {
                        const key = `${event.id}-${s.id}`;
                        const done = scanned[key];
                        return (
                          <button
                            key={s.id}
                            onClick={() => !done && setScanned({ ...scanned, [key]: true })}
                            disabled={done}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition ${
                              done
                                ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-[#ff6900]/10 border border-[#ff6900]/20 text-[#ff6900] hover:bg-[#ff6900]/20 cursor-pointer"
                            }`}
                          >
                            {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.method === "qr" ? <ScanLine className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                            {done ? `${s.name} - Hadir` : s.method === "qr" ? `Scan ${s.name}` : `Isi Form ${s.name}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!event.hasPresensi && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Tidak ada sesi presensi
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
